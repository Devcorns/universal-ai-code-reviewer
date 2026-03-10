/** False-positive filter — applies path exclusion, confidence threshold,
 *  framework-awareness, and user whitelist filtering to review issues. */

import { ReviewIssue, ReviewerConfig } from './issueTypes.js';
import { FrameworkDetector } from './frameworkPatterns.js';

/** Directories that should never be analyzed */
const ALWAYS_EXCLUDED_DIRS = ['node_modules', 'dist', 'build', '.git'];

/** Extended reviewer config with false-positive reduction options */
export interface FalsePositiveConfig {
    /** Minimum confidence (0-1) to report an issue. Default: 0.6 */
    confidenceThreshold: number;
    /** Function / identifier names to never flag */
    whitelistedFunctions: string[];
    /** Regex pattern strings to never flag */
    whitelistedPatterns: string[];
    /** Frameworks to always enable (e.g. ["angular", "react", "node"]) */
    enableFrameworks: string[];
    /** Minimum duplicate block size in lines */
    minDuplicateLines: number;
}

const DEFAULT_FP_CONFIG: FalsePositiveConfig = {
    confidenceThreshold: 0.6,
    whitelistedFunctions: [],
    whitelistedPatterns: [],
    enableFrameworks: [],
    minDuplicateLines: 5
};

/** Check if a file path falls inside an always-excluded directory */
export function isExcludedPath(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/');
    for (const dir of ALWAYS_EXCLUDED_DIRS) {
        if (normalized.includes(`/${dir}/`) || normalized.includes(`/${dir}\\`) ||
            normalized.endsWith(`/${dir}`) || normalized.startsWith(`${dir}/`)) {
            return true;
        }
    }
    return false;
}

export class FalsePositiveFilter {
    private config: FalsePositiveConfig;
    private frameworkDetector: FrameworkDetector;
    private compiledWhitelistPatterns: RegExp[] = [];

    constructor(fpConfig?: Partial<FalsePositiveConfig>) {
        this.config = { ...DEFAULT_FP_CONFIG, ...fpConfig };
        this.frameworkDetector = new FrameworkDetector();
        this.compileWhitelistPatterns();

        if (this.config.enableFrameworks.length > 0) {
            this.frameworkDetector.enableFrameworks(this.config.enableFrameworks);
        }
    }

    /** Update configuration at runtime */
    updateConfig(fpConfig: Partial<FalsePositiveConfig>): void {
        this.config = { ...DEFAULT_FP_CONFIG, ...fpConfig };
        this.compileWhitelistPatterns();
        this.frameworkDetector.reset();
        if (this.config.enableFrameworks.length > 0) {
            this.frameworkDetector.enableFrameworks(this.config.enableFrameworks);
        }
    }

    /** Get the framework detector for pre-scanning content */
    getFrameworkDetector(): FrameworkDetector {
        return this.frameworkDetector;
    }

    /** Get configured minimum duplicate lines */
    getMinDuplicateLines(): number {
        return this.config.minDuplicateLines;
    }

    /** Get confidence threshold */
    getConfidenceThreshold(): number {
        return this.config.confidenceThreshold;
    }

    /** Filter a set of issues, removing false positives */
    filterIssues(issues: ReviewIssue[], content: string, language: string): ReviewIssue[] {
        const lines = content.split('\n');
        return issues.filter(issue => {
            // 1. Confidence threshold
            if (issue.confidence < this.config.confidenceThreshold) {
                return false;
            }

            // 2. Whitelisted function names
            if (this.isWhitelistedFunction(lines, issue)) {
                return false;
            }

            // 3. Whitelisted patterns
            if (this.matchesWhitelistPattern(lines, issue)) {
                return false;
            }

            // 4. Framework-aware suppression
            if (issue.ruleId && issue.line > 0) {
                const lineText = lines[issue.line - 1] || '';
                if (this.frameworkDetector.shouldSuppress(lineText, issue.ruleId, language)) {
                    return false;
                }
            }

            return true;
        });
    }

    private isWhitelistedFunction(lines: string[], issue: ReviewIssue): boolean {
        if (this.config.whitelistedFunctions.length === 0) { return false; }

        const lineText = lines[issue.line - 1] || '';
        for (const fn of this.config.whitelistedFunctions) {
            if (lineText.includes(fn)) { return true; }
        }
        return false;
    }

    private matchesWhitelistPattern(lines: string[], issue: ReviewIssue): boolean {
        if (this.compiledWhitelistPatterns.length === 0) { return false; }

        const lineText = lines[issue.line - 1] || '';
        for (const rx of this.compiledWhitelistPatterns) {
            if (rx.test(lineText)) { return true; }
        }
        return false;
    }

    private compileWhitelistPatterns(): void {
        this.compiledWhitelistPatterns = [];
        for (const p of this.config.whitelistedPatterns) {
            try {
                this.compiledWhitelistPatterns.push(new RegExp(p));
            } catch {
                // skip invalid patterns
            }
        }
    }
}
