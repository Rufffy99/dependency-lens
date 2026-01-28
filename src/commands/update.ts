import * as vscode from 'vscode';

export function registerUpdateCommand(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'python-dependency-manager.updateDependency',
            async (uriStr: string, line: number, startCol: number, endCol: number, newVersion: string) => {
                const uri = vscode.Uri.parse(uriStr);
                const edit = new vscode.WorkspaceEdit();

                // We are replacing the *value* of the version string.
                // But we need to be careful about quotes if we replace inside them.
                // The `startCol` and `endCol` from parser.ts include the quotes if we parsed the full string,
                // or just the content if we were careful.
                // Let's re-verify parser.ts logic:
                // For poetry: `versionIdx` points to the start of the value string. `endCol` is `+ t.version.length`.
                // So if `t.version` is `^2.31.0`, we replace `^2.31.0` with `^2.32.0`.
                // Wait, we want to update the version number, but keep the constraint type?
                // User requirement: "Update to latest patch... Update to latest minor..."
                // Usually this means updating the number but keeping the operator if compatible?
                // "Updating changes ONLY the relevant version spec".

                // Simpler: Just replace the content with `newVersion` (which we will construct in Hover to include the operator if needed, or just the raw number if replacing exact).
                // Actually, usually users want "requests==2.32.0" -> "requests==2.32.1".
                // Or "^2.31.0" -> "^2.32.0".
                // We should pass the *full new spec string* to this command.

                const range = new vscode.Range(line, startCol, line, endCol);
                edit.replace(uri, range, newVersion);

                await vscode.workspace.applyEdit(edit);
            },
        ),
    );
}
