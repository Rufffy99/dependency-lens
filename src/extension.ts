import * as vscode from 'vscode';
import { activateDecorations } from './ui/decorator';
import { activateHover } from './ui/hover';
import { registerUpdateCommand } from './commands/update';

export function activate(context: vscode.ExtensionContext) {
    console.log('PyProject Dependency Manager is now active!');

    activateDecorations(context);
    activateHover(context);
    registerUpdateCommand(context);
}

export function deactivate() {}
