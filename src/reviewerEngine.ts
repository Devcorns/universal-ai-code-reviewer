/** Main review engine orchestrator — coordinates all analyzers */

import { ReviewIssue, ReviewResult, ReviewerConfig, IssueSeverity, SEVERITY_ORDER } from './issueTypes.js';
import { detectLanguage, LanguageInfo } from './languageDetector.js';
import { SecurityScanner } from './securityScanner.js';
import { PerformanceAnalyzer } from './performanceAnalyzer.js';
import { ComplexityAnalyzer } from './complexityAnalyzer.js';
import { RuntimeAnalyzer } from './runtimeAnalyzer.js';
import { AstAnalyzer } from './astAnalyzer.js';
import { RuleEngine } from './ruleEngine.js';
import { AiReviewEngine } from './aiReviewEngine.js';
import { meetsThreshold } from './severityClassifier.js';
import { FalsePositiveFilter, isExcludedPath } from './falsePositiveFilter.js';

export class ReviewerEngine {
    private securityScanner: SecurityScanner;
    private performanceAnalyzer: PerformanceAnalyzer;
    private complexityAnalyzer: ComplexityAnalyzer;
    private runtimeAnalyzer: RuntimeAnalyzer;
    private astAnalyzer: AstAnalyzer;
    private ruleEngine: RuleEngine;
    private aiReviewEngine: AiReviewEngine;
    private config: ReviewerConfig;
    private fpFilter: FalsePositiveFilter;

    // Cache: file path -> result (invalidated when content changes)
    private cache = new Map<string, { hash: number; result: ReviewResult }>();

    constructor(config: ReviewerConfig) {
        this.config = config;
        this.securityScanner = new SecurityScanner();
        this.performanceAnalyzer = new PerformanceAnalyzer();
        this.complexityAnalyzer = new ComplexityAnalyzer();
        this.runtimeAnalyzer = new RuntimeAnalyzer();
        this.astAnalyzer = new AstAnalyzer();
        this.ruleEngine = new RuleEngine(config);
        this.aiReviewEngine = new AiReviewEngine();
        this.fpFilter = new FalsePositiveFilter({
            confidenceThreshold: config.confidenceThreshold,
            whitelistedFunctions: config.whitelistedFunctions,
            whitelistedPatterns: config.whitelistedPatterns,
            enableFrameworks: config.enableFrameworks,
            minDuplicateLines: config.minDuplicateLines
        });

        // Wire duplicate line minimum and framework detector into AI engine
        this.aiReviewEngine.setMinDuplicateLines(config.minDuplicateLines);
        this.aiReviewEngine.setFrameworkDetector(this.fpFilter.getFrameworkDetector());
    }

    /** Update configuration at runtime */
    updateConfig(config: ReviewerConfig): void {
        this.config = config;
        this.ruleEngine.updateRules(config.customRules);
        this.fpFilter.updateConfig({
            confidenceThreshold: config.confidenceThreshold,
            whitelistedFunctions: config.whitelistedFunctions,
            whitelistedPatterns: config.whitelistedPatterns,
            enableFrameworks: config.enableFrameworks,
            minDuplicateLines: config.minDuplicateLines
        });
        this.aiReviewEngine.setMinDuplicateLines(config.minDuplicateLines);
        this.aiReviewEngine.setFrameworkDetector(this.fpFilter.getFrameworkDetector());
    }

    /** Review a single file */
    reviewFile(filePath: string, content: string): ReviewResult {
        const start = Date.now();

        // Hard exclusion: never analyze files in excluded directories
        if (isExcludedPath(filePath)) {
            return {
                file: filePath,
                language: 'excluded',
                issues: [],
                scannedAt: new Date(),
                duration: Date.now() - start
            };
        }

        const langInfo = detectLanguage(filePath);

        if (!langInfo) {
            return {
                file: filePath,
                language: 'unknown',
                issues: [],
                scannedAt: new Date(),
                duration: Date.now() - start
            };
        }

        // Check cache
        const hash = this.hashContent(content);
        const cached = this.cache.get(filePath);
        if (cached && cached.hash === hash) {
            return cached.result;
        }

        const issues = this.runAllAnalyzers(filePath, content, langInfo);

        // Filter by severity threshold
        const filtered = issues.filter(i => meetsThreshold(i.severity, this.config.severityThreshold));

        // Apply false-positive filter (confidence, framework, whitelist)
        const fpFiltered = this.fpFilter.filterIssues(filtered, content, langInfo.id);

        // Deduplicate issues on the same line with the same category
        const deduped = this.deduplicateIssues(fpFiltered);

        // Sort by severity (critical first), then by line number
        deduped.sort((a, b) => {
            const sevDiff = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
            return sevDiff !== 0 ? sevDiff : a.line - b.line;
        });

        const result: ReviewResult = {
            file: filePath,
            language: langInfo.name,
            issues: deduped,
            scannedAt: new Date(),
            duration: Date.now() - start
        };

        // Update cache
        this.cache.set(filePath, { hash, result });

        return result;
    }

    /** Clear analysis cache */
    clearCache(): void {
        this.cache.clear();
    }

    /** Invalidate cache for a specific file */
    invalidateFile(filePath: string): void {
        this.cache.delete(filePath);
    }

    private runAllAnalyzers(filePath: string, content: string, langInfo: LanguageInfo): ReviewIssue[] {
        const allIssues: ReviewIssue[] = [];
        const { id: language, family } = langInfo;

        // Auto-detect frameworks from content
        this.fpFilter.getFrameworkDetector().detectFromContent(content);

        allIssues.push(...this.securityScanner.analyze(filePath, content, language));
        allIssues.push(...this.performanceAnalyzer.analyze(filePath, content, language));
        allIssues.push(...this.complexityAnalyzer.analyze(filePath, content, language, this.config));
        allIssues.push(...this.runtimeAnalyzer.analyze(filePath, content, language));
        allIssues.push(...this.astAnalyzer.analyze(filePath, content, language, family, this.config));
        allIssues.push(...this.ruleEngine.analyze(filePath, content, language));
        allIssues.push(...this.aiReviewEngine.analyze(filePath, content, language));

        return allIssues;
    }

    private deduplicateIssues(issues: ReviewIssue[]): ReviewIssue[] {
        const seen = new Set<string>();
        return issues.filter(issue => {
            const key = `${issue.line}:${issue.category}:${issue.message}`;
            if (seen.has(key)) { return false; }
            seen.add(key);
            return true;
        });
    }

    private hashContent(content: string): number {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0; // Convert to 32-bit integer
        }
        return hash;
    }
}
