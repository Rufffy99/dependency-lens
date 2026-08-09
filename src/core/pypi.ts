import fetch from 'node-fetch';
import { PackageMetadata } from './types';
import * as semver from 'semver';

interface CacheEntry {
    data: PackageMetadata | null;
    timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<PackageMetadata | null>>();
const requestControllers = new Set<AbortController>();
const requestQueue: Array<() => void> = [];
const CACHE_TTL = 30 * 60 * 1000;
const FAILED_CACHE_TTL = 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_CONCURRENT_REQUESTS = 6;
let activeRequests = 0;
let requestGeneration = 0;

function normalizePackageName(packageName: string): string {
    // PEP 503 package names are case-insensitive and collapse runs of '-', '_' and '.'.
    return packageName
        .trim()
        .toLowerCase()
        .replace(/[-_.]+/g, '-');
}

async function withRequestSlot<T>(operation: () => Promise<T>): Promise<T> {
    if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
        await new Promise<void>((resolve) => requestQueue.push(resolve));
    }

    activeRequests++;
    try {
        return await operation();
    } finally {
        activeRequests--;
        requestQueue.shift()?.();
    }
}

export function normalizePyPIVersion(version: string): string | null {
    const normalized = version.trim();

    if (semver.valid(normalized)) {
        return normalized;
    }

    const pep440Match = normalized.match(/^(\d+)\.(\d+)(?:\.(\d+))?(?:(a|b|rc)(\d+))?$/i);
    if (pep440Match) {
        const major = pep440Match[1];
        const minor = pep440Match[2];
        const patch = pep440Match[3] ?? '0';
        const preTag = pep440Match[4]?.toLowerCase();
        const preNumber = pep440Match[5];

        if (!preTag) {
            return `${major}.${minor}.${patch}`;
        }

        const semverPreTag = preTag === 'a' ? 'alpha' : preTag === 'b' ? 'beta' : 'rc';
        return `${major}.${minor}.${patch}-${semverPreTag}.${preNumber}`;
    }

    // Keep numeric 4+ segment versions (e.g. 3.0.3.260530) comparable by using build metadata.
    const numericSegments = normalized.match(/^(\d+)\.(\d+)\.(\d+)(?:\.(\d+))+$/);
    if (numericSegments) {
        const segments = normalized.split('.');
        const [major, minor, patch, ...rest] = segments;
        return `${major}.${minor}.${patch}+${rest.join('.')}`;
    }

    // PEP 440 post-releases (e.g. 1.0.0.post1) are newer than the base release.
    // Map to build metadata so the build-part comparator preserves the ordering.
    const postReleaseMatch = normalized.match(/^(\d+)\.(\d+)(?:\.(\d+))?\.post(\d+)$/i);
    if (postReleaseMatch) {
        const major = postReleaseMatch[1];
        const minor = postReleaseMatch[2];
        const patch = postReleaseMatch[3] ?? '0';
        const postNum = postReleaseMatch[4];
        return `${major}.${minor}.${patch}+post.${postNum}`;
    }

    // PEP 440 dev-releases (e.g. 1.0.0.dev1) are pre-release candidates below the base.
    // Map to semver pre-release so they are excluded from latestStable.
    const devReleaseMatch = normalized.match(/^(\d+)\.(\d+)(?:\.(\d+))?\.dev(\d+)$/i);
    if (devReleaseMatch) {
        const major = devReleaseMatch[1];
        const minor = devReleaseMatch[2];
        const patch = devReleaseMatch[3] ?? '0';
        const devNum = devReleaseMatch[4];
        return `${major}.${minor}.${patch}-dev.${devNum}`;
    }

    return null;
}

function compareBuildPartsDesc(aBuild: readonly string[], bBuild: readonly string[]): number {
    const len = Math.max(aBuild.length, bBuild.length);
    for (let i = 0; i < len; i++) {
        const aPart = aBuild[i];
        const bPart = bBuild[i];

        if (aPart === undefined) {
            return 1;
        }
        if (bPart === undefined) {
            return -1;
        }

        const aNum = Number(aPart);
        const bNum = Number(bPart);
        const bothNumeric = Number.isFinite(aNum) && Number.isFinite(bNum);

        if (bothNumeric && aNum !== bNum) {
            return bNum - aNum;
        }

        if (aPart !== bPart) {
            return bPart.localeCompare(aPart);
        }
    }

    return 0;
}

type PyPIJson = {
    info?: {
        name?: string;
        summary?: string;
        home_page?: string;
        docs_url?: string;
        project_urls?: Record<string, string | undefined>;
    };
    releases?: Record<string, Array<{ yanked?: boolean }>>;
};

export function buildPackageMetadataFromPyPI(data: PyPIJson): PackageMetadata {
    const info = data.info || {};
    const releases = Object.entries(data.releases || {}).filter(([, files]) => {
        if (!Array.isArray(files) || files.length === 0) {
            return false;
        }

        // PyPI can expose versions with only yanked files. Ignore those.
        return files.some((file) => !file?.yanked);
    });

    // Filter and sort versions.
    // Precompute parsed SemVer objects and build metadata once per version so the sort
    // comparator avoids repeated semver.parse calls on every comparison.
    // Also track the original PyPI version string for each normalized version.
    interface VersionEntry {
        original: string; // Original version from PyPI (e.g. "3.0.3.260530")
        normalized: string; // Normalized version (e.g. "3.0.3+260530")
        parsed: semver.SemVer | null;
        build: readonly string[];
    }

    const originalVersionsMap: Record<string, string> = {};

    const versionEntries: VersionEntry[] = Array.from(new Set(releases.map(([v]) => v)))
        .map((original) => {
            const normalized = normalizePyPIVersion(original);
            if (!normalized) return null;
            originalVersionsMap[normalized] = original;
            const parsed = semver.parse(normalized);
            return { original, normalized, parsed, build: parsed?.build ?? [] };
        })
        .filter((e): e is VersionEntry => e !== null);

    versionEntries.sort((a, b) => {
        const semverCmp = semver.rcompare(a.parsed ?? a.normalized, b.parsed ?? b.normalized);
        if (semverCmp !== 0) {
            return semverCmp;
        }
        const buildCmp = compareBuildPartsDesc(a.build, b.build);
        if (buildCmp !== 0) {
            return buildCmp;
        }
        return b.normalized.localeCompare(a.normalized);
    });

    const validVersions = versionEntries.map((e) => e.normalized);

    const latestStable = validVersions.find((v) => !semver.prerelease(v)) || validVersions[0] || '0.0.0';
    const latestPrerelease = validVersions.find((v) => semver.prerelease(v));

    return {
        name: info.name || '',
        summary: info.summary || '',
        latestStable,
        latestPrerelease,
        allVersions: validVersions,
        originalVersions: originalVersionsMap,
        homePage: info.home_page,
        documentationUrl: info.project_urls?.Documentation || info.docs_url,
        changelogUrl: info.project_urls?.Changelog || info.project_urls?.['Release notes'],
    };
}

export async function fetchPackageMetadata(packageName: string): Promise<PackageMetadata | null> {
    const normalizedName = normalizePackageName(packageName);
    const now = Date.now();
    const cached = cache.get(normalizedName);
    const cacheTtl = cached?.data ? CACHE_TTL : FAILED_CACHE_TTL;
    if (cached && now - cached.timestamp < cacheTtl) {
        return cached.data;
    }

    const existingRequest = inFlightRequests.get(normalizedName);
    if (existingRequest) {
        return existingRequest;
    }

    const generation = requestGeneration;
    const request = withRequestSlot(async () => {
        if (generation !== requestGeneration) {
            return null;
        }

        const controller = new AbortController();
        requestControllers.add(controller);
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
            const response = await fetch(`https://pypi.org/pypi/${encodeURIComponent(normalizedName)}/json`, {
                signal: controller.signal,
            });
            if (!response.ok) {
                console.warn(`Failed to fetch metadata for ${normalizedName}: ${response.statusText}`);
                cache.set(normalizedName, { data: null, timestamp: Date.now() });
                return null;
            }

            const data = (await response.json()) as PyPIJson;
            const metadata = buildPackageMetadataFromPyPI(data);

            cache.set(normalizedName, { data: metadata, timestamp: Date.now() });
            return metadata;
        } catch (error) {
            if (controller.signal.aborted) {
                return null;
            }
            console.error(`Error fetching package ${normalizedName}:`, error);
            cache.set(normalizedName, { data: null, timestamp: Date.now() });
            return null;
        } finally {
            clearTimeout(timeout);
            requestControllers.delete(controller);
        }
    });

    inFlightRequests.set(normalizedName, request);
    try {
        return await request;
    } finally {
        if (inFlightRequests.get(normalizedName) === request) {
            inFlightRequests.delete(normalizedName);
        }
    }
}

/** Stops active requests and prevents queued requests from starting. */
export function cancelPendingPackageRequests(): void {
    requestGeneration++;
    requestControllers.forEach((controller) => controller.abort());
    inFlightRequests.clear();
}
