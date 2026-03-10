/** Core type definitions for the Universal AI Code Reviewer */

export enum IssueSeverity {
    Low = 'Low',
    Medium = 'Medium',
    High = 'High',
    Critical = 'Critical'
}

export const SEVERITY_ORDER: Record<IssueSeverity, number> = {
    [IssueSeverity.Low]: 0,
    [IssueSeverity.Medium]: 1,
    [IssueSeverity.High]: 2,
    [IssueSeverity.Critical]: 3
};

export enum IssueCategory {
    SyntaxError = 'Syntax Error',
    LogicalBug = 'Logical Bug',
    RuntimeException = 'Possible Runtime Exception',
    NullReference = 'Null Reference Issue',
    MemoryLeak = 'Memory Leak',
    ResourceLeak = 'Resource Leak',
    PerformanceBottleneck = 'Performance Bottleneck',
    InefficientLoop = 'Inefficient Loop',
    UnnecessaryObjectCreation = 'Unnecessary Object Creation',
    HighComplexity = 'High Complexity Function',
    DeadCode = 'Dead Code',
    UnusedVariable = 'Unused Variable',
    UnreachableCode = 'Unreachable Code',
    SecurityVulnerability = 'Security Vulnerability',
    SQLInjection = 'SQL Injection Risk',
    CommandInjection = 'Command Injection Risk',
    XSSRisk = 'XSS Risk',
    ImproperInputValidation = 'Improper Input Validation',
    HardcodedSecret = 'Hardcoded Secret',
    BadPractice = 'Bad Coding Practice',
    InconsistentNaming = 'Inconsistent Naming',
    PoorErrorHandling = 'Poor Error Handling',
    RaceCondition = 'Race Condition',
    ConcurrencyProblem = 'Concurrency Problem',
    BlockingIO = 'Blocking I/O',
    MissingEdgeCase = 'Missing Edge Case Handling',
    RuntimeRisk = 'Runtime Risk (Predicted)'
}

export interface ReviewIssue {
    file: string;
    line: number;
    endLine?: number;
    column?: number;
    endColumn?: number;
    severity: IssueSeverity;
    category: IssueCategory;
    message: string;
    explanation: string;
    suggestedFix: string;
    confidence: number;
    ruleId?: string;
}

export interface ReviewResult {
    file: string;
    language: string;
    issues: ReviewIssue[];
    scannedAt: Date;
    duration: number;
}

export interface ReviewSummary {
    projectName: string;
    date: Date;
    scannedFiles: string[];
    totalIssues: number;
    severityBreakdown: Record<string, number>;
    categoryBreakdown: Record<string, number>;
    results: ReviewResult[];
    duration: number;
}

export interface AnalyzerPattern {
    pattern: RegExp;
    category: IssueCategory;
    severity: IssueSeverity;
    message: string;
    explanation: string;
    suggestedFix: string;
    confidence: number;
    languages?: string[];
}

export interface CustomRule {
    id: string;
    pattern: string;
    severity: string;
    message: string;
    explanation?: string;
    suggestedFix?: string;
    languages?: string[];
}

export interface ReviewerConfig {
    maxFunctionLength: number;
    maxCyclomaticComplexity: number;
    forbiddenFunctions: string[];
    customRules: CustomRule[];
    ignorePaths: string[];
    severityThreshold: IssueSeverity;
    /** Minimum confidence (0-1) to report an issue. Default: 0.6 */
    confidenceThreshold: number;
    /** Functions / identifiers to never flag */
    whitelistedFunctions: string[];
    /** Regex pattern strings to never flag */
    whitelistedPatterns: string[];
    /** Frameworks to force-enable (e.g. ["angular", "react", "node"]) */
    enableFrameworks: string[];
    /** Minimum number of lines for duplicate code detection */
    minDuplicateLines: number;
}
