export interface Dependency {
    name: string;
    version: string;
    line: number;
    startCol: number;
    endCol: number;
    nameStartCol: number;
    nameEndCol: number;
    source: 'project' | 'poetry' | 'poetry-group';
}

export interface PackageMetadata {
    name: string;
    summary: string;
    latestStable: string;
    latestPrerelease?: string;
    latestInMajor?: string; // Latest version strictly within the current major version
    allVersions: string[]; // Sorted list of all versions (descending)
    homePage?: string;
    documentationUrl?: string;
    changelogUrl?: string;
}

export interface VersionStatus {
    current: string;
    latest: string;
    type: 'major' | 'minor' | 'patch' | 'prerelease' | 'latest';
}
