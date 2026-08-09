import * as semver from 'semver';
import { VersionStatus } from './types';
import { normalizePyPIVersion } from './pypi';

export function extractComparableVersion(spec: string): string | null {
    const trimmed = spec.trim();
    if (!trimmed) {
        return null;
    }

    // Ignore environment markers; only parse the requirement specifier portion.
    const specifier = trimmed.split(';')[0].trim();
    if (!specifier) {
        return null;
    }

    // Prefer a version after an explicit comparator (==, >=, ~, ^, etc).
    // Accept 4+ segment versions (e.g. 3.0.3.260530) for PEP 440 post-releases and custom versioning.
    const comparatorMatch = specifier.match(
        /^\s*(?:===|==|~=|!=|<=|>=|<|>|\^|~)\s*v?(\d+(?:\.\d+)*(?:-[0-9A-Za-z.-]+)?)/,
    );
    if (comparatorMatch?.[1]) {
        // Normalize the extracted version (e.g. 3.0.3.260530 -> 3.0.3+260530).
        const extracted = comparatorMatch[1];
        const normalized = normalizePyPIVersion(extracted);
        if (normalized) {
            return normalized;
        }
        // Fallback to semver coercion if normalization fails.
        return semver.valid(extracted) || semver.coerce(extracted)?.version || null;
    }

    // Fallback for plain versions like "1.2.3" or "3.0.3.260530".
    const directVersionMatch = specifier.match(/^v?(\d+(?:\.\d+)*(?:-[0-9A-Za-z.-]+)?)$/);
    if (directVersionMatch?.[1]) {
        const extracted = directVersionMatch[1];
        const normalized = normalizePyPIVersion(extracted);
        if (normalized) {
            return normalized;
        }
        return semver.valid(extracted) || semver.coerce(extracted)?.version || null;
    }

    return null;
}

export function compareVersions(currentSpec: string, latestStable: string): VersionStatus {
    // 1. Clean up currentSpec to get a comparable version
    // "==2.31.0" -> "2.31.0"
    // "^2.31.0" -> "2.31.0" (for "current installed" approximation, or just use the spec to check satisfaction)
    // The requirement says:
    // "For dependencies with a pinned exact version (or a resolvable spec)... show inline annotation"
    // "Annotation shows latest version and is color-coded"

    // We need to extract a "reference version" from the spec to compare against.
    // e.g. if user has "^2.31.0", they "have" 2.31.0 nominally, or we treat it as they are willing to accept 2.x.
    // BUT the prompt example: "current: 1.4.2, latest: 2.1.0 -> RED".
    // So we treat the *explicitly written version* as the current state.

    const cleanCurrent = extractComparableVersion(currentSpec);

    if (!cleanCurrent) {
        // If we can't parse a version (e.g. "*", "git..."), we can't really do inline updates easily.
        return { current: currentSpec, latest: latestStable, type: 'latest' };
    }

    const current = cleanCurrent;
    const latest = latestStable;

    // Check pre-release
    if (semver.prerelease(latest)) {
        return { current, latest, type: 'prerelease' };
    }

    // Check Major
    if (semver.major(latest) > semver.major(current)) {
        return { current, latest, type: 'major' };
    }

    // Check Minor
    if (semver.minor(latest) > semver.minor(current)) {
        return { current, latest, type: 'minor' };
    }

    // Check Patch
    if (semver.patch(latest) > semver.patch(current)) {
        return { current, latest, type: 'patch' };
    }

    // Build-metadata-only update (e.g. latestStable "3.0.3+260530" vs current "3.0.3",
    // or a post-release "1.0.0+post.1" vs "1.0.0"). semver treats these as equal, but
    // the build part signals a newer release on PyPI.
    if (isNewerVersion(latest, current)) {
        return { current, latest, type: 'patch' };
    }

    return { current, latest, type: 'latest' };
}

export function getGenericUpdateType(current: string, target: string): 'major' | 'minor' | 'patch' | 'prerelease' {
    const diff = semver.diff(current, target);
    if (!diff) {
        return 'patch';
    } // fallback
    if (diff === 'major' || diff === 'premajor') {
        return 'major';
    }

    if (diff === 'minor' || diff === 'preminor') {
        return 'minor';
    }
    return 'patch'; // patch, prepatch, prerelease
}

// Ascending comparator for build metadata segments (higher numeric value = newer).
function compareBuildPartsAsc(aBuild: readonly string[], bBuild: readonly string[]): number {
    const len = Math.max(aBuild.length, bBuild.length);
    for (let i = 0; i < len; i++) {
        const aPart = aBuild[i];
        const bPart = bBuild[i];
        if (aPart === undefined) return -1;
        if (bPart === undefined) return 1;
        const aNum = Number(aPart);
        const bNum = Number(bPart);
        if (Number.isFinite(aNum) && Number.isFinite(bNum) && aNum !== bNum) {
            return aNum - bNum;
        }
        if (aPart !== bPart) return aPart.localeCompare(bPart);
    }
    return 0;
}

/**
 * Returns true if version `a` is strictly newer than `b`, treating build metadata as a
 * tie-breaker when the semver core (major.minor.patch[-pre]) is identical.
 * This is necessary because semver.gt ignores build metadata per the semver spec, but
 * PyPI normalises 4+ segment versions (e.g. 3.0.3.260530) into build metadata, so
 * comparing `3.0.3+260530` against `3.0.3` with semver.gt would incorrectly return false.
 */
export function isNewerVersion(a: string, b: string): boolean {
    if (semver.gt(a, b)) return true;
    if (semver.lt(a, b)) return false;
    // Same semver core: use build metadata as tie-breaker.
    const aBuild = semver.parse(a)?.build ?? [];
    const bBuild = semver.parse(b)?.build ?? [];
    return compareBuildPartsAsc(aBuild, bBuild) > 0;
}

export function getLatestInMajor(allVersions: string[], currentVersion: string): string | null {
    if (!allVersions || !currentVersion) {
        return null;
    }

    const cleanCurrent = extractComparableVersion(currentVersion);
    if (!cleanCurrent) {
        return null;
    }

    const currentMajor = semver.major(cleanCurrent);

    let latest: string | null = null;
    for (const version of allVersions) {
        if (
            semver.major(version) === currentMajor &&
            isNewerVersion(version, cleanCurrent) &&
            !semver.prerelease(version) &&
            (!latest || isNewerVersion(version, latest))
        ) {
            latest = version;
        }
    }

    return latest;
}

export function isValidVersion(allVersions: string[], currentVersion: string): boolean {
    if (!allVersions || !currentVersion) {
        return true;
    } // Can't validate
    const cleanCurrent = extractComparableVersion(currentVersion);
    if (!cleanCurrent) {
        return true;
    } // logic fallback, maybe valid but unparseable?

    // We expect cleanCurrent to be in allVersions
    return allVersions.includes(cleanCurrent);
}
