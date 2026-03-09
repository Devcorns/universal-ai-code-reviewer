/** Custom rule engine — loads and applies user-defined rules */

import { ReviewIssue, IssueSeverity, IssueCategory, CustomRule, ReviewerConfig } from './issueTypes.js';

/** Default rules embedded in the extension */
const DEFAULT_RULES: CustomRule[] = [
    {
        id: 'no-console-log',
        pattern: '\\bconsole\\.log\\s*\\(',
        severity: 'Low',
        message: 'console.log statement found — remove before production',
        explanation: 'Console.log calls should not be present in production code.',
        suggestedFix: 'Remove the console.log or use a proper logging framework.',
        languages: ['javascript', 'typescript']
    },
    {
        id: 'no-debugger',
        pattern: '\\bdebugger\\b',
        severity: 'High',
        message: 'debugger statement found',
        explanation: 'debugger statements will pause execution in browsers and must be removed.',
        suggestedFix: 'Remove the debugger statement.',
        languages: ['javascript', 'typescript']
    },
    {
        id: 'no-alert',
        pattern: '\\balert\\s*\\(',
        severity: 'Medium',
        message: 'alert() call found',
        explanation: 'alert() blocks the UI thread and provides a poor user experience.',
        suggestedFix: 'Replace alert() with a proper UI notification.',
        languages: ['javascript', 'typescript']
    },
    {
        id: 'no-fixme',
        pattern: '(?:\\/\\/|#)\\s*FIXME\\b',
        severity: 'Medium',
        message: 'FIXME comment found — requires attention',
        languages: ['javascript', 'typescript', 'python', 'java', 'go', 'rust', 'ruby', 'php']
    }
];

function parseSeverity(s: string): IssueSeverity {
    switch (s.toLowerCase()) {
        case 'critical': return IssueSeverity.Critical;
        case 'high': return IssueSeverity.High;
        case 'medium': return IssueSeverity.Medium;
        default: return IssueSeverity.Low;
    }
}

export class RuleEngine {
    private rules: CustomRule[];

    constructor(config?: ReviewerConfig) {
        this.rules = [...DEFAULT_RULES];
        if (config?.customRules) {
            this.rules.push(...config.customRules);
        }
    }

    /** Update rules at runtime (e.g., when config changes) */
    updateRules(customRules: CustomRule[]): void {
        this.rules = [...DEFAULT_RULES, ...customRules];
    }

    analyze(filePath: string, content: string, language: string): ReviewIssue[] {
        const issues: ReviewIssue[] = [];
        const lines = content.split('\n');

        for (const rule of this.rules) {
            if (rule.languages && !rule.languages.includes(language)) {
                continue;
            }

            let regex: RegExp;
            try {
                regex = new RegExp(rule.pattern, 'g');
            } catch {
                continue; // Skip invalid regex patterns
            }

            for (let i = 0; i < lines.length; i++) {
                if (regex.test(lines[i])) {
                    issues.push({
                        file: filePath,
                        line: i + 1,
                        severity: parseSeverity(rule.severity),
                        category: IssueCategory.BadPractice,
                        message: rule.message,
                        explanation: rule.explanation || rule.message,
                        suggestedFix: rule.suggestedFix || 'Review and fix this code according to project rules.',
                        confidence: 0.8,
                        ruleId: `rule/${rule.id}`
                    });
                }
                regex.lastIndex = 0;
            }
        }

        return issues;
    }
}
