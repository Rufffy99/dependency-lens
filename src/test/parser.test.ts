import * as assert from 'assert';
import { parsePyProject } from '../core/parser';

describe('PyProject Parser', () => {
    it('should parse PEP 621 dependencies', () => {
        const content = `
[project]
name = "demo"
dependencies = [
    "requests==2.31.0",
    "flask>=2.0"
]
`;
        const deps = parsePyProject(content);
        assert.strictEqual(deps.length, 2);

        const requests = deps.find((d) => d.name === 'requests');
        assert.ok(requests);
        assert.strictEqual(requests?.version, '==2.31.0');
        // Check columns.
        // "requests==2.31.0" (line 4). Indent 4.
        // Line content: '    "requests==2.31.0",'
        // " starts at index 4.
        // requests starts at index 5. Length 8.
        // ==2.31.0 starts at index 13.
        // We expect startCol to be 13, NOT 5.
        // But our parser logic uses `line.indexOf(t.name)`.
        // t.name here in the test logic earlier was the FULL string "requests==2.31.0".
        // With current logic: t.name is "requests", t.version is "==2.31.0".
        // Test needs to reflect the change in parser output.

        // Spec Col check
        // "requests==2.31.0"
        // name="requests" (len 8)
        // spec="==2.31.0"
        // Indent 4 + 1 quote = 5.
        // name start: 5
        // spec start: 13
        assert.strictEqual(requests?.nameStartCol, 5);
        assert.strictEqual(requests?.startCol, 13);
        assert.strictEqual(requests?.source, 'project');

        const flask = deps.find((d) => d.name === 'flask');
        assert.ok(flask);
        assert.strictEqual(flask?.version, '>=2.0');
    });

    it('should parse Poetry dependencies', () => {
        const content = `
[tool.poetry.dependencies]
python = "^3.10"
requests = "^2.31.0"
flask = { version = "3.0.0" }
`;
        const deps = parsePyProject(content);
        // Should skip python
        assert.strictEqual(deps.length, 2);

        const requests = deps.find((d) => d.name === 'requests');
        assert.strictEqual(requests?.version, '^2.31.0');

        const flask = deps.find((d) => d.name === 'flask');
        assert.strictEqual(flask?.version, '3.0.0');
    });

    it('should parse Poetry groups', () => {
        const content = `
[tool.poetry.group.dev.dependencies]
pytest = "^7.0"
black = "23.1.0"
`;
        const deps = parsePyProject(content);
        assert.strictEqual(deps.length, 2);

        const pytest = deps.find((d) => d.name === 'pytest');
        assert.strictEqual(pytest?.version, '^7.0');
        assert.strictEqual(pytest?.source, 'poetry-group');
    });

    it('should locate lines correctly (basic)', () => {
        const content = `
[tool.poetry.dependencies]
requests = "^2.31.0"
`;
        const deps = parsePyProject(content);
        const req = deps[0];
        assert.strictEqual(req.line, 2); // 0-indexed, so line 3 is index 2
    });

    it('should parse project.optional-dependencies', () => {
        const content = `
[project.optional-dependencies]

dev = [
  "pytest==7.4.3",
  "pytest-cov>=4.1.0"
]

docs = [
  "mkdocs==1.5.3"
]
`;
        const deps = parsePyProject(content);
        // pytest, pytest-cov, mkdocs
        assert.strictEqual(deps.length, 3);

        const pytest = deps.find((d) => d.name === 'pytest');
        assert.ok(pytest, 'pytest not found');
        assert.strictEqual(pytest?.version, '==7.4.3');
        assert.strictEqual(pytest?.source, 'project');

        const mkdocs = deps.find((d) => d.name === 'mkdocs');
        assert.ok(mkdocs, 'mkdocs not found');
        assert.strictEqual(mkdocs?.version, '==1.5.3');
    });
});
