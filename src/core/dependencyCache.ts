import * as vscode from 'vscode';
import { parsePyProject } from './parser';
import { Dependency } from './types';

interface CachedDependencies {
    version: number;
    dependencies: Dependency[];
}

/** Shares parsed dependency data between decorations and hover providers. */
export class DependencyCache implements vscode.Disposable {
    private readonly documents = new Map<string, CachedDependencies>();
    private readonly closeSubscription: vscode.Disposable;

    constructor() {
        this.closeSubscription = vscode.workspace.onDidCloseTextDocument((document) => {
            this.documents.delete(document.uri.toString());
        });
    }

    get(document: vscode.TextDocument): Dependency[] {
        const key = document.uri.toString();
        const cached = this.documents.get(key);

        if (cached?.version === document.version) {
            return cached.dependencies;
        }

        const dependencies = parsePyProject(document.getText());
        this.documents.set(key, { version: document.version, dependencies });
        return dependencies;
    }

    dispose(): void {
        this.closeSubscription.dispose();
        this.documents.clear();
    }
}
