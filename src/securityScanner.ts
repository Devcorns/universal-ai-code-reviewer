/** Security vulnerability scanner across all supported languages */

import { ReviewIssue, IssueSeverity, IssueCategory, AnalyzerPattern } from './issueTypes.js';

const SECURITY_PATTERNS: AnalyzerPattern[] = [
    // SQL Injection
    {
        pattern: /(\+\s*['"`]?\s*(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|EXEC)\b|\bquery\s*\(\s*['"`]\s*(?:SELECT|INSERT|UPDATE|DELETE).*\$\{|\.format\s*\(\s*['"`].*(?:SELECT|INSERT|UPDATE|DELETE))/i,
        category: IssueCategory.SQLInjection,
        severity: IssueSeverity.Critical,
        message: 'Potential SQL injection via string concatenation',
        explanation: 'Building SQL queries using string concatenation or template literals with user input creates SQL injection vulnerabilities.',
        suggestedFix: 'Use parameterized queries or prepared statements instead of string concatenation.',
        confidence: 0.85
    },
    {
        pattern: /\bexecute\s*\(\s*f?['"`].*(?:SELECT|INSERT|UPDATE|DELETE|DROP)\b/i,
        category: IssueCategory.SQLInjection,
        severity: IssueSeverity.Critical,
        message: 'SQL query built with string interpolation',
        explanation: 'Query execution with interpolated strings is vulnerable to SQL injection attacks.',
        suggestedFix: 'Use parameterized queries with placeholders.',
        confidence: 0.9,
        languages: ['python', 'ruby', 'php']
    },
    // Command Injection
    {
        pattern: /\b(?:exec|execSync|spawn|spawnSync|execFile)\s*\([^)]*\+/,
        category: IssueCategory.CommandInjection,
        severity: IssueSeverity.Critical,
        message: 'Potential command injection via string concatenation in process execution',
        explanation: 'Concatenating user input into shell commands can allow arbitrary command execution.',
        suggestedFix: 'Use an array of arguments instead of a concatenated string, or validate/sanitize input.',
        confidence: 0.85,
        languages: ['javascript', 'typescript']
    },
    {
        pattern: /\bos\.system\s*\(|subprocess\.call\s*\(\s*[^[\]]*\+|subprocess\.Popen\s*\(\s*[^[\]]*\+/,
        category: IssueCategory.CommandInjection,
        severity: IssueSeverity.Critical,
        message: 'Potential command injection in process execution',
        explanation: 'Using os.system or subprocess with concatenated strings allows shell injection.',
        suggestedFix: 'Use subprocess.run with a list of arguments and shell=False.',
        confidence: 0.85,
        languages: ['python']
    },
    {
        pattern: /Runtime\.getRuntime\(\)\.exec\s*\([^)]*\+/,
        category: IssueCategory.CommandInjection,
        severity: IssueSeverity.Critical,
        message: 'Potential command injection in Runtime.exec',
        explanation: 'Concatenating user input into Runtime.exec() allows command injection.',
        suggestedFix: 'Use ProcessBuilder with separate arguments instead of a single string command.',
        confidence: 0.85,
        languages: ['java']
    },
    // XSS
    {
        pattern: /\.innerHTML\s*=(?!=)|\.outerHTML\s*=(?!=)|document\.write\s*\(/,
        category: IssueCategory.XSSRisk,
        severity: IssueSeverity.Critical,
        message: 'Potential XSS vulnerability via unsafe DOM manipulation',
        explanation: 'Setting innerHTML/outerHTML or using document.write with unsanitized data enables cross-site scripting.',
        suggestedFix: 'Use textContent, createElement, or a sanitization library like DOMPurify.',
        confidence: 0.8,
        languages: ['javascript', 'typescript']
    },
    {
        pattern: /\bdangerouslySetInnerHTML\b/,
        category: IssueCategory.XSSRisk,
        severity: IssueSeverity.High,
        message: 'dangerouslySetInnerHTML used — XSS risk',
        explanation: 'React\'s dangerouslySetInnerHTML bypasses XSS protections. User input could be injected.',
        suggestedFix: 'Sanitize the HTML content before passing it, or use a safer alternative.',
        confidence: 0.75,
        languages: ['javascript', 'typescript']
    },
    // Hardcoded Secrets
    {
        pattern: /(?:password|passwd|secret|api_?key|access_?key|auth_?token|private_?key)\s*[:=]\s*['"`][^'"`]{4,}/i,
        category: IssueCategory.HardcodedSecret,
        severity: IssueSeverity.Critical,
        message: 'Potential hardcoded secret or credential',
        explanation: 'Hardcoded credentials in source code can be exposed through version control and logs.',
        suggestedFix: 'Use environment variables or a secure vault service to store sensitive values.',
        confidence: 0.8
    },
    {
        pattern: /(?:AKIA[0-9A-Z]{16}|(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}|sk-[A-Za-z0-9]{32,})/,
        category: IssueCategory.HardcodedSecret,
        severity: IssueSeverity.Critical,
        message: 'Potential hardcoded API key or token detected',
        explanation: 'This looks like an AWS access key, GitHub token, or OpenAI key hardcoded in source.',
        suggestedFix: 'Rotate this key immediately and move it to environment variables or a secret manager.',
        confidence: 0.95
    },
    // Improper Input Validation
    {
        pattern: /\beval\s*\(/,
        category: IssueCategory.SecurityVulnerability,
        severity: IssueSeverity.Critical,
        message: 'Use of eval() is a security risk',
        explanation: 'eval() executes arbitrary code and can be exploited if user input reaches it.',
        suggestedFix: 'Refactor to avoid eval(). Use JSON.parse() for JSON data or safer alternatives.',
        confidence: 0.9,
        languages: ['javascript', 'typescript', 'python', 'php', 'ruby']
    },
    {
        pattern: /new\s+Function\s*\(/,
        category: IssueCategory.SecurityVulnerability,
        severity: IssueSeverity.High,
        message: 'Dynamic Function constructor used — similar risk to eval()',
        explanation: 'new Function() compiles code at runtime, creating an injection vector.',
        suggestedFix: 'Refactor to use static functions or safer alternatives.',
        confidence: 0.85,
        languages: ['javascript', 'typescript']
    },
    // Insecure crypto
    {
        pattern: /\b(?:md5|sha1)\s*\(|createHash\s*\(\s*['"`](?:md5|sha1)['"`]\)/i,
        category: IssueCategory.SecurityVulnerability,
        severity: IssueSeverity.High,
        message: 'Weak cryptographic hash function used',
        explanation: 'MD5 and SHA-1 are cryptographically broken and should not be used for security purposes.',
        suggestedFix: 'Use SHA-256 or stronger hash functions.',
        confidence: 0.85
    },
    // Path traversal
    {
        pattern: /\.\.\//,
        category: IssueCategory.ImproperInputValidation,
        severity: IssueSeverity.Medium,
        message: 'Path traversal pattern detected',
        explanation: 'Relative path traversal (../) in file operations may allow unauthorized file access if user-controlled.',
        suggestedFix: 'Validate and normalize file paths. Use path.resolve() and verify the result is within expected bounds.',
        confidence: 0.4
    },
    // Unsafe deserialization
    {
        pattern: /\bpickle\.loads?\s*\(|yaml\.load\s*\([^)]*(?:Loader\s*=\s*yaml\.(?:Unsafe|Full)Loader)?[^)]*\)/,
        category: IssueCategory.SecurityVulnerability,
        severity: IssueSeverity.Critical,
        message: 'Potentially unsafe deserialization',
        explanation: 'Deserializing untrusted data can lead to arbitrary code execution.',
        suggestedFix: 'Use safe deserialization methods (e.g., yaml.safe_load, json instead of pickle).',
        confidence: 0.8,
        languages: ['python']
    },
    // Unvalidated redirect
    {
        pattern: /res\.redirect\s*\([^)]*(?:req\.|params|query)/,
        category: IssueCategory.ImproperInputValidation,
        severity: IssueSeverity.High,
        message: 'Potential open redirect vulnerability',
        explanation: 'Redirecting to a user-supplied URL can lead to phishing attacks.',
        suggestedFix: 'Validate redirect URLs against a whitelist of allowed destinations.',
        confidence: 0.75,
        languages: ['javascript', 'typescript']
    },
    // Disabled security features
    {
        pattern: /verify\s*[:=]\s*(?:false|False|FALSE)|rejectUnauthorized\s*[:=]\s*(?:false|False)/,
        category: IssueCategory.SecurityVulnerability,
        severity: IssueSeverity.Critical,
        message: 'SSL/TLS certificate verification disabled',
        explanation: 'Disabling certificate verification makes connections vulnerable to man-in-the-middle attacks.',
        suggestedFix: 'Enable certificate verification in production. Use proper CA certificates.',
        confidence: 0.85
    },
    // CORS wildcard
    {
        pattern: /Access-Control-Allow-Origin['":\s]*\*/,
        category: IssueCategory.SecurityVulnerability,
        severity: IssueSeverity.Medium,
        message: 'Wildcard CORS policy detected',
        explanation: 'Allowing any origin (\'*\') with CORS can expose your API to cross-origin attacks.',
        suggestedFix: 'Restrict allowed origins to known, trusted domains.',
        confidence: 0.7
    },
    // Shell injection in shell scripts
    {
        pattern: /\$\{?\w+\}?\s*(?:;|&&|\|)/,
        category: IssueCategory.CommandInjection,
        severity: IssueSeverity.High,
        message: 'Potential shell injection via unquoted variable',
        explanation: 'Unquoted shell variables in commands can be exploited for command injection.',
        suggestedFix: 'Always quote shell variables: "${variable}" instead of $variable.',
        confidence: 0.6,
        languages: ['shellscript']
    }
];

export class SecurityScanner {
    analyze(filePath: string, content: string, language: string): ReviewIssue[] {
        const issues: ReviewIssue[] = [];
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Skip comment-only lines (basic heuristic)
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*') || trimmed.startsWith('<!--')) {
                continue;
            }

            for (const pattern of SECURITY_PATTERNS) {
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
                        ruleId: `security/${pattern.category}`
                    });
                }
            }
        }

        return issues;
    }
}
