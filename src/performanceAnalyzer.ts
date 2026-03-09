/** Performance anti-pattern detection across languages */

import { ReviewIssue, IssueSeverity, IssueCategory, AnalyzerPattern } from './issueTypes.js';

const PERFORMANCE_PATTERNS: AnalyzerPattern[] = [
    // String concatenation in loops
    {
        pattern: /(?:for|while|do)\s*[\s\S]*?\+\s*=\s*['"`]/,
        category: IssueCategory.PerformanceBottleneck,
        severity: IssueSeverity.Medium,
        message: 'String concatenation inside a loop',
        explanation: 'Repeated string concatenation in a loop creates many intermediate string objects, causing poor performance.',
        suggestedFix: 'Use an array with join(), StringBuilder, or template literals instead.',
        confidence: 0.7
    },
    // Nested loops with array methods
    {
        pattern: /\.(?:find|filter|some|every|indexOf|includes)\s*\([\s\S]*?\.(?:find|filter|some|every|indexOf|includes)\s*\(/,
        category: IssueCategory.InefficientLoop,
        severity: IssueSeverity.Medium,
        message: 'Nested array search operations (O(n²) complexity)',
        explanation: 'Nesting array search methods like find/filter/includes creates O(n²) time complexity.',
        suggestedFix: 'Create a Set or Map from one collection first, then use O(1) lookups.',
        confidence: 0.75,
        languages: ['javascript', 'typescript']
    },
    // Regex in loop
    {
        pattern: /(?:for|while)\s*\([\s\S]*?new\s+RegExp\s*\(/,
        category: IssueCategory.UnnecessaryObjectCreation,
        severity: IssueSeverity.Medium,
        message: 'RegExp created inside a loop',
        explanation: 'Creating a new RegExp object in each loop iteration wastes memory and CPU.',
        suggestedFix: 'Move the RegExp creation outside the loop and reuse the compiled pattern.',
        confidence: 0.85
    },
    // Synchronous file I/O in Node.js
    {
        pattern: /\b(?:readFileSync|writeFileSync|appendFileSync|existsSync|mkdirSync|readdirSync|statSync)\s*\(/,
        category: IssueCategory.BlockingIO,
        severity: IssueSeverity.Medium,
        message: 'Synchronous file I/O operation detected',
        explanation: 'Synchronous file operations block the event loop and degrade performance.',
        suggestedFix: 'Use async alternatives: readFile, writeFile, stat, etc. with await.',
        confidence: 0.7,
        languages: ['javascript', 'typescript']
    },
    // Console.log in production
    {
        pattern: /\bconsole\.(log|debug|info|warn|error|trace)\s*\(/,
        category: IssueCategory.PerformanceBottleneck,
        severity: IssueSeverity.Low,
        message: 'Console output statement found',
        explanation: 'Console logging in production code can impact performance and expose information.',
        suggestedFix: 'Use a configurable logging framework instead, or remove before production.',
        confidence: 0.5,
        languages: ['javascript', 'typescript']
    },
    // N+1 query pattern
    {
        pattern: /(?:for|while|\.forEach|\.map)\s*[\s\S]*?(?:\.query\s*\(|\.execute\s*\(|\.find\s*\(|\.findOne\s*\(|await\s+fetch\s*\()/,
        category: IssueCategory.PerformanceBottleneck,
        severity: IssueSeverity.High,
        message: 'Potential N+1 query pattern detected',
        explanation: 'Executing database queries or API calls inside a loop causes N+1 performance issues.',
        suggestedFix: 'Batch queries outside the loop or use JOIN/IN clauses.',
        confidence: 0.7
    },
    // Large object spread in loop
    {
        pattern: /(?:for|while|\.forEach|\.map)\s*[\s\S]*?\{\s*\.\.\./,
        category: IssueCategory.UnnecessaryObjectCreation,
        severity: IssueSeverity.Low,
        message: 'Object spread inside a loop',
        explanation: 'Spreading large objects in each loop iteration creates unnecessary copies.',
        suggestedFix: 'Accumulate changes and apply them once outside the loop.',
        confidence: 0.5,
        languages: ['javascript', 'typescript']
    },
    // SELECT * in SQL
    {
        pattern: /SELECT\s+\*\s+FROM/i,
        category: IssueCategory.PerformanceBottleneck,
        severity: IssueSeverity.Medium,
        message: 'SELECT * query detected',
        explanation: 'Fetching all columns with SELECT * retrieves unnecessary data and prevents index-only scans.',
        suggestedFix: 'Explicitly list only the columns you need.',
        confidence: 0.6
    },
    // Missing index hint — queries without WHERE
    {
        pattern: /SELECT\s+[\s\S]*?FROM\s+\w+\s*(?:;|$)(?!\s*WHERE)/i,
        category: IssueCategory.PerformanceBottleneck,
        severity: IssueSeverity.Low,
        message: 'Query without WHERE clause — full table scan likely',
        explanation: 'Queries without WHERE clauses scan the entire table, which may be expensive.',
        suggestedFix: 'Add appropriate WHERE clauses to limit the result set.',
        confidence: 0.4,
        languages: ['sql']
    },
    // System.out.println in Java
    {
        pattern: /System\.(?:out|err)\.print(?:ln)?\s*\(/,
        category: IssueCategory.PerformanceBottleneck,
        severity: IssueSeverity.Low,
        message: 'System.out/err print statement found',
        explanation: 'System.out.println is blocking and not suitable for production logging.',
        suggestedFix: 'Use a logging framework like SLF4J, Log4j, or java.util.logging.',
        confidence: 0.6,
        languages: ['java']
    },
    // Python print statements
    {
        pattern: /^\s*print\s*\(/,
        category: IssueCategory.BadPractice,
        severity: IssueSeverity.Low,
        message: 'Print statement found — consider using logging',
        explanation: 'print() statements should be replaced with proper logging in production code.',
        suggestedFix: 'Use the logging module: import logging; logger = logging.getLogger(__name__).',
        confidence: 0.4,
        languages: ['python']
    },
    // Global variable lookup in Python loops
    {
        pattern: /(?:for|while)\s+[\s\S]*?(?:len|range|type|str|int|float|list|dict|set|tuple)\s*\(/,
        category: IssueCategory.PerformanceBottleneck,
        severity: IssueSeverity.Low,
        message: 'Global function called inside loop — consider local reference',
        explanation: 'In Python, accessing global functions in tight loops is slightly slower than local references.',
        suggestedFix: 'Assign the built-in to a local variable before the loop: _len = len.',
        confidence: 0.3,
        languages: ['python']
    }
];

export class PerformanceAnalyzer {
    analyze(filePath: string, content: string, language: string): ReviewIssue[] {
        const issues: ReviewIssue[] = [];
        const lines = content.split('\n');

        // Line-by-line pattern scanning
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) {
                continue;
            }

            for (const pattern of PERFORMANCE_PATTERNS) {
                if (pattern.languages && !pattern.languages.includes(language)) {
                    continue;
                }
                if (pattern.pattern.test(line)) {
                    issues.push({
                        file: filePath,
                        line: i + 1,
                        severity: pattern.severity,
                        category: pattern.category,
                        message: pattern.message,
                        explanation: pattern.explanation,
                        suggestedFix: pattern.suggestedFix,
                        confidence: pattern.confidence,
                        ruleId: `performance/${pattern.category}`
                    });
                }
            }
        }

        // Multi-line context analysis: detect nested loops
        this.detectNestedLoops(filePath, content, language, issues);

        return issues;
    }

    private detectNestedLoops(filePath: string, content: string, language: string, issues: ReviewIssue[]): void {
        const lines = content.split('\n');
        const loopKeywords = ['for', 'while', 'do'];
        let depth = 0;
        let outerLoopLine = -1;

        for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();
            for (const kw of loopKeywords) {
                const loopRegex = new RegExp(`\\b${kw}\\b\\s*[\\(\\{:]`);
                if (loopRegex.test(trimmed)) {
                    depth++;
                    if (depth === 1) {
                        outerLoopLine = i + 1;
                    }
                    if (depth >= 3) {
                        issues.push({
                            file: filePath,
                            line: i + 1,
                            severity: IssueSeverity.High,
                            category: IssueCategory.PerformanceBottleneck,
                            message: 'Deeply nested loop detected (3+ levels)',
                            explanation: `Loop at line ${i + 1} is nested 3 or more levels deep (outer loop at line ${outerLoopLine}), resulting in potentially O(n³) or worse complexity.`,
                            suggestedFix: 'Refactor to reduce nesting — extract inner loops into functions or use lookup structures.',
                            confidence: 0.8,
                            ruleId: 'performance/nested-loops'
                        });
                    }
                    break;
                }
            }
            // Track brace depth to detect when loops end
            const opens = (trimmed.match(/\{/g) || []).length;
            const closes = (trimmed.match(/\}/g) || []).length;
            depth = Math.max(0, depth - (closes - opens > 0 ? closes - opens : 0));
        }
    }
}
