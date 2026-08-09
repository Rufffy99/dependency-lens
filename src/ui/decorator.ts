import * as vscode from 'vscode';
import * as semver from 'semver';
import { fetchPackageMetadata } from '../core/pypi';
import { Dependency, PackageMetadata } from '../core/types';
import { compareVersions, extractComparableVersion, getLatestInMajor, isValidVersion } from '../core/versions';

const UPDATE_DELAY_MS = 750;

export interface DecorationController extends vscode.Disposable {
    setEnabled(enabled: boolean): void;
    refresh(): void;
}

function isPyProject(document: vscode.TextDocument): boolean {
    return document.fileName.endsWith('pyproject.toml');
}

function createDecoration(dep: Dependency, metadata: PackageMetadata): vscode.DecorationOptions | null {
    const status = compareVersions(dep.version, metadata.latestStable);

    if (status.type === 'latest') {
        return null;
    }

    if (!isValidVersion(metadata.allVersions, dep.version)) {
        return {
            range: new vscode.Range(dep.line, Number.MAX_SAFE_INTEGER, dep.line, Number.MAX_SAFE_INTEGER),
            renderOptions: {
                after: {
                    contentText: ' \u26A0 Version not found',
                    color: '#e6a23c',
                    margin: '0 0 0 2em',
                },
            },
        };
    }

    const colors: Record<Exclude<typeof status.type, 'latest'>, string> = {
        major: '#ff4d4f',
        minor: '#faad14',
        patch: '#52c41a',
        prerelease: '#eb2f96',
    };
    let contentText = ` \u2192 ${metadata.originalVersions[status.latest] || status.latest}`;

    if (status.type === 'major') {
        const latestInMajor = getLatestInMajor(metadata.allVersions, dep.version);
        if (latestInMajor) {
            const cleanCurrent = extractComparableVersion(dep.version);
            const diffType = cleanCurrent ? semver.diff(cleanCurrent, latestInMajor) : null;
            let label = 'Latest in major';
            if (diffType === 'patch' || diffType === 'prepatch') {
                label = 'Latest Patch';
            } else if (diffType === 'minor' || diffType === 'preminor') {
                label = 'Latest Minor';
            }

            const displayLatestInMajor = metadata.originalVersions[latestInMajor] || latestInMajor;
            contentText += ` (${label}: ${displayLatestInMajor})`;
        }
    }

    return {
        range: new vscode.Range(dep.line, Number.MAX_SAFE_INTEGER, dep.line, Number.MAX_SAFE_INTEGER),
        renderOptions: {
            after: {
                contentText,
                color: colors[status.type],
                margin: '0 0 0 2em',
            },
        },
    };
}

export function activateDecorations(
    getDependencies: (document: vscode.TextDocument) => Dependency[],
    initiallyEnabled: boolean,
): DecorationController {
    const decorationType = vscode.window.createTextEditorDecorationType({
        after: {
            margin: '0 0 0 10px',
            fontStyle: 'italic',
        },
    });
    const subscriptions: vscode.Disposable[] = [];
    let activeEditor = vscode.window.activeTextEditor;
    let enabled = initiallyEnabled;
    let timeout: NodeJS.Timeout | undefined;
    let generation = 0;

    function clearDecorations(): void {
        for (const editor of vscode.window.visibleTextEditors) {
            editor.setDecorations(decorationType, []);
        }
    }

    async function updateDecorations(updateGeneration: number): Promise<void> {
        const editor = activeEditor;
        if (!enabled || !editor || !isPyProject(editor.document)) {
            return;
        }

        const documentVersion = editor.document.version;
        const dependencies = getDependencies(editor.document);
        const packageNames = [...new Set(dependencies.map((dependency) => dependency.name))];
        const metadataEntries = await Promise.all(
            packageNames.map(async (name) => [name, await fetchPackageMetadata(name)] as const),
        );

        if (
            !enabled ||
            generation !== updateGeneration ||
            activeEditor !== editor ||
            editor.document.version !== documentVersion
        ) {
            return;
        }

        const metadataByName = new Map(metadataEntries);
        const decorations = dependencies
            .map((dependency) => {
                const metadata = metadataByName.get(dependency.name);
                return metadata ? createDecoration(dependency, metadata) : null;
            })
            .filter((decoration): decoration is vscode.DecorationOptions => decoration !== null);

        editor.setDecorations(decorationType, decorations);
    }

    function scheduleUpdate(delay = false): void {
        generation++;
        const updateGeneration = generation;
        if (timeout) {
            clearTimeout(timeout);
            timeout = undefined;
        }

        if (!enabled) {
            return;
        }

        if (delay) {
            timeout = setTimeout(() => {
                timeout = undefined;
                void updateDecorations(updateGeneration);
            }, UPDATE_DELAY_MS);
        } else {
            void updateDecorations(updateGeneration);
        }
    }

    subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            activeEditor = editor;
            scheduleUpdate();
        }),
        vscode.workspace.onDidChangeTextDocument((event) => {
            if (enabled && activeEditor && event.document === activeEditor.document && isPyProject(event.document)) {
                scheduleUpdate(true);
            }
        }),
    );

    scheduleUpdate();

    return {
        setEnabled(nextEnabled: boolean): void {
            if (enabled === nextEnabled) {
                return;
            }
            enabled = nextEnabled;
            generation++;
            if (timeout) {
                clearTimeout(timeout);
                timeout = undefined;
            }
            clearDecorations();
            if (enabled) {
                scheduleUpdate();
            }
        },
        refresh(): void {
            clearDecorations();
            scheduleUpdate();
        },
        dispose(): void {
            generation++;
            if (timeout) {
                clearTimeout(timeout);
            }
            clearDecorations();
            subscriptions.forEach((subscription) => subscription.dispose());
            decorationType.dispose();
        },
    };
}
