import * as semver from 'semver';
import { VersionStatus } from './types';

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

    const cleanCurrent = semver.coerce(currentSpec)?.version;

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

export function getLatestInMajor(allVersions: string[], currentVersion: string): string | null {
    if (!allVersions || !currentVersion) {
        return null;
    }

    const cleanCurrent = semver.coerce(currentVersion)?.version;
    if (!cleanCurrent) {
        return null;
    }

    const currentMajor = semver.major(cleanCurrent);

    // Find all satisfying versions
    const candidates = allVersions.filter(
        (v) => semver.major(v) === currentMajor && semver.gt(v, cleanCurrent) && !semver.prerelease(v),
    );

    if (candidates.length === 0) {
        return null;
    }

    // Return the largest
    // Sort descending just to be safe, then take first
    candidates.sort(semver.rcompare);

    return candidates[0];
}

export function isValidVersion(allVersions: string[], currentVersion: string): boolean {
    if (!allVersions || !currentVersion) {
        return true;
    } // Can't validate
    const cleanCurrent = semver.coerce(currentVersion)?.version;
    if (!cleanCurrent) {
        return true;
    } // logic fallback, maybe valid but unparseable?

    // We expect cleanCurrent to be in allVersions
    return allVersions.includes(cleanCurrent);
}
