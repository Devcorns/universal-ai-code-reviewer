/** Review controller — VS Code integration layer */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ReviewerEngine } from './reviewerEngine.js';
import { ReportGenerator } from './reportGenerator.js';
import { GitIntegration } from './gitIntegration.js';
import { ReviewIssue, ReviewResult, ReviewerConfig, IssueSeverity, IssueCategory, CustomRule } from './issueTypes.js';
import { isSupportedFile, getSupportedExtensions } from './languageDetector.js';

const DIAGNOSTIC_SOURCE = 'Universal AI Code Reviewer';
const IGNORE_FILE = '.codereviewerignore';
const CONFIG_FILE = 'codereviewer.config.json';

export class ReviewController implements vscode.CodeActionProvider, vscode.Disposable {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private statusBarItem: vscode.StatusBarItem;
    private outputChannel: vscode.OutputChannel;
    private engine: ReviewerEngine;
    private reportGenerator: ReportGenerator;
    private disposables: vscode.Disposable[] = [];
    private lastResults: ReviewResult[] = [];
    private ignoredPatterns: string[] = [];

    // Map diagnostics to issues for code actions
    private diagnosticIssueMap = new Map<string, ReviewIssue>();

    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('universalReviewer');
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.outputChannel = vscode.window.createOutputChannel('Code Reviewer');
        this.reportGenerator = new ReportGenerator();

        const config = this.loadConfig();
        this.engine = new ReviewerEngine(config);

        this.statusBarItem.text = '$(pass) Code Reviewer';
        this.statusBarItem.tooltip = 'Universal AI Code Reviewer — Click to review current file';
        this.statusBarItem.command = 'universalReviewer.reviewCurrentFile';
        this.statusBarItem.show();

        this.loadIgnorePatterns();
    }

    dispose(): void {
        this.diagnosticCollection.dispose();
        this.statusBarItem.dispose();
        this.outputChannel.dispose();
        for (const d of this.disposables) { d.dispose(); }
    }

    /** Register all commands and providers */
    register(context: vscode.ExtensionContext): void {
        context.subscriptions.push(
            vscode.commands.registerCommand('universalReviewer.reviewCurrentFile', () => this.reviewCurrentFile()),
            vscode.commands.registerCommand('universalReviewer.reviewWorkspace', () => this.reviewWorkspace()),
            vscode.commands.registerCommand('universalReviewer.reviewFolder', (uri: vscode.Uri) => this.reviewFolder(uri)),
            vscode.commands.registerCommand('universalReviewer.reviewGitChanged', () => this.reviewGitChanged()),
            vscode.commands.registerCommand('universalReviewer.reviewGitStaged', () => this.reviewGitStaged()),
            vscode.commands.registerCommand('universalReviewer.generateReport', () => this.generateReport()),
            vscode.languages.registerCodeActionsProvider({ scheme: 'file' }, this, {
                providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
            }),
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('universalReviewer')) {
                    this.engine.updateConfig(this.loadConfig());
                }
            }),
            this.diagnosticCollection,
            this.statusBarItem,
            this.outputChannel
        );
    }

    // === Code Action Provider ===

    provideCodeActions(document: vscode.TextDocument, range: vscode.Range, context: vscode.CodeActionContext): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];

        for (const diagnostic of context.diagnostics) {
            if (diagnostic.source !== DIAGNOSTIC_SOURCE) { continue; }

            const key = `${document.uri.fsPath}:${diagnostic.range.start.line}:${diagnostic.message}`;
            const issue = this.diagnosticIssueMap.get(key);
            if (!issue) { continue; }

            const fix = new vscode.CodeAction(
                `Fix: ${issue.suggestedFix.substring(0, 80)}`,
                vscode.CodeActionKind.QuickFix
            );
            fix.diagnostics = [diagnostic];
            fix.isPreferred = true;

            // Provide concrete fixes for specific categories
            const edit = this.createAutoFix(document, diagnostic, issue);
            if (edit) {
                fix.edit = edit;
            }

            actions.push(fix);
        }

        return actions;
    }

    // === Review Commands ===

    private async reviewCurrentFile(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active file to review.');
            return;
        }
        const doc = editor.document;
        if (!isSupportedFile(doc.fileName)) {
            vscode.window.showInformationMessage(`File type not supported for review: ${path.extname(doc.fileName)}`);
            return;
        }

        this.setStatus('reviewing');
        this.outputChannel.appendLine(`\n--- Reviewing: ${doc.fileName} ---`);

        const content = doc.getText();
        const result = this.engine.reviewFile(doc.fileName, content);
        this.lastResults = [result];
        this.applyDiagnostics(doc.uri, result);

        this.outputChannel.appendLine(`Found ${result.issues.length} issues in ${result.duration}ms`);
        this.setStatus('done', result.issues.length);
        vscode.window.showInformationMessage(`Code Review: ${result.issues.length} issue(s) found in ${path.basename(doc.fileName)}`);
    }

    private async reviewWorkspace(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showWarningMessage('No workspace folder open.');
            return;
        }

        await this.reviewFiles(workspaceFolders[0].uri);
    }

    private async reviewFolder(uri?: vscode.Uri): Promise<void> {
        if (!uri) {
            const folder = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: 'Select Folder to Review'
            });
            if (!folder || folder.length === 0) { return; }
            uri = folder[0];
        }

        await this.reviewFiles(uri);
    }

    private async reviewGitChanged(): Promise<void> {
        const root = this.getWorkspaceRoot();
        if (!root) { return; }

        const git = new GitIntegration(root);
        if (!(await git.isGitRepo())) {
            vscode.window.showWarningMessage('Current workspace is not a Git repository.');
            return;
        }

        const changedFiles = await git.getChangedFiles();
        if (changedFiles.length === 0) {
            vscode.window.showInformationMessage('No changed files found.');
            return;
        }

        await this.reviewFileList(changedFiles, 'Git Changed Files');
    }

    private async reviewGitStaged(): Promise<void> {
        const root = this.getWorkspaceRoot();
        if (!root) { return; }

        const git = new GitIntegration(root);
        if (!(await git.isGitRepo())) {
            vscode.window.showWarningMessage('Current workspace is not a Git repository.');
            return;
        }

        const stagedFiles = await git.getStagedFiles();
        if (stagedFiles.length === 0) {
            vscode.window.showInformationMessage('No staged files found.');
            return;
        }

        await this.reviewFileList(stagedFiles, 'Git Staged Files');
    }

    private async generateReport(): Promise<void> {
        if (this.lastResults.length === 0) {
            vscode.window.showWarningMessage('No review results available. Run a review first.');
            return;
        }

        const root = this.getWorkspaceRoot();
        if (!root) { return; }

        const totalDuration = this.lastResults.reduce((sum, r) => sum + r.duration, 0);
        const summary = this.reportGenerator.buildSummary(path.basename(root), this.lastResults, totalDuration);

        const config = vscode.workspace.getConfiguration('universalReviewer');
        const formats: string[] = config.get('reportFormat', ['markdown', 'json', 'text']);

        const written: string[] = [];

        if (formats.includes('markdown')) {
            const md = this.reportGenerator.generateMarkdown(summary);
            const filePath = path.join(root, 'code-review-report.md');
            fs.writeFileSync(filePath, md, 'utf-8');
            written.push('code-review-report.md');
        }

        if (formats.includes('json')) {
            const json = this.reportGenerator.generateJson(summary);
            const filePath = path.join(root, 'code-review-report.json');
            fs.writeFileSync(filePath, json, 'utf-8');
            written.push('code-review-report.json');
        }

        if (formats.includes('text')) {
            const txt = this.reportGenerator.generateText(summary);
            const filePath = path.join(root, 'code-review-report.txt');
            fs.writeFileSync(filePath, txt, 'utf-8');
            written.push('code-review-report.txt');
        }

        vscode.window.showInformationMessage(`Review reports generated: ${written.join(', ')}`);
        this.outputChannel.appendLine(`\nReports written: ${written.join(', ')}`);

        // Open the markdown report
        if (formats.includes('markdown')) {
            const mdUri = vscode.Uri.file(path.join(root, 'code-review-report.md'));
            await vscode.window.showTextDocument(mdUri, { preview: true });
        }
    }

    // === Internal Helpers ===

    private async reviewFiles(folderUri: vscode.Uri): Promise<void> {
        this.setStatus('scanning');
        this.outputChannel.appendLine(`\n=== Scanning: ${folderUri.fsPath} ===`);

        const extensions = getSupportedExtensions();
        const pattern = `**/*{${extensions.join(',')}}`;
        const files = await vscode.workspace.findFiles(
            new vscode.RelativePattern(folderUri, pattern),
            this.buildExcludePattern()
        );

        if (files.length === 0) {
            vscode.window.showInformationMessage('No supported files found.');
            this.setStatus('done', 0);
            return;
        }

        const filePaths = files
            .map(f => f.fsPath)
            .filter(f => !this.isIgnored(f));

        await this.reviewFileList(filePaths, path.basename(folderUri.fsPath));
    }

    private async reviewFileList(filePaths: string[], label: string): Promise<void> {
        const results: ReviewResult[] = [];
        let totalIssues = 0;

        this.diagnosticCollection.clear();
        this.diagnosticIssueMap.clear();

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Code Review: ${label}`,
                cancellable: true
            },
            async (progress, token) => {
                for (let i = 0; i < filePaths.length; i++) {
                    if (token.isCancellationRequested) { break; }

                    const filePath = filePaths[i];
                    const fileName = path.basename(filePath);
                    progress.report({
                        message: `${fileName} (${i + 1}/${filePaths.length})`,
                        increment: (100 / filePaths.length)
                    });

                    try {
                        const content = fs.readFileSync(filePath, 'utf-8');
                        // Skip very large files
                        if (content.length > 500_000) {
                            this.outputChannel.appendLine(`Skipped (too large): ${filePath}`);
                            continue;
                        }

                        const result = this.engine.reviewFile(filePath, content);
                        results.push(result);
                        totalIssues += result.issues.length;

                        const uri = vscode.Uri.file(filePath);
                        this.applyDiagnostics(uri, result);

                        if (result.issues.length > 0) {
                            this.outputChannel.appendLine(`${fileName}: ${result.issues.length} issue(s) [${result.duration}ms]`);
                        }
                    } catch (err) {
                        this.outputChannel.appendLine(`Error reviewing ${filePath}: ${err}`);
                    }
                }
            }
        );

        this.lastResults = results;
        this.setStatus('done', totalIssues);

        const msg = `Code Review complete: ${totalIssues} issue(s) found across ${results.length} file(s)`;
        this.outputChannel.appendLine(`\n${msg}`);

        if (totalIssues > 0) {
            const action = await vscode.window.showInformationMessage(msg, 'View Problems', 'Generate Report');
            if (action === 'View Problems') {
                vscode.commands.executeCommand('workbench.action.problems.focus');
            } else if (action === 'Generate Report') {
                this.generateReport();
            }
        } else {
            vscode.window.showInformationMessage(msg);
        }
    }

    private applyDiagnostics(uri: vscode.Uri, result: ReviewResult): void {
        const diagnostics: vscode.Diagnostic[] = [];

        for (const issue of result.issues) {
            const line = Math.max(0, issue.line - 1);
            const endLine = issue.endLine ? Math.max(0, issue.endLine - 1) : line;
            const range = new vscode.Range(line, issue.column || 0, endLine, issue.endColumn || Number.MAX_SAFE_INTEGER);

            const diagnostic = new vscode.Diagnostic(
                range,
                `${issue.message} [${issue.category}]`,
                this.severityToDiagnosticSeverity(issue.severity)
            );
            diagnostic.source = DIAGNOSTIC_SOURCE;
            diagnostic.code = issue.ruleId || issue.category;

            diagnostics.push(diagnostic);

            // Store for code actions
            const key = `${uri.fsPath}:${line}:${diagnostic.message}`;
            this.diagnosticIssueMap.set(key, issue);
        }

        this.diagnosticCollection.set(uri, diagnostics);
    }

    private createAutoFix(document: vscode.TextDocument, diagnostic: vscode.Diagnostic, issue: ReviewIssue): vscode.WorkspaceEdit | undefined {
        const edit = new vscode.WorkspaceEdit();
        const line = diagnostic.range.start.line;
        const lineText = document.lineAt(line).text;

        switch (issue.category) {
            case IssueCategory.UnusedVariable: {
                // Remove the entire line
                const range = document.lineAt(line).rangeIncludingLineBreak;
                edit.delete(document.uri, range);
                return edit;
            }
            case IssueCategory.BadPractice: {
                // var -> const
                if (issue.ruleId === 'ast/no-var') {
                    const newText = lineText.replace(/\bvar\b/, 'const');
                    edit.replace(document.uri, document.lineAt(line).range, newText);
                    return edit;
                }
                break;
            }
            case IssueCategory.LogicalBug: {
                // == -> ===
                if (issue.ruleId === 'ast/strict-equality') {
                    const newText = lineText.replace(/([^!=<>])={2}([^=])/, '$1===$2');
                    edit.replace(document.uri, document.lineAt(line).range, newText);
                    return edit;
                }
                break;
            }
            case IssueCategory.PoorErrorHandling: {
                // Add try-catch around JSON.parse
                if (issue.ruleId === 'ai/json-parse-no-try') {
                    const indent = lineText.match(/^(\s*)/)?.[1] || '';
                    const wrapped = `${indent}try {\n${lineText}\n${indent}} catch (e) {\n${indent}    console.error('JSON parse error:', e);\n${indent}}`;
                    edit.replace(document.uri, document.lineAt(line).range, wrapped);
                    return edit;
                }
                break;
            }
        }

        return undefined;
    }

    private setStatus(state: 'reviewing' | 'scanning' | 'done', issueCount?: number): void {
        switch (state) {
            case 'reviewing':
                this.statusBarItem.text = '$(loading~spin) Reviewing...';
                this.statusBarItem.backgroundColor = undefined;
                break;
            case 'scanning':
                this.statusBarItem.text = '$(loading~spin) Scanning workspace...';
                this.statusBarItem.backgroundColor = undefined;
                break;
            case 'done':
                if (issueCount && issueCount > 0) {
                    this.statusBarItem.text = `$(warning) ${issueCount} issue(s)`;
                    this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
                } else {
                    this.statusBarItem.text = '$(pass) No issues';
                    this.statusBarItem.backgroundColor = undefined;
                }
                break;
        }
    }

    private loadConfig(): ReviewerConfig {
        const vsConfig = vscode.workspace.getConfiguration('universalReviewer');
        const workspaceRoot = this.getWorkspaceRoot();

        let customRules: CustomRule[] = [];
        if (workspaceRoot) {
            const configPath = path.join(workspaceRoot, CONFIG_FILE);
            if (fs.existsSync(configPath)) {
                try {
                    const raw = fs.readFileSync(configPath, 'utf-8');
                    const parsed = JSON.parse(raw);
                    customRules = parsed.customRules || [];
                } catch (err) {
                    this.outputChannel.appendLine(`Error loading ${CONFIG_FILE}: ${err}`);
                }
            }
        }

        return {
            maxFunctionLength: vsConfig.get('maxFunctionLength', 50),
            maxCyclomaticComplexity: vsConfig.get('maxCyclomaticComplexity', 10),
            forbiddenFunctions: vsConfig.get('forbiddenFunctions', ['eval', 'exec']),
            ignorePaths: vsConfig.get('ignorePaths', ['node_modules', 'dist', 'build', '.git']),
            customRules,
            severityThreshold: vsConfig.get('severityThreshold', 'Low') as IssueSeverity
        };
    }

    private loadIgnorePatterns(): void {
        const root = this.getWorkspaceRoot();
        if (!root) { return; }

        const ignorePath = path.join(root, IGNORE_FILE);
        if (fs.existsSync(ignorePath)) {
            try {
                const content = fs.readFileSync(ignorePath, 'utf-8');
                this.ignoredPatterns = content
                    .split('\n')
                    .map(l => l.trim())
                    .filter(l => l.length > 0 && !l.startsWith('#'));
            } catch {
                // Ignore file read errors
            }
        }
    }

    private isIgnored(filePath: string): boolean {
        const config = this.loadConfig();
        const normalizedPath = filePath.replace(/\\/g, '/');

        // Check VS Code config ignore paths
        for (const ignore of config.ignorePaths) {
            if (normalizedPath.includes(`/${ignore}/`) || normalizedPath.includes(`\\${ignore}\\`)) {
                return true;
            }
        }

        // Check .codereviewerignore patterns
        for (const pattern of this.ignoredPatterns) {
            if (pattern.startsWith('*.')) {
                // File extension pattern
                if (filePath.endsWith(pattern.substring(1))) { return true; }
            } else if (normalizedPath.includes(pattern)) {
                return true;
            }
        }

        return false;
    }

    private buildExcludePattern(): string {
        const config = this.loadConfig();
        return `{${config.ignorePaths.map(p => `**/${p}/**`).join(',')}}`;
    }

    private getWorkspaceRoot(): string | undefined {
        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }

    private severityToDiagnosticSeverity(severity: IssueSeverity): vscode.DiagnosticSeverity {
        switch (severity) {
            case IssueSeverity.Critical: return vscode.DiagnosticSeverity.Error;
            case IssueSeverity.High: return vscode.DiagnosticSeverity.Error;
            case IssueSeverity.Medium: return vscode.DiagnosticSeverity.Warning;
            case IssueSeverity.Low: return vscode.DiagnosticSeverity.Information;
        }
    }
}
