# Change Log

All notable changes to the "Universal AI Code Reviewer" extension will be documented in this file.

## [2.0.0] — 2026-03-10

### Added
- **Framework Awareness System** — automatic detection and whitelisting for Angular, React, and Node.js patterns (routing, decorators, dependency injection, hooks, middleware).
- **AST-based Duplicate Detection** — structural code comparison that normalizes identifiers, strings, and numbers instead of raw text matching.
- **Confidence Scoring** — every issue now carries a confidence score; only issues with confidence > 60% are reported by default.
- **False Positive Filter** — central filter applying path exclusion, confidence threshold, framework-aware suppression, and user whitelist.
- **Configurable Whitelist** — `whitelistedFunctions` and `whitelistedPatterns` in `codereviewer.config.json` let users suppress specific patterns.
- **Framework Configuration** — `enableFrameworks` setting to force-enable Angular/React/Node pattern recognition.
- **Minimum Duplicate Block Size** — configurable `minDuplicateLines` (default: 5) to avoid flagging small similar blocks.

### Changed
- Files inside `node_modules`, `dist`, `build`, and `.git` are now **always excluded** from analysis, even if not listed in `ignorePaths`.
- Duplicate code detection uses structural fingerprinting instead of exact text comparison.
- Import/boilerplate lines are excluded from duplicate block analysis.

### Fixed
- Angular `loadChildren`/`loadComponent` routing patterns no longer flagged as duplicates.
- Decorator patterns (`@Component`, `@Injectable`, `@Controller`, etc.) no longer trigger false positives.
- React hooks and JSX return patterns no longer flagged for duplication.
- Express middleware and error handler patterns properly recognized.

## [1.0.0] — 2026-03-09

- Initial release