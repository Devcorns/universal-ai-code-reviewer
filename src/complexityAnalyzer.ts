/** Cyclomatic complexity and function size analyzer */

import { ReviewIssue, IssueSeverity, IssueCategory, ReviewerConfig } from './issueTypes.js';

interface FunctionInfo {
    name: string;
    startLine: number;
    endLine: number;
    lineCount: number;
    complexity: number;
}

// Patterns to detect function declarations across languages
const FUNCTION_START_PATTERNS: Record<string, RegExp[]> = {
    'javascript': [
        /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(?|(\w+)\s*\(.*\)\s*\{)/,
        /(?:(\w+)\s*:\s*(?:async\s*)?function|\b(\w+)\s*=\s*(?:async\s*)?\()/
    ],
    'typescript': [
        /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(?|(\w+)\s*\(.*\)\s*(?::\s*\w+\s*)?\{)/,
        /(?:(?:public|private|protected|static|async)\s+)?(\w+)\s*\(.*\)\s*(?::\s*\S+\s*)?\{/
    ],
    'python': [
        /^\s*(?:async\s+)?def\s+(\w+)\s*\(/
    ],
    'java': [
        /(?:public|private|protected|static|\s)+[\w<>\[\]]+\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+\w+(?:,\s*\w+)*)?\s*\{/
    ],
    'csharp': [
        /(?:public|private|protected|internal|static|async|virtual|override|\s)+[\w<>\[\]]+\s+(\w+)\s*\([^)]*\)\s*\{/
    ],
    'go': [
        /func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(/
    ],
    'rust': [
        /(?:pub\s+)?(?:async\s+)?fn\s+(\w+)\s*[<(]/
    ],
    'php': [
        /(?:public|private|protected|static|\s)*function\s+(\w+)\s*\(/
    ],
    'ruby': [
        /^\s*def\s+(\w+)/
    ],
    'swift': [
        /(?:public|private|internal|open|static|\s)*func\s+(\w+)/
    ],
    'kotlin': [
        /(?:public|private|protected|internal|override|suspend|\s)*fun\s+(\w+)/
    ],
    'dart': [
        /(?:static\s+)?[\w<>]+\s+(\w+)\s*\([^)]*\)\s*(?:async\s*)?\{/
    ],
    'c': [
        /^[\w\s\*]+\s+(\w+)\s*\([^)]*\)\s*\{/
    ],
    'cpp': [
        /^[\w\s\*:&<>]+\s+(\w+)\s*\([^)]*\)\s*(?:const)?\s*\{/
    ],
    'powershell': [
        /function\s+(\w[\w-]*)\s*(?:\([^)]*\))?\s*\{/i
    ],
    'shellscript': [
        /(?:function\s+)?(\w+)\s*\(\)\s*\{/
    ]
};

// Complexity-increasing keywords per language family
const COMPLEXITY_KEYWORDS: Record<string, RegExp> = {
    'default': /\b(?:if|else\s+if|elif|elsif|while|for|foreach|case|catch|except|&&|\|\||\?|switch)\b/g,
    'python': /\b(?:if|elif|while|for|except|and|or|assert)\b/g,
    'ruby': /\b(?:if|elsif|unless|while|until|for|when|rescue|and|or)\b/g,
    'go': /\b(?:if|else\s+if|for|switch|case|select|\|\||&&)\b/g
};

export class ComplexityAnalyzer {
    analyze(filePath: string, content: string, language: string, config: ReviewerConfig): ReviewIssue[] {
        const issues: ReviewIssue[] = [];
        const functions = this.extractFunctions(content, language);

        for (const fn of functions) {
            // Check function length
            if (fn.lineCount > config.maxFunctionLength) {
                issues.push({
                    file: filePath,
                    line: fn.startLine,
                    endLine: fn.endLine,
                    severity: fn.lineCount > config.maxFunctionLength * 2 ? IssueSeverity.High : IssueSeverity.Medium,
                    category: IssueCategory.HighComplexity,
                    message: `Function "${fn.name}" is ${fn.lineCount} lines long (max: ${config.maxFunctionLength})`,
                    explanation: `Long functions are harder to understand, test, and maintain. This function exceeds the configured maximum of ${config.maxFunctionLength} lines.`,
                    suggestedFix: 'Extract logical sections into smaller, well-named helper functions.',
                    confidence: 0.9,
                    ruleId: 'complexity/function-length'
                });
            }

            // Check cyclomatic complexity
            if (fn.complexity > config.maxCyclomaticComplexity) {
                issues.push({
                    file: filePath,
                    line: fn.startLine,
                    endLine: fn.endLine,
                    severity: fn.complexity > config.maxCyclomaticComplexity * 2 ? IssueSeverity.High : IssueSeverity.Medium,
                    category: IssueCategory.HighComplexity,
                    message: `Function "${fn.name}" has cyclomatic complexity ${fn.complexity} (max: ${config.maxCyclomaticComplexity})`,
                    explanation: `High cyclomatic complexity makes code difficult to test and reason about. Each decision point adds a potential execution path.`,
                    suggestedFix: 'Simplify conditionals, extract methods, use early returns, or apply the strategy pattern.',
                    confidence: 0.85,
                    ruleId: 'complexity/cyclomatic'
                });
            }
        }

        return issues;
    }

    private extractFunctions(content: string, language: string): FunctionInfo[] {
        const functions: FunctionInfo[] = [];
        const lines = content.split('\n');
        const patterns = FUNCTION_START_PATTERNS[language] || FUNCTION_START_PATTERNS['javascript'] || [];
        const isPython = language === 'python' || language === 'ruby';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            for (const pattern of patterns) {
                const match = pattern.exec(line);
                if (match) {
                    const name = match[1] || match[2] || match[3] || 'anonymous';
                    const startLine = i + 1;
                    const endLine = isPython
                        ? this.findPythonFunctionEnd(lines, i)
                        : this.findBraceFunctionEnd(lines, i);
                    const lineCount = endLine - startLine + 1;
                    const body = lines.slice(i, endLine).join('\n');
                    const complexity = this.calculateComplexity(body, language);

                    functions.push({ name, startLine, endLine, lineCount, complexity });
                    break;
                }
            }
        }

        return functions;
    }

    private findBraceFunctionEnd(lines: string[], startIdx: number): number {
        let depth = 0;
        let foundOpen = false;

        for (let i = startIdx; i < lines.length; i++) {
            for (const ch of lines[i]) {
                if (ch === '{') { depth++; foundOpen = true; }
                if (ch === '}') { depth--; }
                if (foundOpen && depth === 0) {
                    return i + 1;
                }
            }
        }
        return Math.min(startIdx + 50, lines.length);
    }

    private findPythonFunctionEnd(lines: string[], startIdx: number): number {
        if (startIdx + 1 >= lines.length) { return startIdx + 1; }
        const baseIndent = lines[startIdx].search(/\S/);

        for (let i = startIdx + 1; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim() === '') { continue; }
            const indent = line.search(/\S/);
            if (indent <= baseIndent) {
                return i;
            }
        }
        return lines.length;
    }

    private calculateComplexity(body: string, language: string): number {
        const regex = COMPLEXITY_KEYWORDS[language] || COMPLEXITY_KEYWORDS['default'];
        const matches = body.match(regex);
        return 1 + (matches ? matches.length : 0);
    }
}
