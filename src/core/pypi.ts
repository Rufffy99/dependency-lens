import fetch from 'node-fetch';
import { PackageMetadata } from './types';
import * as semver from 'semver';

interface CacheEntry {
    data: PackageMetadata;
    timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export async function fetchPackageMetadata(packageName: string): Promise<PackageMetadata | null> {
    const now = Date.now();
    const cached = cache.get(packageName);
    if (cached && now - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    try {
        const response = await fetch(`https://pypi.org/pypi/${packageName}/json`);
        if (!response.ok) {
            console.warn(`Failed to fetch metadata for ${packageName}: ${response.statusText}`);
            return null;
        }

        const data = (await response.json()) as any;
        const info = data.info;
        const releases = Object.keys(data.releases || {});

        // Filter and sort versions
        // We use semver to sort.
        const validVersions = releases
            .map((v) => (semver.valid(v) ? v : semver.coerce(v)?.version))
            .filter((v): v is string => !!v);
        validVersions.sort(semver.rcompare); // Descending order (Latest first)

        const latestStable = validVersions.find((v) => !semver.prerelease(v)) || validVersions[0];
        const latestPrerelease = validVersions.find((v) => semver.prerelease(v));

        const metadata: PackageMetadata = {
            name: info.name,
            summary: info.summary || '',
            latestStable: latestStable || '0.0.0',
            latestPrerelease: latestPrerelease,
            allVersions: validVersions,
            homePage: info.home_page,
            documentationUrl: info.project_urls?.Documentation || info.docs_url,
            changelogUrl: info.project_urls?.Changelog || info.project_urls?.['Release notes'],
        };

        cache.set(packageName, { data: metadata, timestamp: now });
        return metadata;
    } catch (e) {
        console.error(`Error fetching package ${packageName}:`, e);
        return null;
    }
}
