/** Runtime risk prediction through static analysis */

import { ReviewIssue, IssueSeverity, IssueCategory, AnalyzerPattern } from './issueTypes.js';

const RUNTIME_PATTERNS: AnalyzerPattern[] = [
    // Null/undefined dereference
    {
        pattern: /(\w+)\.(\w+)(?!\s*[!=<>])(?!\s*\?\.)(?:(?!\bif\b|\bwhile\b|\?\.).)*$/,
        category: IssueCategory.RuntimeRisk,
        severity: IssueSeverity.High,
        message: 'Potential null/undefined dereference',
        explanation: 'Property access without prior null check may throw TypeError at runtime.',
        suggestedFix: 'Add a null check or use optional chaining (?.) before accessing properties.',
        confidence: 0.3,
        languages: ['javascript', 'typescript']
    },
    // Division by zero
    {
        pattern: /\/\s*(\w+)(?!\s*[=!])(?:\s*[;,)\]])/,
        category: IssueCategory.RuntimeRisk,
        severity: IssueSeverity.High,
        message: 'Potential division by zero',
        explanation: 'Dividing by a variable without checking if it is zero may cause a runtime error or Infinity.',
        suggestedFix: 'Add a zero-check before division: if (divisor !== 0) { ... }.',
        confidence: 0.4
    },
    // Array index access without bounds check
    {
        pattern: /\[(\w+)\](?!\s*=)(?!\s*\?)(?:(?!\blength\b|\bsize\b).)*$/,
        category: IssueCategory.RuntimeRisk,
        severity: IssueSeverity.Medium,
        message: 'Array access without bounds check',
        explanation: 'Accessing an array element without verifying the index is within bounds may cause an out-of-range error.',
        suggestedFix: 'Verify the index is >= 0 and < array.length before accessing.',
        confidence: 0.3
    },
    // Unhandled promise rejection
    {
        pattern: /(?:new\s+Promise|\.then\s*\()(?:(?!\.catch|\.finally).)*$/,
        category: IssueCategory.RuntimeRisk,
        severity: IssueSeverity.High,
        message: 'Promise without catch/error handler',
        explanation: 'Unhandled promise rejections crash Node.js processes and cause silent failures in browsers.',
        suggestedFix: 'Add a .catch() handler or use try/catch with await.',
        confidence: 0.6,
        languages: ['javascript', 'typescript']
    },
    // Missing await
    {
        pattern: /(?:^|\s)(?!await\s)(\w+)\s*\(\s*\)(?:\s*;)?\s*(?:\/\/.*)?$/,
        category: IssueCategory.RuntimeRisk,
        severity: IssueSeverity.Medium,
        message: 'Possibly missing await on async function call',
        explanation: 'Calling an async function without await may cause unexpected behavior.',
        suggestedFix: 'Add await keyword if the function is async.',
        confidence: 0.3,
        languages: ['javascript', 'typescript', 'python']
    },
    // Unclosed resource — file handles
    {
        pattern: /(?:fs\.open|fopen|open)\s*\((?:(?!\.close|with\s|using\s|try\s).)*$/,
        category: IssueCategory.ResourceLeak,
        severity: IssueSeverity.High,
        message: 'File handle opened without visible close',
        explanation: 'Opening a file without closing it in a finally block or using a with/using statement causes resource leaks.',
        suggestedFix: 'Use try-with-resources (Java), with statement (Python), or ensure close() is called in finally.',
        confidence: 0.5
    },
    // Memory allocation without free (C/C++)
    {
        pattern: /\b(?:malloc|calloc|realloc|new\s+\w+\[)\s*\(/,
        category: IssueCategory.MemoryLeak,
        severity: IssueSeverity.High,
        message: 'Dynamic memory allocation — verify corresponding free/delete',
        explanation: 'Manual memory allocation must be paired with deallocation to prevent memory leaks.',
        suggestedFix: 'Ensure every malloc/calloc/new has a matching free/delete, preferably in the same scope or destructor.',
        confidence: 0.5,
        languages: ['c', 'cpp']
    },
    // NullPointerException risk (Java/C#/Kotlin)
    {
        pattern: /(\w+)\.(\w+)\s*\((?:(?!\bnull\b|\bif\b).)*$/,
        category: IssueCategory.NullReference,
        severity: IssueSeverity.Medium,
        message: 'Method call on potentially null object',
        explanation: 'If the object reference is null, this will throw NullPointerException/NullReferenceException.',
        suggestedFix: 'Add null check or use null-safe operator (?.) before the method call.',
        confidence: 0.3,
        languages: ['java', 'csharp', 'kotlin']
    },
    // Goroutine leak (Go)
    {
        pattern: /go\s+func\s*\(|go\s+\w+\s*\(/,
        category: IssueCategory.ResourceLeak,
        severity: IssueSeverity.Medium,
        message: 'Goroutine launched — verify it terminates properly',
        explanation: 'Goroutines without proper termination signals can leak and consume memory indefinitely.',
        suggestedFix: 'Use context.Context or done channels to ensure goroutines can be cancelled.',
        confidence: 0.4,
        languages: ['go']
    },
    // Unsafe unwrap (Rust)
    {
        pattern: /\.unwrap\s*\(\s*\)/,
        category: IssueCategory.RuntimeRisk,
        severity: IssueSeverity.High,
        message: 'Unsafe .unwrap() call — will panic on None/Err',
        explanation: 'Calling unwrap() on a None or Err value will cause the program to panic at runtime.',
        suggestedFix: 'Use pattern matching, unwrap_or(), or the ? operator for proper error handling.',
        confidence: 0.8,
        languages: ['rust']
    },
    // Index out of range (Python)
    {
        pattern: /\[\s*-?\d+\s*\]/,
        category: IssueCategory.RuntimeRisk,
        severity: IssueSeverity.Low,
        message: 'Hard-coded index access — verify bounds',
        explanation: 'Accessing a specific index assumes the collection has at least that many elements.',
        suggestedFix: 'Check the collection length before accessing by index, or use .get() with a default.',
        confidence: 0.2,
        languages: ['python']
    },
    // Type assertion without check (TypeScript)
    {
        pattern: /\bas\s+\w+(?!\s*\|)/,
        category: IssueCategory.RuntimeRisk,
        severity: IssueSeverity.Medium,
        message: 'Type assertion without runtime validation',
        explanation: 'TypeScript type assertions (as T) are erased at runtime and provide no actual safety.',
        suggestedFix: 'Use a type guard function or runtime validation (e.g., instanceof, typeof) instead.',
        confidence: 0.4,
        languages: ['typescript']
    },
    // Concurrent map access (Go)
    {
        pattern: /(?:^|\s)(\w+)\[/,
        category: IssueCategory.RaceCondition,
        severity: IssueSeverity.High,
        message: 'Map access without sync — potential data race in concurrent context',
        explanation: 'Go maps are not safe for concurrent access. Concurrent reads/writes will cause a runtime panic.',
        suggestedFix: 'Use sync.RWMutex to protect map access, or use sync.Map for concurrent use.',
        confidence: 0.3,
        languages: ['go']
    }
];

export class RuntimeAnalyzer {
    analyze(filePath: string, content: string, language: string): ReviewIssue[] {
        const issues: ReviewIssue[] = [];
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*') || trimmed === '') {
                continue;
            }

            for (const pattern of RUNTIME_PATTERNS) {
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
                        ruleId: `runtime/${pattern.category}`
                    });
                }
            }
        }

        // Context-aware runtime checks
        this.checkUnclosedResources(filePath, content, language, issues);

        return issues;
    }

    private checkUnclosedResources(filePath: string, content: string, language: string, issues: ReviewIssue[]): void {
        // Check for event listeners without removal (JS/TS)
        if (language === 'javascript' || language === 'typescript') {
            const addListenerRegex = /\.addEventListener\s*\(\s*['"`](\w+)['"`]/g;
            const removeListenerRegex = /\.removeEventListener\s*\(\s*['"`](\w+)['"`]/g;

            const added = new Set<string>();
            const removed = new Set<string>();
            let match;

            while ((match = addListenerRegex.exec(content)) !== null) {
                added.add(match[1]);
            }
            while ((match = removeListenerRegex.exec(content)) !== null) {
                removed.add(match[1]);
            }

            for (const event of added) {
                if (!removed.has(event)) {
                    const lineIdx = content.split('\n').findIndex(l => l.includes(`addEventListener`) && l.includes(event));
                    if (lineIdx >= 0) {
                        issues.push({
                            file: filePath,
                            line: lineIdx + 1,
                            severity: IssueSeverity.Medium,
                            category: IssueCategory.MemoryLeak,
                            message: `Event listener '${event}' added but never removed`,
                            explanation: 'Event listeners that are never removed can cause memory leaks, especially in long-running applications.',
                            suggestedFix: 'Add a corresponding removeEventListener() call in cleanup/dispose logic.',
                            confidence: 0.5,
                            ruleId: 'runtime/event-listener-leak'
                        });
                    }
                }
            }
        }
    }
}
