/** Extension entry point — activation and deactivation */

import * as vscode from 'vscode';
import { ReviewController } from './reviewController.js';

let controller: ReviewController | undefined;

export function activate(context: vscode.ExtensionContext): void {
    const outputChannel = vscode.window.createOutputChannel('Code Reviewer');
    outputChannel.appendLine('Universal AI Code Reviewer is now active.');

    controller = new ReviewController();
    controller.register(context);

    context.subscriptions.push(controller);
    outputChannel.appendLine('All commands registered. Ready to review code.');
}

export function deactivate(): void {
    controller?.dispose();
    controller = undefined;
}
