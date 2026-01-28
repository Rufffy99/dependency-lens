import * as assert from 'assert';
import { getLatestInMajor, isValidVersion } from '../core/versions';

describe('Advanced Version Logic', () => {
    const allVersions = ['1.0.0', '1.1.0', '1.9.0', '2.0.0', '2.1.0'];

    it('should find latest in major', () => {
        const latestInfo = getLatestInMajor(allVersions, '1.0.0');
        assert.strictEqual(latestInfo, '1.9.0');
    });

    it('should return null if already latest in major', () => {
        const latestInfo = getLatestInMajor(allVersions, '1.9.0');
        assert.strictEqual(latestInfo, null);
    });

    it('should return null if no newer version in major', () => {
        // 2.1.0 is latest 2.x
        const latestInfo = getLatestInMajor(allVersions, '2.1.0');
        assert.strictEqual(latestInfo, null);
    });

    it('should return null if jumping to next major', () => {
        // 2.0.0 is available, but if we are on 2.0.0, there is nothing "in major" that is newer unless 2.1.0 exists.
        // If we are on 1.9.0, latest in major is null (1.9.0 is max).
        const latestInfo = getLatestInMajor(allVersions, '1.9.0');
        assert.strictEqual(latestInfo, null);
    });

    it('should validate versions correctly', () => {
        assert.strictEqual(isValidVersion(allVersions, '1.1.0'), true);
        assert.strictEqual(isValidVersion(allVersions, '1.5.0'), false); // Not in list
        assert.strictEqual(isValidVersion(allVersions, '2.1.0'), true);
    });

    it('should handle unparseable versions gracefully', () => {
        assert.strictEqual(isValidVersion(allVersions, 'git+https://...'), true); // Falls back to true
    });
});
