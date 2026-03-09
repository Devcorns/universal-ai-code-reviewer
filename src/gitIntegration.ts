/** Git integration — review changed/staged files */

import * as cp from 'child_process';
import * as path from 'path';

export class GitIntegration {
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    /** Check if the workspace is a git repository */
    async isGitRepo(): Promise<boolean> {
        try {
            await this.exec('git rev-parse --is-inside-work-tree');
            return true;
        } catch {
            return false;
        }
    }

    /** Get list of changed (unstaged + staged) files */
    async getChangedFiles(): Promise<string[]> {
        try {
            const output = await this.exec('git diff --name-only HEAD');
            const untrackedOutput = await this.exec('git ls-files --others --exclude-standard');
            const files = this.parseFileList(output).concat(this.parseFileList(untrackedOutput));
            return [...new Set(files)]; // Deduplicate
        } catch {
            return [];
        }
    }

    /** Get list of staged files only */
    async getStagedFiles(): Promise<string[]> {
        try {
            const output = await this.exec('git diff --cached --name-only');
            return this.parseFileList(output);
        } catch {
            return [];
        }
    }

    /** Get diff of a specific file for PR-style review */
    async getFileDiff(filePath: string): Promise<string> {
        try {
            const relPath = path.relative(this.workspaceRoot, filePath).replace(/\\/g, '/');
            return await this.exec(`git diff HEAD -- "${relPath}"`);
        } catch {
            return '';
        }
    }

    private parseFileList(output: string): string[] {
        return output
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(relPath => path.join(this.workspaceRoot, relPath));
    }

    private exec(command: string): Promise<string> {
        return new Promise((resolve, reject) => {
            cp.exec(command, { cwd: this.workspaceRoot, timeout: 10000 }, (error, stdout) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stdout.toString());
                }
            });
        });
    }
}
