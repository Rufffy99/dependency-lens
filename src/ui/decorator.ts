import * as vscode from 'vscode';
import { parsePyProject } from '../core/parser';
import { fetchPackageMetadata } from '../core/pypi';
import { compareVersions, getLatestInMajor, isValidVersion } from '../core/versions';
import * as semver from 'semver';

let decorationType: vscode.TextEditorDecorationType;

export function activateDecorations(context: vscode.ExtensionContext) {
    decorationType = vscode.window.createTextEditorDecorationType({
        after: {
            margin: '0 0 0 10px',
            fontStyle: 'italic',
        },
    });

    let activeEditor = vscode.window.activeTextEditor;
    let timeout: NodeJS.Timeout | undefined = undefined;

    function updateDecorations() {
        if (!activeEditor || activeEditor.document.fileName.endsWith('package.json')) {
            return;
        }
        // Only trigger for pyproject.toml
        if (!activeEditor.document.fileName.endsWith('pyproject.toml')) {
            return;
        }

        const text = activeEditor.document.getText();
        const dependencies = parsePyProject(text);

        // We need to fetch versions for all deps.
        // This is async. We can't await in the main loop easily for all of them linearly.
        // We will fire off requests and re-update when they come back?
        // Or better: parallel fetch and update all at once.

        // Loading state?
        // For MVP, we'll just try to fetch all, and apply decorations when ready.
        // To avoid flickering, we might apply cached ones immediately?
        // Let's do a simple Promise.all for MVP.

        Promise.all(
            dependencies.map(async (dep) => {
                const metadata = await fetchPackageMetadata(dep.name);
                if (!metadata) {
                    return null;
                }

                const status = compareVersions(dep.version, metadata.latestStable);

                if (status.type === 'latest') {
                    return null;
                } // No decoration if up to date

                // Validation: Check if version exists
                if (!isValidVersion(metadata.allVersions || [], dep.version)) {
                    return {
                        range: new vscode.Range(dep.line, Number.MAX_SAFE_INTEGER, dep.line, Number.MAX_SAFE_INTEGER),
                        renderOptions: {
                            after: {
                                contentText: ` \u26A0 Version not found`,
                                color: '#e6a23c', // Warning Orange
                                margin: '0 0 0 2em',
                            },
                        },
                    };
                }

                // Color logic
                let color = 'rgba(100, 100, 100, 0.7)'; // Default grey
                if (status.type === 'major') {
                    color = '#ff4d4f';
                } // Red
                if (status.type === 'minor') {
                    color = '#faad14';
                } // Yellow
                if (status.type === 'patch') {
                    color = '#52c41a';
                } // Green
                if (status.type === 'prerelease') {
                    color = '#eb2f96';
                } // Pink

                // Message
                let contentText = ` \u2192 ${status.latest}`; // right arrow

                // Check for major update alternative
                if (status.type === 'major' && metadata.allVersions) {
                    const latestInMajor = getLatestInMajor(metadata.allVersions, dep.version);

                    if (latestInMajor) {
                        const cleanCurrent = semver.coerce(dep.version)?.version || dep.version;
                        const diffType = semver.diff(cleanCurrent, latestInMajor);
                        const label = diffType === 'patch' || diffType === 'prepatch' ? 'Latest Patch' : 'Latest Minor';
                        contentText = ` \u2192 ${status.latest} (${label}: ${latestInMajor})`;
                    }
                }

                return {
                    range: new vscode.Range(dep.line, Number.MAX_SAFE_INTEGER, dep.line, Number.MAX_SAFE_INTEGER), // End of line
                    renderOptions: {
                        after: {
                            contentText: contentText,
                            color: color,
                            margin: '0 0 0 2em',
                        },
                    },
                } as vscode.DecorationOptions;
            }),
        ).then((results) => {
            if (activeEditor) {
                activeEditor.setDecorations(
                    decorationType,
                    results.filter((r): r is vscode.DecorationOptions => r !== null),
                );
            }
        });
    }

    function triggerUpdateDecorations(throttle = false) {
        if (timeout) {
            clearTimeout(timeout);
            timeout = undefined;
        }
        if (throttle) {
            timeout = setTimeout(updateDecorations, 500);
        } else {
            updateDecorations();
        }
    }

    if (activeEditor) {
        triggerUpdateDecorations();
    }

    vscode.window.onDidChangeActiveTextEditor(
        (editor) => {
            activeEditor = editor;
            if (editor) {
                triggerUpdateDecorations();
            }
        },
        null,
        context.subscriptions,
    );

    vscode.workspace.onDidChangeTextDocument(
        (event) => {
            if (activeEditor && event.document === activeEditor.document) {
                triggerUpdateDecorations(true);
            }
        },
        null,
        context.subscriptions,
    );
}
