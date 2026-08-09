import * as vscode from 'vscode';
import { fetchPackageMetadata } from '../core/pypi';
import { Dependency } from '../core/types';
import { extractComparableVersion, getLatestInMajor, isNewerVersion } from '../core/versions';

export function activateHover(
    context: vscode.ExtensionContext,
    getDependencies: (document: vscode.TextDocument) => Dependency[],
    isEnabled: () => boolean,
) {
    context.subscriptions.push(
        vscode.languages.registerHoverProvider('toml', {
            provideHover: async (document, position, token) => {
                if (!isEnabled() || !document.fileName.endsWith('pyproject.toml')) {
                    return;
                }

                const deps = getDependencies(document);

                const dep = deps.find(
                    (d) =>
                        d.line === position.line &&
                        position.character >= d.nameStartCol &&
                        position.character <= d.endCol,
                );

                if (!dep) {
                    return null;
                }

                const metadata = await fetchPackageMetadata(dep.name);
                if (!metadata || token.isCancellationRequested || !isEnabled()) {
                    return null;
                }

                const md = new vscode.MarkdownString();
                md.isTrusted = { enabledCommands: ['python-dependency-manager.updateDependency'] };

                md.appendMarkdown(`**${metadata.name}** \n\n`);
                md.appendMarkdown(`${metadata.summary}\n\n`);
                md.appendMarkdown(`Current: \`${dep.version}\`\n\n`);
                // Display the original PyPI version string instead of the normalized form
                const displayLatest = metadata.originalVersions[metadata.latestStable] || metadata.latestStable;
                md.appendMarkdown(`Latest: \`${displayLatest}\`\n\n`);

                if (metadata.homePage) {
                    md.appendMarkdown(`[Homepage](${metadata.homePage})`);
                    md.appendMarkdown(' | ');
                }
                if (metadata.documentationUrl) {
                    md.appendMarkdown(`[Docs](${metadata.documentationUrl})`);
                    md.appendMarkdown(' | ');
                }
                if (metadata.changelogUrl) {
                    md.appendMarkdown(`[Changelog](${metadata.changelogUrl})`);
                }
                md.appendMarkdown('\n\n--- \n\n');

                // Update Actions
                // We need to construct valid new specs.
                // If current is "^2.31.0", and latest is "2.32.0", we probably want "^2.32.0".
                // If current is "==2.31.0", we want "==2.32.0".
                // If current is "2.31.0", we want "2.32.0".

                const prefix = dep.version.match(/^([\^~>=<]+)/)?.[1] || '';
                // If exact version "2.31.0" (no prefix), prefix is empty.

                const commandArgs = (newVer: string) => {
                    const finalVer = prefix + newVer; // simplistic preservation
                    return encodeURIComponent(
                        JSON.stringify([document.uri.toString(), dep.line, dep.startCol, dep.endCol, finalVer]),
                    );
                };

                const makeCommand = (title: string, version: string) => {
                    // Use the original PyPI version string in the command
                    const originalVersion = metadata.originalVersions[version] || version;
                    return `[${title}](command:python-dependency-manager.updateDependency?${commandArgs(originalVersion)})`;
                };

                const currentComparable = extractComparableVersion(dep.version);

                // Buttons
                if (currentComparable && isNewerVersion(metadata.latestStable, currentComparable)) {
                    const displayLatestStable =
                        metadata.originalVersions[metadata.latestStable] || metadata.latestStable;
                    md.appendMarkdown(makeCommand(`Update to ${displayLatestStable}`, metadata.latestStable));
                    md.appendMarkdown('&nbsp;&nbsp;'); // Spacing
                }

                // Latest Minor Button (if major update is available)
                if (metadata.allVersions) {
                    const latestInMajor = getLatestInMajor(metadata.allVersions, dep.version);

                    // Show if distinct from global latest stable
                    if (latestInMajor && latestInMajor !== metadata.latestStable) {
                        // Check strictly > current logic is inside getLatestInMajor, but helpful to double check?
                        // getLatestInMajor ensures it is gt current.
                        if (currentComparable && isNewerVersion(latestInMajor, currentComparable)) {
                            const displayLatestInMajor = metadata.originalVersions[latestInMajor] || latestInMajor;
                            md.appendMarkdown(makeCommand(`Update to ${displayLatestInMajor}`, latestInMajor));
                        }
                    }
                }

                const hover = new vscode.Hover(md);
                hover.range = new vscode.Range(dep.line, dep.nameStartCol, dep.line, dep.endCol);
                return hover;
            },
        }),
    );
}
