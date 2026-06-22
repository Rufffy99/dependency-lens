import * as assert from 'assert';
import { buildPackageMetadataFromPyPI, normalizePyPIVersion } from '../core/pypi';

describe('PyPI Metadata', () => {
    it('should normalize pep440 prerelease tags', () => {
        assert.strictEqual(normalizePyPIVersion('1.2.3a1'), '1.2.3-alpha.1');
        assert.strictEqual(normalizePyPIVersion('1.2.3b2'), '1.2.3-beta.2');
        assert.strictEqual(normalizePyPIVersion('1.2.3rc3'), '1.2.3-rc.3');
    });

    it('should ignore yanked-only releases', () => {
        const metadata = buildPackageMetadataFromPyPI({
            info: { name: 'demo', summary: 'demo package' },
            releases: {
                '1.0.0': [{ yanked: true }],
                '1.0.1': [{ yanked: false }],
            },
        });

        assert.strictEqual(metadata.latestStable, '1.0.1');
        assert.deepStrictEqual(metadata.allVersions, ['1.0.1']);
    });

    it('should deterministically order 4+ segment versions', () => {
        const metadata = buildPackageMetadataFromPyPI({
            info: { name: 'demo', summary: 'demo package' },
            releases: {
                '3.0.3.260529': [{ yanked: false }],
                '3.0.3.260530': [{ yanked: false }],
                '3.0.3.260528': [{ yanked: false }],
            },
        });

        assert.strictEqual(metadata.latestStable, '3.0.3+260530');
        assert.deepStrictEqual(metadata.allVersions, ['3.0.3+260530', '3.0.3+260529', '3.0.3+260528']);
    });
});
