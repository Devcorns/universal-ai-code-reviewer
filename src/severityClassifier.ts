/** Severity classification utilities */

import { IssueSeverity, IssueCategory, SEVERITY_ORDER } from './issueTypes.js';

const CATEGORY_BASE_SEVERITY: Record<IssueCategory, IssueSeverity> = {
    [IssueCategory.SyntaxError]: IssueSeverity.High,
    [IssueCategory.LogicalBug]: IssueSeverity.High,
    [IssueCategory.RuntimeException]: IssueSeverity.High,
    [IssueCategory.NullReference]: IssueSeverity.High,
    [IssueCategory.MemoryLeak]: IssueSeverity.Critical,
    [IssueCategory.ResourceLeak]: IssueSeverity.High,
    [IssueCategory.PerformanceBottleneck]: IssueSeverity.Medium,
    [IssueCategory.InefficientLoop]: IssueSeverity.Medium,
    [IssueCategory.UnnecessaryObjectCreation]: IssueSeverity.Low,
    [IssueCategory.HighComplexity]: IssueSeverity.Medium,
    [IssueCategory.DeadCode]: IssueSeverity.Low,
    [IssueCategory.UnusedVariable]: IssueSeverity.Low,
    [IssueCategory.UnreachableCode]: IssueSeverity.Medium,
    [IssueCategory.SecurityVulnerability]: IssueSeverity.Critical,
    [IssueCategory.SQLInjection]: IssueSeverity.Critical,
    [IssueCategory.CommandInjection]: IssueSeverity.Critical,
    [IssueCategory.XSSRisk]: IssueSeverity.Critical,
    [IssueCategory.ImproperInputValidation]: IssueSeverity.High,
    [IssueCategory.HardcodedSecret]: IssueSeverity.Critical,
    [IssueCategory.BadPractice]: IssueSeverity.Low,
    [IssueCategory.InconsistentNaming]: IssueSeverity.Low,
    [IssueCategory.PoorErrorHandling]: IssueSeverity.Medium,
    [IssueCategory.RaceCondition]: IssueSeverity.High,
    [IssueCategory.ConcurrencyProblem]: IssueSeverity.High,
    [IssueCategory.BlockingIO]: IssueSeverity.Medium,
    [IssueCategory.MissingEdgeCase]: IssueSeverity.Medium,
    [IssueCategory.RuntimeRisk]: IssueSeverity.High
};

/** Get the default severity for a given issue category */
export function getDefaultSeverity(category: IssueCategory): IssueSeverity {
    return CATEGORY_BASE_SEVERITY[category] ?? IssueSeverity.Medium;
}

/** Check if a severity meets the minimum threshold */
export function meetsThreshold(severity: IssueSeverity, threshold: IssueSeverity): boolean {
    return SEVERITY_ORDER[severity] >= SEVERITY_ORDER[threshold];
}

/** Sort issues by severity (critical first) */
export function sortBySeverity<T extends { severity: IssueSeverity }>(issues: T[]): T[] {
    return [...issues].sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]);
}
