import * as vscode from 'vscode';
import { activateDecorations } from './ui/decorator';
import { activateHover } from './ui/hover';
import { registerUpdateCommand } from './commands/update';
import { DependencyCache } from './core/dependencyCache';
import { cancelPendingPackageRequests } from './core/pypi';

const ENABLED_SETTING = 'enabled';
const CONFIGURATION_SECTION = 'dependencyLens';
const TOGGLE_COMMAND = 'dependencyLens.toggle';

function isPyProjectEditor(editor: vscode.TextEditor | undefined): boolean {
    return Boolean(editor?.document.fileName.endsWith('pyproject.toml'));
}

export function activate(context: vscode.ExtensionContext) {
    const dependencyCache = new DependencyCache();
    const isEnabled = () => vscode.workspace.getConfiguration(CONFIGURATION_SECTION).get(ENABLED_SETTING, true);
    const decorations = activateDecorations((document) => dependencyCache.get(document), isEnabled());
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBar.command = TOGGLE_COMMAND;
    statusBar.name = 'Dependency Lens';

    const updateStatusBar = (): void => {
        if (!isPyProjectEditor(vscode.window.activeTextEditor)) {
            statusBar.hide();
            return;
        }

        const enabled = isEnabled();
        statusBar.text = enabled ? '$(eye) Dependency Lens' : '$(eye-closed) Dependency Lens';
        statusBar.tooltip = enabled
            ? 'Dependency Lens is enabled. Click to disable.'
            : 'Dependency Lens is disabled. Click to enable.';
        statusBar.accessibilityInformation = {
            label: `Dependency Lens is ${enabled ? 'enabled' : 'disabled'}`,
        };
        statusBar.show();
    };

    const applyEnabledState = (): void => {
        const enabled = isEnabled();
        if (!enabled) {
            cancelPendingPackageRequests();
        }
        decorations.setEnabled(enabled);
        updateStatusBar();
    };

    context.subscriptions.push(
        dependencyCache,
        decorations,
        statusBar,
        vscode.commands.registerCommand(TOGGLE_COMMAND, async () => {
            const configuration = vscode.workspace.getConfiguration(CONFIGURATION_SECTION);
            const inspection = configuration.inspect<boolean>(ENABLED_SETTING);
            let target = vscode.ConfigurationTarget.Global;
            if (inspection?.workspaceFolderValue !== undefined) {
                target = vscode.ConfigurationTarget.WorkspaceFolder;
            } else if (inspection?.workspaceValue !== undefined) {
                target = vscode.ConfigurationTarget.Workspace;
            }

            await configuration.update(ENABLED_SETTING, !isEnabled(), target);
        }),
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration(`${CONFIGURATION_SECTION}.${ENABLED_SETTING}`)) {
                applyEnabledState();
            }
        }),
        vscode.window.onDidChangeActiveTextEditor(updateStatusBar),
    );

    activateHover(context, (document) => dependencyCache.get(document), isEnabled);
    registerUpdateCommand(context);
    updateStatusBar();
}

export function deactivate() {}
