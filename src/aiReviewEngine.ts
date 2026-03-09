/** AI-assisted contextual code review engine using heuristic analysis */

import { ReviewIssue, IssueSeverity, IssueCategory } from './issueTypes.js';

export class AiReviewEngine {
    analyze(filePath: string, content: string, language: string): ReviewIssue[] {
        const issues: ReviewIssue[] = [];
        const lines = content.split('\n');

        this.analyzeErrorHandlingPatterns(filePath, content, lines, language, issues);
        this.analyzeCodeDuplication(filePath, lines, issues);
        this.analyzeEdgeCaseHandling(filePath, lines, language, issues);
        this.analyzeConcurrencyPatterns(filePath, lines, language, issues);
        this.analyzeResourceManagement(filePath, content, lines, language, issues);

        return issues;
    }

    /** Check for functions that lack error handling on risky operations */
    private analyzeErrorHandlingPatterns(filePath: string, content: string, lines: string[], language: string, issues: ReviewIssue[]): void {
        // Detect JSON.parse without try-catch
        if (language === 'javascript' || language === 'typescript') {
            for (let i = 0; i < lines.length; i++) {
                if (/JSON\.parse\s*\(/.test(lines[i])) {
                    if (!this.isWithinTryCatch(lines, i)) {
                        issues.push({
                            file: filePath,
                            line: i + 1,
                            severity: IssueSeverity.Medium,
                            category: IssueCategory.PoorErrorHandling,
                            message: 'JSON.parse() without try-catch — will throw on invalid JSON',
                            explanation: 'JSON.parse() throws a SyntaxError if the input is not valid JSON. Without a try-catch, this will crash the application.',
                            suggestedFix: 'Wrap JSON.parse() in a try-catch block and handle the error gracefully.',
                            confidence: 0.75,
                            ruleId: 'ai/json-parse-no-try'
                        });
                    }
                }
            }

            // Detect parseInt without radix
            for (let i = 0; i < lines.length; i++) {
                if (/parseInt\s*\(\s*\w+\s*\)/.test(lines[i]) && !/parseInt\s*\(\s*\w+\s*,/.test(lines[i])) {
                    issues.push({
                        file: filePath,
                        line: i + 1,
                        severity: IssueSeverity.Low,
                        category: IssueCategory.MissingEdgeCase,
                        message: 'parseInt() called without radix parameter',
                        explanation: 'Without a radix, parseInt may interpret strings with leading zeros differently across environments.',
                        suggestedFix: 'Always provide a radix: parseInt(value, 10).',
                        confidence: 0.8,
                        ruleId: 'ai/parseint-radix'
                    });
                }
            }
        }

        // Detect async functions without error handling
        if (language === 'javascript' || language === 'typescript') {
            const asyncFuncRegex = /async\s+(?:function\s+)?(\w+)/g;
            let match;
            while ((match = asyncFuncRegex.exec(content)) !== null) {
                const lineIdx = content.substring(0, match.index).split('\n').length - 1;
                const funcBody = this.extractFunctionBody(lines, lineIdx);
                if (funcBody.includes('await') && !funcBody.includes('try') && !funcBody.includes('.catch')) {
                    issues.push({
                        file: filePath,
                        line: lineIdx + 1,
                        severity: IssueSeverity.Medium,
                        category: IssueCategory.PoorErrorHandling,
                        message: `Async function "${match[1]}" uses await but has no error handling`,
                        explanation: 'Await expressions can throw rejected promise errors. Without try-catch, these propagate as unhandled rejections.',
                        suggestedFix: 'Wrap await calls in try-catch blocks.',
                        confidence: 0.65,
                        ruleId: 'ai/async-no-error-handling'
                    });
                }
            }
        }
    }

    /** Detect repeated code blocks that could be refactored */
    private analyzeCodeDuplication(filePath: string, lines: string[], issues: ReviewIssue[]): void {
        const BLOCK_SIZE = 4;
        const MIN_LINE_LENGTH = 20;
        const seen = new Map<string, number>();

        for (let i = 0; i <= lines.length - BLOCK_SIZE; i++) {
            const block = lines.slice(i, i + BLOCK_SIZE)
                .map(l => l.trim())
                .filter(l => l.length >= MIN_LINE_LENGTH && !l.startsWith('//') && !l.startsWith('#') && !l.startsWith('*') && l !== '{' && l !== '}');

            if (block.length < BLOCK_SIZE - 1) { continue; }

            const key = block.join('\n');
            const prev = seen.get(key);
            if (prev !== undefined) {
                issues.push({
                    file: filePath,
                    line: i + 1,
                    severity: IssueSeverity.Low,
                    category: IssueCategory.BadPractice,
                    message: `Duplicate code block (also at line ${prev + 1})`,
                    explanation: 'Duplicated code increases maintenance burden and bug risk — changes must be replicated in all copies.',
                    suggestedFix: 'Extract the duplicated logic into a reusable function or method.',
                    confidence: 0.6,
                    ruleId: 'ai/code-duplication'
                });
            } else {
                seen.set(key, i);
            }
        }
    }

    /** Detect missing edge case handling */
    private analyzeEdgeCaseHandling(filePath: string, lines: string[], language: string, issues: ReviewIssue[]): void {
        for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();

            // Switch without default
            if (/\bswitch\s*\(/.test(trimmed)) {
                const body = this.extractFunctionBody(lines, i);
                if (!body.includes('default:') && !body.includes('default :')) {
                    issues.push({
                        file: filePath,
                        line: i + 1,
                        severity: IssueSeverity.Medium,
                        category: IssueCategory.MissingEdgeCase,
                        message: 'Switch statement without default case',
                        explanation: 'A switch without a default case may silently ignore unexpected values.',
                        suggestedFix: 'Add a default case to handle unexpected values, even if just logging or throwing.',
                        confidence: 0.7,
                        ruleId: 'ai/switch-no-default'
                    });
                }
            }

            // Array destructuring without length check
            if ((language === 'javascript' || language === 'typescript') && /(?:const|let)\s*\[.+\]\s*=/.test(trimmed)) {
                // Check if there's a length check nearby
                const context = lines.slice(Math.max(0, i - 3), i).join('\n');
                if (!context.includes('.length') && !context.includes('if (')) {
                    issues.push({
                        file: filePath,
                        line: i + 1,
                        severity: IssueSeverity.Low,
                        category: IssueCategory.MissingEdgeCase,
                        message: 'Array destructuring without length validation',
                        explanation: 'Destructuring an array without checking its length may result in undefined values.',
                        suggestedFix: 'Verify the array has enough elements before destructuring, or provide defaults.',
                        confidence: 0.4,
                        ruleId: 'ai/destructure-no-check'
                    });
                }
            }
        }
    }

    /** Detect concurrency issues */
    private analyzeConcurrencyPatterns(filePath: string, lines: string[], language: string, issues: ReviewIssue[]): void {
        // Sequential awaits that could be parallelized
        if (language === 'javascript' || language === 'typescript') {
            for (let i = 0; i < lines.length - 1; i++) {
                const current = lines[i].trim();
                const next = lines[i + 1]?.trim() || '';
                if (/^\s*(?:const|let|var)\s+\w+\s*=\s*await\b/.test(current) && /^\s*(?:const|let|var)\s+\w+\s*=\s*await\b/.test(next)) {
                    issues.push({
                        file: filePath,
                        line: i + 1,
                        severity: IssueSeverity.Medium,
                        category: IssueCategory.PerformanceBottleneck,
                        message: 'Sequential awaits that may be parallelizable',
                        explanation: 'Consecutive await statements run in sequence. If they are independent, running in parallel would be faster.',
                        suggestedFix: 'Use Promise.all([promise1, promise2]) to run independent async operations concurrently.',
                        confidence: 0.5,
                        ruleId: 'ai/sequential-awaits'
                    });
                }
            }
        }

        // Shared state in Go goroutines
        if (language === 'go') {
            for (let i = 0; i < lines.length; i++) {
                if (/\bgo\s+(?:func|(\w+))\s*\(/.test(lines[i])) {
                    issues.push({
                        file: filePath,
                        line: i + 1,
                        severity: IssueSeverity.Medium,
                        category: IssueCategory.ConcurrencyProblem,
                        message: 'Goroutine launched — verify no shared state mutation',
                        explanation: 'Goroutines accessing shared variables without synchronization create data races.',
                        suggestedFix: 'Use channels, sync.Mutex, or sync/atomic for safe concurrent access.',
                        confidence: 0.4,
                        ruleId: 'ai/goroutine-shared-state'
                    });
                }
            }
        }
    }

    /** Detect resource management issues */
    private analyzeResourceManagement(filePath: string, content: string, lines: string[], language: string, issues: ReviewIssue[]): void {
        // Check for setInterval without cleanup
        if (language === 'javascript' || language === 'typescript') {
            if (content.includes('setInterval(') && !content.includes('clearInterval(')) {
                const lineIdx = lines.findIndex(l => l.includes('setInterval('));
                if (lineIdx >= 0) {
                    issues.push({
                        file: filePath,
                        line: lineIdx + 1,
                        severity: IssueSeverity.Medium,
                        category: IssueCategory.ResourceLeak,
                        message: 'setInterval() without corresponding clearInterval()',
                        explanation: 'Intervals that are never cleared continue running and can cause memory leaks.',
                        suggestedFix: 'Store the interval ID and call clearInterval() in cleanup/destroy logic.',
                        confidence: 0.6,
                        ruleId: 'ai/interval-leak'
                    });
                }
            }

            // Check for setTimeout in what appears to be a loop (potential memory issue)
            for (let i = 0; i < lines.length; i++) {
                if (/\bsetTimeout\s*\(/.test(lines[i])) {
                    const context = lines.slice(Math.max(0, i - 5), i).join('\n');
                    if (/\b(?:for|while|forEach|map)\b/.test(context)) {
                        issues.push({
                            file: filePath,
                            line: i + 1,
                            severity: IssueSeverity.Medium,
                            category: IssueCategory.PerformanceBottleneck,
                            message: 'setTimeout() inside a loop — may create many pending timers',
                            explanation: 'Creating timeouts in a loop can cause a burst of concurrent executions.',
                            suggestedFix: 'Consider using incremental delays or a queue-based approach.',
                            confidence: 0.5,
                            ruleId: 'ai/timeout-in-loop'
                        });
                    }
                }
            }
        }

        // Python: file open without with statement
        if (language === 'python') {
            for (let i = 0; i < lines.length; i++) {
                const trimmed = lines[i].trim();
                if (/^\w+\s*=\s*open\s*\(/.test(trimmed) && !trimmed.startsWith('with ')) {
                    issues.push({
                        file: filePath,
                        line: i + 1,
                        severity: IssueSeverity.High,
                        category: IssueCategory.ResourceLeak,
                        message: 'File opened without "with" statement — may not be closed properly',
                        explanation: 'Opening files without a "with" statement risks leaving file handles open if exceptions occur.',
                        suggestedFix: 'Use "with open(filename) as f:" to ensure automatic cleanup.',
                        confidence: 0.8,
                        ruleId: 'ai/file-no-with'
                    });
                }
            }
        }
    }

    /** Check if a line is within a try-catch block */
    private isWithinTryCatch(lines: string[], lineIdx: number): boolean {
        for (let i = lineIdx; i >= Math.max(0, lineIdx - 20); i--) {
            if (/\btry\s*\{/.test(lines[i]) || lines[i].trim() === 'try:' || lines[i].trim() === 'try {') {
                return true;
            }
        }
        return false;
    }

    /** Extract the body of a function/block starting at a given line */
    private extractFunctionBody(lines: string[], startIdx: number): string {
        let depth = 0;
        let foundOpen = false;
        const bodyLines: string[] = [];

        for (let i = startIdx; i < Math.min(lines.length, startIdx + 200); i++) {
            bodyLines.push(lines[i]);
            for (const ch of lines[i]) {
                if (ch === '{') { depth++; foundOpen = true; }
                if (ch === '}') { depth--; }
                if (foundOpen && depth === 0) {
                    return bodyLines.join('\n');
                }
            }
        }
        return bodyLines.join('\n');
    }
}
