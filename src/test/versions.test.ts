import * as assert from 'assert';
import { compareVersions } from '../core/versions';

describe('Version Comparison', () => {
    it('should detect major updates', () => {
        const status = compareVersions('1.0.0', '2.0.0');
        assert.strictEqual(status.type, 'major');
    });

    it('should detect minor updates', () => {
        const status = compareVersions('1.1.0', '1.2.0');
        assert.strictEqual(status.type, 'minor');
    });

    it('should detect patch updates', () => {
        const status = compareVersions('1.1.0', '1.1.1');
        assert.strictEqual(status.type, 'patch');
    });

    it('should handle carets', () => {
        // defined behavior in implementation: semver.coerce("^1.0.0") -> "1.0.0"
        const status = compareVersions('^1.0.0', '1.1.0');
        assert.strictEqual(status.type, 'minor');
    });

    it('should detect prereleases', () => {
        // Test implicit logic

        // Wait, logic: compareVersions inputs are (current, latestStable, latestPre)
        // Implementation check:
        // if (semver.prerelease(latest)) ...
        // Wait, the implementation of `compareVersions` treats user input `latestStable` as THE stable version.
        // If `latestPrerelease` is provided, we might want to suggest it?
        // My implementation:
        // if (semver.prerelease(latest)) return type: prerelease.
        // But `latest` comes from `latestStable` arg.

        // Let's check `compareVersions` implementation again.
        // export function compareVersions(currentSpec: string, latestStable: string, latestPrerelease?: string)
        // ...
        // const latest = latestStable;

        // If I pass '1.2.0-beta.1' as latestStable, it counts as prerelease.
        const s1 = compareVersions('1.0.0', '1.2.0-beta.1');
        assert.strictEqual(s1.type, 'prerelease');

        // If I pass clean stable:
        const s2 = compareVersions('1.0.0', '1.1.0');
        assert.strictEqual(s2.type, 'minor');
    });
});
