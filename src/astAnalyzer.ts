/** AST-style structural analysis using pattern-based parsing */

import { ReviewIssue, IssueSeverity, IssueCategory, ReviewerConfig } from './issueTypes.js';
import { LanguageFamily } from './languageDetector.js';

export class AstAnalyzer {
    analyze(filePath: string, content: string, language: string, family: LanguageFamily, config: ReviewerConfig): ReviewIssue[] {
        const issues: ReviewIssue[] = [];
        const lines = content.split('\n');

        this.detectUnusedVariables(filePath, content, lines, language, family, issues);
        this.detectDeadCode(filePath, lines, language, family, issues);
        this.detectBadPatterns(filePath, lines, language, family, issues);
        this.detectEmptyCatchBlocks(filePath, lines, language, family, issues);
        this.detectForbiddenFunctions(filePath, lines, language, config, issues);
        this.detectNamingIssues(filePath, lines, language, family, issues);

        return issues;
    }

    private detectUnusedVariables(filePath: string, content: string, lines: string[], language: string, family: LanguageFamily, issues: ReviewIssue[]): void {
        const varPatterns: Record<string, RegExp> = {
            'javascript': /(?:const|let|var)\s+(\w+)\s*=/g,
            'typescript': /(?:const|let|var)\s+(\w+)\s*(?::\s*\S+\s*)?=/g,
            'python': /^(\w+)\s*=(?!=)/gm,
            'go': /(?:var\s+(\w+)|(\w+)\s*:=)/g,
            'rust': /let\s+(?:mut\s+)?(\w+)\s*(?::\s*\S+\s*)?=/g,
            'java': /(?:int|long|float|double|String|boolean|char|byte|short|var|final)\s+(\w+)\s*[=;]/g,
            'csharp': /(?:int|long|float|double|string|bool|char|var|readonly)\s+(\w+)\s*[=;]/g,
            'php': /\$(\w+)\s*=/g,
            'ruby': /(\w+)\s*=(?!=)/g,
        };

        const pattern = varPatterns[language];
        if (!pattern) { return; }

        let match;
        while ((match = pattern.exec(content)) !== null) {
            const varName = match[1] || match[2];
            if (!varName || varName.length <= 1 || varName.startsWith('_')) { continue; }

            // Count occurrences beyond the declaration
            const escapedName = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const usageRegex = new RegExp(`\\b${escapedName}\\b`, 'g');
            const matches = content.match(usageRegex);
            if (matches && matches.length <= 1) {
                const lineIdx = content.substring(0, match.index).split('\n').length;
                issues.push({
                    file: filePath,
                    line: lineIdx,
                    severity: IssueSeverity.Low,
                    category: IssueCategory.UnusedVariable,
                    message: `Variable "${varName}" is declared but appears to be unused`,
                    explanation: 'Unused variables add noise and may indicate incomplete refactoring.',
                    suggestedFix: `Remove the unused variable "${varName}" or prefix with underscore if intentional.`,
                    confidence: 0.6,
                    ruleId: 'ast/unused-variable'
                });
            }
        }
    }

    private detectDeadCode(filePath: string, lines: string[], language: string, family: LanguageFamily, issues: ReviewIssue[]): void {
        for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();

            // Code after return/break/continue/throw
            if (/^\s*(?:return|break|continue|throw|exit|sys\.exit|os\.Exit|panic)\b/.test(trimmed)) {
                // Check if next non-empty, non-comment line has code
                for (let j = i + 1; j < lines.length && j < i + 5; j++) {
                    const next = lines[j].trim();
                    if (next === '' || next.startsWith('//') || next.startsWith('#') || next.startsWith('*') || next === '}' || next === ')') {
                        continue;
                    }
                    // If the next line is a case/default/catch/else, it's valid
                    if (/^(?:case|default|catch|except|else|elif|elsif|finally|}\s*(?:else|catch|finally))/.test(next)) {
                        break;
                    }
                    issues.push({
                        file: filePath,
                        line: j + 1,
                        severity: IssueSeverity.Medium,
                        category: IssueCategory.UnreachableCode,
                        message: 'Unreachable code after return/break/throw statement',
                        explanation: `Code at line ${j + 1} appears after a return/break/throw at line ${i + 1} and will never execute.`,
                        suggestedFix: 'Remove the unreachable code or restructure the control flow.',
                        confidence: 0.7,
                        ruleId: 'ast/unreachable-code'
                    });
                    break;
                }
            }

            // TODO/FIXME/HACK/BUG comments
            const todoMatch = trimmed.match(/(?:\/\/|#|\/\*|\*)\s*(TODO|FIXME|HACK|BUG|XXX)\b[:\s]*(.*)/i);
            if (todoMatch) {
                issues.push({
                    file: filePath,
                    line: i + 1,
                    severity: IssueSeverity.Low,
                    category: IssueCategory.DeadCode,
                    message: `${todoMatch[1].toUpperCase()} comment found: ${todoMatch[2].substring(0, 80)}`,
                    explanation: 'TODO/FIXME/HACK comments indicate incomplete or problematic code that needs attention.',
                    suggestedFix: 'Address the TODO/FIXME item or create a tracked issue for it.',
                    confidence: 0.9,
                    ruleId: 'ast/todo-comment'
                });
            }
        }
    }

    private detectBadPatterns(filePath: string, lines: string[], language: string, family: LanguageFamily, issues: ReviewIssue[]): void {
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // == instead of === (JavaScript/TypeScript)
            if ((language === 'javascript' || language === 'typescript') && /[^!=<>]==[^=]/.test(line) && !/===/.test(line)) {
                issues.push({
                    file: filePath,
                    line: i + 1,
                    severity: IssueSeverity.Medium,
                    category: IssueCategory.LogicalBug,
                    message: 'Loose equality (==) used instead of strict equality (===)',
                    explanation: 'The == operator performs type coercion which can lead to unexpected results.',
                    suggestedFix: 'Use === for strict equality comparison.',
                    confidence: 0.75,
                    ruleId: 'ast/strict-equality'
                });
            }

            // var usage (JavaScript/TypeScript)
            if ((language === 'javascript' || language === 'typescript') && /^\s*var\s+/.test(line)) {
                issues.push({
                    file: filePath,
                    line: i + 1,
                    severity: IssueSeverity.Low,
                    category: IssueCategory.BadPractice,
                    message: '"var" used instead of "let" or "const"',
                    explanation: 'var has function scope and hoisting which can cause subtle bugs.',
                    suggestedFix: 'Use "const" for values that don\'t change, "let" for values that do.',
                    confidence: 0.85,
                    ruleId: 'ast/no-var'
                });
            }

            // import * (Python)
            if (language === 'python' && /^\s*from\s+\w+\s+import\s+\*/.test(line)) {
                issues.push({
                    file: filePath,
                    line: i + 1,
                    severity: IssueSeverity.Medium,
                    category: IssueCategory.BadPractice,
                    message: 'Wildcard import (import *) used',
                    explanation: 'Wildcard imports pollute the namespace and make it unclear where names come from.',
                    suggestedFix: 'Import specific names: from module import name1, name2.',
                    confidence: 0.9,
                    ruleId: 'ast/no-wildcard-import'
                });
            }

            // Mutable default argument (Python)
            if (language === 'python' && /def\s+\w+\s*\([^)]*(?:\[\]|\{\}|dict\(\)|list\(\)|set\(\))\s*[,)]/.test(line)) {
                issues.push({
                    file: filePath,
                    line: i + 1,
                    severity: IssueSeverity.High,
                    category: IssueCategory.LogicalBug,
                    message: 'Mutable default argument in function definition',
                    explanation: 'Mutable default arguments are shared between calls, causing surprising state mutations.',
                    suggestedFix: 'Use None as default and create the mutable object inside the function.',
                    confidence: 0.85,
                    ruleId: 'ast/mutable-default'
                });
            }

            // Bare except (Python)
            if (language === 'python' && /^\s*except\s*:/.test(line)) {
                issues.push({
                    file: filePath,
                    line: i + 1,
                    severity: IssueSeverity.Medium,
                    category: IssueCategory.PoorErrorHandling,
                    message: 'Bare except clause — catches all exceptions including KeyboardInterrupt',
                    explanation: 'Catching all exceptions hides bugs and prevents proper error handling.',
                    suggestedFix: 'Catch specific exceptions: except ValueError as e:',
                    confidence: 0.9,
                    ruleId: 'ast/bare-except'
                });
            }

            // Unchecked error in Go
            if (language === 'go' && /\w+,\s*_\s*:?=\s*\w+/.test(line) && !trimmed.startsWith('//')) {
                issues.push({
                    file: filePath,
                    line: i + 1,
                    severity: IssueSeverity.High,
                    category: IssueCategory.PoorErrorHandling,
                    message: 'Error return value discarded with blank identifier',
                    explanation: 'Ignoring error return values can cause silent failures and unexpected behavior.',
                    suggestedFix: 'Handle the error: if err != nil { return err }.',
                    confidence: 0.7,
                    ruleId: 'ast/unchecked-error'
                });
            }

            // Magic numbers
            if (family === LanguageFamily.CStyle || family === LanguageFamily.Scripting) {
                const magicMatch = line.match(/(?:if|while|for|return|case)\s*[\s(].*\b(\d{2,})\b/);
                if (magicMatch && !['100', '200', '300', '400', '404', '500', '1000', '1024'].includes(magicMatch[1])) {
                    issues.push({
                        file: filePath,
                        line: i + 1,
                        severity: IssueSeverity.Low,
                        category: IssueCategory.BadPractice,
                        message: `Magic number ${magicMatch[1]} found — consider using a named constant`,
                        explanation: 'Magic numbers make code harder to understand and maintain.',
                        suggestedFix: `Extract ${magicMatch[1]} into a named constant with a descriptive name.`,
                        confidence: 0.4,
                        ruleId: 'ast/magic-number'
                    });
                }
            }
        }
    }

    private detectEmptyCatchBlocks(filePath: string, lines: string[], language: string, family: LanguageFamily, issues: ReviewIssue[]): void {
        for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();

            // Detect catch/except blocks
            const isCatchLine = (family === LanguageFamily.CStyle || language === 'php')
                ? /\bcatch\s*\(/.test(trimmed)
                : language === 'python'
                    ? /^\s*except\b/.test(trimmed)
                    : language === 'ruby'
                        ? /^\s*rescue\b/.test(trimmed)
                        : false;

            if (isCatchLine) {
                // Check for empty block: next meaningful line is just a closing brace, or empty
                let isEmpty = false;
                if (family === LanguageFamily.CStyle) {
                    // Check if { } on same line or next line is }
                    if (/\{\s*\}/.test(trimmed)) {
                        isEmpty = true;
                    } else {
                        for (let j = i + 1; j < lines.length && j <= i + 3; j++) {
                            const next = lines[j].trim();
                            if (next === '' || next === '{') { continue; }
                            if (next === '}') { isEmpty = true; }
                            break;
                        }
                    }
                } else if (language === 'python') {
                    // Check if next indented line is just 'pass'
                    if (i + 1 < lines.length && lines[i + 1].trim() === 'pass') {
                        isEmpty = true;
                    }
                }

                if (isEmpty) {
                    issues.push({
                        file: filePath,
                        line: i + 1,
                        severity: IssueSeverity.Medium,
                        category: IssueCategory.PoorErrorHandling,
                        message: 'Empty catch/except block — errors are silently swallowed',
                        explanation: 'Empty error handlers hide problems and make debugging extremely difficult.',
                        suggestedFix: 'Log the error, rethrow it, or handle it meaningfully.',
                        confidence: 0.9,
                        ruleId: 'ast/empty-catch'
                    });
                }
            }
        }
    }

    private detectForbiddenFunctions(filePath: string, lines: string[], language: string, config: ReviewerConfig, issues: ReviewIssue[]): void {
        for (const fn of config.forbiddenFunctions) {
            const escapedFn = fn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escapedFn}\\s*\\(`, 'g');

            for (let i = 0; i < lines.length; i++) {
                const trimmed = lines[i].trim();
                if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) { continue; }

                if (regex.test(lines[i])) {
                    issues.push({
                        file: filePath,
                        line: i + 1,
                        severity: IssueSeverity.High,
                        category: IssueCategory.BadPractice,
                        message: `Forbidden function "${fn}" used`,
                        explanation: `The function "${fn}" is listed as forbidden in the project configuration.`,
                        suggestedFix: `Replace "${fn}" with a safer alternative.`,
                        confidence: 0.95,
                        ruleId: 'ast/forbidden-function'
                    });
                }
                regex.lastIndex = 0;
            }
        }
    }

    private detectNamingIssues(filePath: string, lines: string[], language: string, family: LanguageFamily, issues: ReviewIssue[]): void {
        if (family !== LanguageFamily.CStyle && language !== 'python') { return; }

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Single-letter variable names (except i, j, k in loops, or _ for unused)
            let varMatch;
            if (language === 'python') {
                varMatch = line.match(/^\s*([a-zA-Z])\s*=/);
            } else {
                varMatch = line.match(/(?:const|let|var|int|long|float|double|string|auto)\s+([a-zA-Z])\s*[=;]/);
            }

            if (varMatch && !['i', 'j', 'k', 'x', 'y', 'z', '_', 'e'].includes(varMatch[1])) {
                // Only flag if not in a loop header
                if (!/\b(?:for|while)\b/.test(line)) {
                    issues.push({
                        file: filePath,
                        line: i + 1,
                        severity: IssueSeverity.Low,
                        category: IssueCategory.InconsistentNaming,
                        message: `Single-letter variable name "${varMatch[1]}" — use a descriptive name`,
                        explanation: 'Single-letter variables reduce code readability except for simple loop counters.',
                        suggestedFix: 'Rename to a descriptive name that indicates the variable\'s purpose.',
                        confidence: 0.5,
                        ruleId: 'ast/naming-single-letter'
                    });
                }
            }
        }
    }
}
