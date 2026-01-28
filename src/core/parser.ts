import * as toml from '@iarna/toml';
import { Dependency } from './types';

export function parsePyProject(text: string): Dependency[] {
    const dependencies: Dependency[] = [];

    // 1. Structural Parse to validate and get raw values
    let parsed: Record<string, any>; // TOML parse returns any structure
    try {
        parsed = toml.parse(text);
    } catch (e) {
        console.error('Failed to parse TOML:', e);
        return [];
    }

    const lines = text.split('\n');
    let currentSection = '';

    // Targets: { name, version, source, sectionPrefix }
    // sectionPrefix helps us match the line to the correct section logic
    const targets: {
        name: string;
        version: string;
        source: Dependency['source'];
        sectionPrefix: string;
    }[] = [];

    // PEP 621: [project.dependencies]
    if (parsed.project && Array.isArray(parsed.project.dependencies)) {
        parsed.project.dependencies.forEach((dep: string) => {
            targets.push({ name: dep, version: dep, source: 'project', sectionPrefix: 'project' });
        });
    }

    // PEP 621: [project.optional-dependencies]
    // These are lists under keys. e.g. dev = ["..."]
    if (parsed.project && parsed.project['optional-dependencies']) {
        Object.entries(parsed.project['optional-dependencies']).forEach(([, deps]) => {
            if (Array.isArray(deps)) {
                deps.forEach((dep: string) => {
                    targets.push({
                        name: dep,
                        version: dep,
                        source: 'project',
                        sectionPrefix: 'project.optional-dependencies',
                    });
                });
            }
        });
    }

    // Poetry: [tool.poetry.dependencies]
    if (parsed.tool && parsed.tool.poetry && parsed.tool.poetry.dependencies) {
        Object.entries(parsed.tool.poetry.dependencies).forEach(([name, val]) => {
            if (name === 'python') {
                return;
            }
            let version = '';
            if (typeof val === 'string') {
                version = val;
            } else if (typeof val === 'object' && val !== null && 'version' in val) {
                version = (val as any).version;
            }
            if (version) {
                targets.push({ name, version, source: 'poetry', sectionPrefix: 'tool.poetry.dependencies' });
            }
        });
    }

    // Poetry Groups: [tool.poetry.group.<name>.dependencies]
    if (parsed.tool && parsed.tool.poetry && parsed.tool.poetry.group) {
        Object.values(parsed.tool.poetry.group).forEach((group: any) => {
            if (group.dependencies) {
                // We don't track the exact group name in prompt, but we need to match the section in text.
                // We'll mark these as generic 'poetry-group' source.
                Object.entries(group.dependencies).forEach(([name, val]) => {
                    let version = '';
                    if (typeof val === 'string') {
                        version = val;
                    } else if (typeof val === 'object' && val !== null && 'version' in val) {
                        version = (val as any).version;
                    }
                    if (version) {
                        targets.push({ name, version, source: 'poetry-group', sectionPrefix: 'tool.poetry.group' });
                    }
                });
            }
        });
    }

    const SECTION_REGEX = /^\[(.+)\]$/;

    // Helper to extract name/version from list items like "requests==1.0.0"
    function parseListItem(fullString: string): { name: string; spec: string } | null {
        // Naive split: letters/numbers/dot/dash/underscore is name. Rest is spec.
        const match = fullString.match(/^([a-zA-Z0-9_.-]+)(.*)$/);
        if (match) {
            return { name: match[1], spec: match[2] };
        }
        return null;
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('#')) {
            continue;
        }

        const sectionMatch = line.match(SECTION_REGEX);
        if (sectionMatch) {
            currentSection = sectionMatch[1];
            continue;
        }

        // 1. [project] dependencies AND [project.optional-dependencies]
        // These are lists. The lines look like strings: "pkg>=1.0",
        if (currentSection === 'project' || currentSection.startsWith('project.optional-dependencies')) {
            // Find targets that match this line string.
            // targets.name is the FULL string "requests>=1.0" for these types.
            targets.forEach((t) => {
                if (t.source !== 'project') {
                    return;
                }

                // If it's a simple string match
                // We check if line contains it quoted.
                if (line.includes(`"${t.name}"`) || line.includes(`'${t.name}'`)) {
                    const parsedItem = parseListItem(t.name);
                    if (parsedItem) {
                        const contentIdx = lines[i].indexOf(t.name);
                        if (contentIdx !== -1) {
                            // "requests==1.0.0" -> name="requests", spec="==1.0.0"
                            // contentIdx points to start of "requests".
                            // We want startCol to point to "==1.0.0".
                            // Offset = name.length
                            const specStartCol = contentIdx + parsedItem.name.length;

                            dependencies.push({
                                name: parsedItem.name,
                                version: parsedItem.spec,
                                line: i,
                                startCol: specStartCol,
                                endCol: contentIdx + t.name.length, // End of the full string
                                nameStartCol: contentIdx, // Start of name
                                nameEndCol: specStartCol, // End of name
                                source: 'project',
                            });
                        }
                    }
                }
            });
        }

        // 2. Poetry key-values
        // [tool.poetry.dependencies] or [tool.poetry.group.dev.dependencies]
        // Matches if currentSection starts with...

        // Optimize: check if we are in a relevant section first
        const isPoetryDep = currentSection.startsWith('tool.poetry.dependencies');
        const isPoetryGroup = currentSection.startsWith('tool.poetry.group');

        if (isPoetryDep || isPoetryGroup) {
            targets.forEach((t) => {
                const targetSource = t.source;
                // Filtering based on strict section scope
                if (isPoetryDep && t.sectionPrefix !== 'tool.poetry.dependencies') {
                    return;
                }
                if (isPoetryGroup && t.sectionPrefix !== 'tool.poetry.group') {
                    return;
                }

                // key = value
                const keyRegex = new RegExp(`^${escapeRegExp(t.name)}\\s*=`);
                if (keyRegex.test(line)) {
                    const versionIdx = lines[i].indexOf(t.version);
                    const nameIdx = lines[i].indexOf(t.name); // Simple find for MVP

                    if (versionIdx !== -1) {
                        dependencies.push({
                            name: t.name,
                            version: t.version,
                            line: i,
                            startCol: versionIdx,
                            endCol: versionIdx + t.version.length,
                            nameStartCol: nameIdx !== -1 ? nameIdx : 0, // Fallback
                            nameEndCol: nameIdx !== -1 ? nameIdx + t.name.length : 0,
                            source: targetSource,
                        });
                    }
                }
            });
        }
    }

    return dependencies;
}

function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
