# Universal AI Code Reviewer

A production-grade Visual Studio Code extension that performs automated code analysis and review across **24+ programming languages**. It combines static analysis, pattern detection, heuristic analysis, and AI-assisted code understanding to detect bugs, security vulnerabilities, performance problems, and maintainability issues.

## Features

- **Multi-language support**: JavaScript, TypeScript, Python, Java, C, C++, C#, Go, Rust, PHP, Ruby, Swift, Kotlin, Dart, HTML, CSS, SCSS, SQL, Shell/Bash, PowerShell, JSON, YAML, Dockerfile, Terraform
- **Comprehensive issue detection**: Syntax errors, logical bugs, security vulnerabilities, performance bottlenecks, complexity issues, dead code, runtime risk prediction, and more
- **Deep VS Code integration**: Problems panel diagnostics, inline highlighting, quick fixes, status bar indicator, progress notifications
- **Multiple review modes**: Current file, entire workspace, selected folder, Git changed files, Git staged files
- **Report generation**: Markdown, JSON, and plain text reports
- **Custom rules**: Define project-specific rules via `codereviewer.config.json`
- **Ignore configuration**: Skip files/folders via `.codereviewerignore`
- **Git integration**: Review only changed or staged files
- **Auto-fix suggestions**: Quick fixes via VS Code's CodeAction API
- **Caching**: Analysis results are cached for performance

## Getting Started

```bash
# Install dependencies
npm install

# Compile the extension
npm run compile

# Press F5 in VS Code to launch the Extension Development Host
```

## Commands

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and type **"Code Reviewer"**:

| Command | Description |
|---------|-------------|
| Run Code Review (Current File) | Review the active editor file |
| Run Code Review (Workspace) | Review all supported files in the workspace |
| Run Code Review (Selected Folder) | Review all files in a selected folder |
| Review Git Changed Files | Review files with uncommitted changes |
| Review Git Staged Files | Review files staged for commit |
| Generate Review Report | Generate MD/JSON/TXT report from last review |

### Context Menu

- Right-click a **file** in Explorer → **Run Code Review (Current File)**
- Right-click a **folder** in Explorer → **Run Code Review (Selected Folder)**
- Right-click in **editor** → **Run Code Review (Current File)**

## Issue Categories

The reviewer detects and classifies these problem types:

- **Syntax Errors** — Structural code problems
- **Logical Bugs** — Loose equality, mutable defaults, etc.
- **Runtime Risk (Predicted)** — Null dereference, division by zero, array out of bounds
- **Security Vulnerabilities** — SQL injection, XSS, command injection, hardcoded secrets
- **Performance Bottlenecks** — N+1 queries, nested loops, blocking I/O
- **Complexity Issues** — Long functions, high cyclomatic complexity
- **Dead Code** — Unused variables, unreachable code, TODO/FIXME comments
- **Poor Error Handling** — Empty catch blocks, missing try-catch
- **Concurrency Problems** — Race conditions, unsynced shared state
- **Bad Practices** — var usage, magic numbers, forbidden functions

## Severity Levels

| Level | Description |
|-------|-------------|
| Critical | Security vulnerabilities, memory leaks, hardcoded secrets |
| High | Null dereference, logic errors, unchecked errors |
| Medium | Performance issues, missing edge cases, complexity |
| Low | Style issues, TODO comments, minor improvements |

## Configuration

### VS Code Settings

```json
{
  "universalReviewer.maxFunctionLength": 50,
  "universalReviewer.maxCyclomaticComplexity": 10,
  "universalReviewer.forbiddenFunctions": ["eval", "exec"],
  "universalReviewer.ignorePaths": ["node_modules", "dist", "build", ".git"],
  "universalReviewer.reportFormat": ["markdown", "json", "text"],
  "universalReviewer.severityThreshold": "Low"
}
```

### Custom Rules (`codereviewer.config.json`)

Place this file in your workspace root to define project-specific rules:

```json
{
  "maxFunctionLength": 40,
  "maxCyclomaticComplexity": 8,
  "forbiddenFunctions": ["eval", "exec", "document.write"],
  "customRules": [
    {
      "id": "no-any-type",
      "pattern": ":\\s*any\\b",
      "severity": "Medium",
      "message": "Avoid using 'any' type",
      "languages": ["typescript"]
    }
  ]
}
```

### Ignore File (`.codereviewerignore`)

Place this file in your workspace root. Uses `.gitignore`-style patterns:

```
node_modules
dist
*.min.js
*.generated.*
__snapshots__
```

## Report Output

After running a review, use **Generate Review Report** to produce:

- `code-review-report.md` — Formatted Markdown report
- `code-review-report.json` — Machine-readable JSON report
- `code-review-report.txt` — Plain text report

## Project Structure

```
src/
  extension.ts          — Extension entry point
  reviewController.ts   — VS Code integration (commands, diagnostics, code actions)
  reviewerEngine.ts     — Main review orchestrator
  aiReviewEngine.ts     — AI-assisted contextual analysis
  runtimeAnalyzer.ts    — Runtime risk prediction
  languageDetector.ts   — Automatic language detection
  astAnalyzer.ts        — AST-style structural analysis
  securityScanner.ts    — Security vulnerability scanner
  performanceAnalyzer.ts — Performance anti-pattern detection
  complexityAnalyzer.ts — Cyclomatic complexity / function length
  ruleEngine.ts         — Custom rule processing
  reportGenerator.ts    — Report generation (MD, JSON, TXT)
  gitIntegration.ts     — Git changed/staged file detection
  issueTypes.ts         — Core type definitions
  severityClassifier.ts — Severity classification utilities
config/
  defaultRules.json     — Default rule configuration
```

## Sample Test Project

The `sample-test-project/` folder contains files with intentional issues for testing:

- `app.js` — JavaScript sample with security, style, and logic issues
- `app.py` — Python sample with common Python anti-patterns
- `service.ts` — TypeScript sample with type safety and async issues

## Requirements

- VS Code 1.109.0 or later
- Node.js 18+ (for development)

## License

MIT
