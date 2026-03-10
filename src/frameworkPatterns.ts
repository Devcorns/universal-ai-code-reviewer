/** Framework-aware pattern recognition to reduce false positives */

export interface FrameworkPattern {
    /** Pattern name for debugging */
    name: string;
    /** Regex matching code that should be whitelisted */
    pattern: RegExp;
    /** Which analyzer rule IDs this suppresses */
    suppressRules: string[];
    /** Languages this applies to */
    languages: string[];
}

export interface FrameworkConfig {
    name: string;
    /** File patterns that indicate this framework is in use */
    detectPatterns: RegExp[];
    /** Code patterns that are normal usage and should not be flagged */
    whitelistedPatterns: FrameworkPattern[];
}

// ─── Angular ────────────────────────────────────────────────────────────────

const ANGULAR_PATTERNS: FrameworkPattern[] = [
    // Routing — loadChildren, loadComponent, lazy loading
    {
        name: 'angular-routing-loadChildren',
        pattern: /loadChildren\s*:\s*\(\)\s*=>\s*import\s*\(/,
        suppressRules: ['ai/code-duplication', 'ast/unused-variable'],
        languages: ['typescript']
    },
    {
        name: 'angular-routing-loadComponent',
        pattern: /loadComponent\s*:\s*\(\)\s*=>\s*import\s*\(/,
        suppressRules: ['ai/code-duplication', 'ast/unused-variable'],
        languages: ['typescript']
    },
    {
        name: 'angular-route-definition',
        pattern: /(?:path|redirectTo|pathMatch|canActivate|canDeactivate|resolve|data|outlet)\s*:/,
        suppressRules: ['ai/code-duplication'],
        languages: ['typescript']
    },
    // Decorators
    {
        name: 'angular-component-decorator',
        pattern: /@Component\s*\(\s*\{/,
        suppressRules: ['ai/code-duplication', 'ast/magic-number'],
        languages: ['typescript']
    },
    {
        name: 'angular-injectable-decorator',
        pattern: /@Injectable\s*\(\s*\{/,
        suppressRules: ['ai/code-duplication'],
        languages: ['typescript']
    },
    {
        name: 'angular-ngmodule-decorator',
        pattern: /@NgModule\s*\(\s*\{/,
        suppressRules: ['ai/code-duplication'],
        languages: ['typescript']
    },
    {
        name: 'angular-directive-decorator',
        pattern: /@(?:Directive|Pipe|HostListener|HostBinding|Input|Output|ViewChild|ViewChildren|ContentChild|ContentChildren)\s*\(/,
        suppressRules: ['ai/code-duplication', 'ast/unused-variable'],
        languages: ['typescript']
    },
    // Dependency injection
    {
        name: 'angular-inject',
        pattern: /(?:inject|@Inject)\s*\(/,
        suppressRules: ['ai/code-duplication', 'ast/unused-variable'],
        languages: ['typescript']
    },
    {
        name: 'angular-constructor-injection',
        pattern: /constructor\s*\(\s*(?:private|public|protected|readonly)\s+\w+\s*:/,
        suppressRules: ['ai/code-duplication'],
        languages: ['typescript']
    },
    // Lifecycle hooks
    {
        name: 'angular-lifecycle-hooks',
        pattern: /ng(?:OnInit|OnDestroy|OnChanges|AfterViewInit|AfterContentInit|DoCheck|AfterViewChecked|AfterContentChecked)\s*\(\s*\)/,
        suppressRules: ['ai/code-duplication'],
        languages: ['typescript']
    },
    // RxJS patterns common in Angular
    {
        name: 'angular-rxjs-pipe',
        pattern: /\.pipe\s*\(\s*(?:map|filter|switchMap|mergeMap|concatMap|tap|catchError|takeUntil|debounceTime|distinctUntilChanged|combineLatest|forkJoin)\s*\(/,
        suppressRules: ['ai/code-duplication'],
        languages: ['typescript']
    },
    // providedIn root
    {
        name: 'angular-provided-in-root',
        pattern: /providedIn\s*:\s*['"`]root['"`]/,
        suppressRules: ['ai/code-duplication'],
        languages: ['typescript']
    }
];

// ─── React ──────────────────────────────────────────────────────────────────

const REACT_PATTERNS: FrameworkPattern[] = [
    // Hooks
    {
        name: 'react-hooks',
        pattern: /\b(?:useState|useEffect|useCallback|useMemo|useRef|useContext|useReducer|useLayoutEffect|useImperativeHandle)\s*\(/,
        suppressRules: ['ai/code-duplication'],
        languages: ['javascript', 'typescript']
    },
    // JSX patterns
    {
        name: 'react-jsx-return',
        pattern: /return\s*\(\s*</,
        suppressRules: ['ai/code-duplication'],
        languages: ['javascript', 'typescript']
    },
    // React.memo, forwardRef, lazy
    {
        name: 'react-hoc-patterns',
        pattern: /(?:React\.memo|React\.forwardRef|React\.lazy|memo|forwardRef|lazy)\s*\(/,
        suppressRules: ['ai/code-duplication', 'ast/unused-variable'],
        languages: ['javascript', 'typescript']
    },
    // PropTypes
    {
        name: 'react-proptypes',
        pattern: /\.propTypes\s*=\s*\{/,
        suppressRules: ['ai/code-duplication'],
        languages: ['javascript', 'typescript']
    },
    // React Router
    {
        name: 'react-router',
        pattern: /(?:Route|Switch|BrowserRouter|HashRouter|Link|NavLink|useNavigate|useParams|useLocation|useHistory)\b/,
        suppressRules: ['ai/code-duplication'],
        languages: ['javascript', 'typescript']
    },
    // Redux patterns
    {
        name: 'react-redux',
        pattern: /(?:useSelector|useDispatch|createSlice|createAsyncThunk|configureStore)\s*\(/,
        suppressRules: ['ai/code-duplication'],
        languages: ['javascript', 'typescript']
    },
    // dangerouslySetInnerHTML is already handled by security scanner, keep it
];

// ─── Node.js / Express ──────────────────────────────────────────────────────

const NODE_PATTERNS: FrameworkPattern[] = [
    // Express middleware pattern
    {
        name: 'node-express-middleware',
        pattern: /(?:app|router)\.\s*(?:get|post|put|delete|patch|use|all)\s*\(\s*['"`/]/,
        suppressRules: ['ai/code-duplication'],
        languages: ['javascript', 'typescript']
    },
    // Express error handler
    {
        name: 'node-express-error-handler',
        pattern: /\(\s*(?:err|error)\s*,\s*req\s*,\s*res\s*,\s*next\s*\)/,
        suppressRules: ['ai/code-duplication', 'ast/unused-variable'],
        languages: ['javascript', 'typescript']
    },
    // Module exports patterns
    {
        name: 'node-module-exports',
        pattern: /(?:module\.exports|exports\.\w+)\s*=/,
        suppressRules: ['ai/code-duplication'],
        languages: ['javascript']
    },
    // Middleware chaining (req, res, next)
    {
        name: 'node-req-res-next',
        pattern: /\(\s*req\s*,\s*res\s*(?:,\s*next)?\s*\)\s*(?:=>|{)/,
        suppressRules: ['ai/code-duplication'],
        languages: ['javascript', 'typescript']
    },
    // NestJS decorators
    {
        name: 'node-nestjs-decorators',
        pattern: /@(?:Controller|Get|Post|Put|Delete|Patch|Module|Injectable|Inject|Body|Param|Query|Headers|Guard|UseGuards|UseInterceptors|UsePipes)\s*\(/,
        suppressRules: ['ai/code-duplication', 'ast/unused-variable'],
        languages: ['typescript']
    },
    // process.env access patterns
    {
        name: 'node-process-env',
        pattern: /process\.env\.\w+/,
        suppressRules: ['ai/code-duplication'],
        languages: ['javascript', 'typescript']
    }
];

// ─── All Frameworks ─────────────────────────────────────────────────────────

const ALL_FRAMEWORK_CONFIGS: FrameworkConfig[] = [
    {
        name: 'angular',
        detectPatterns: [/@angular\/core/, /@Component\s*\(/, /@NgModule\s*\(/, /angular\.json/],
        whitelistedPatterns: ANGULAR_PATTERNS
    },
    {
        name: 'react',
        detectPatterns: [/from\s+['"]react['"]/, /require\s*\(\s*['"]react['"]/, /React\.createElement/],
        whitelistedPatterns: REACT_PATTERNS
    },
    {
        name: 'node',
        detectPatterns: [/require\s*\(\s*['"]express['"]/, /from\s+['"]express['"]/, /@nestjs\//, /from\s+['"]http['"]/],
        whitelistedPatterns: NODE_PATTERNS
    }
];

export class FrameworkDetector {
    private detectedFrameworks: Set<string> = new Set();
    private allPatterns: FrameworkPattern[] = [];

    /** Detect frameworks from file content and accumulate patterns */
    detectFromContent(content: string): void {
        for (const fw of ALL_FRAMEWORK_CONFIGS) {
            if (this.detectedFrameworks.has(fw.name)) { continue; }
            for (const dp of fw.detectPatterns) {
                if (dp.test(content)) {
                    this.detectedFrameworks.add(fw.name);
                    this.allPatterns.push(...fw.whitelistedPatterns);
                    break;
                }
            }
        }
    }

    /** Force-enable specific frameworks (e.g., from config) */
    enableFrameworks(names: string[]): void {
        for (const name of names) {
            const fw = ALL_FRAMEWORK_CONFIGS.find(f => f.name === name.toLowerCase());
            if (fw && !this.detectedFrameworks.has(fw.name)) {
                this.detectedFrameworks.add(fw.name);
                this.allPatterns.push(...fw.whitelistedPatterns);
            }
        }
    }

    /** Check if a specific line should suppress a given rule */
    shouldSuppress(line: string, ruleId: string, language: string): boolean {
        for (const fp of this.allPatterns) {
            if (!fp.languages.includes(language)) { continue; }
            if (!fp.suppressRules.includes(ruleId)) { continue; }
            if (fp.pattern.test(line)) { return true; }
        }
        return false;
    }

    /** Check if any line in a block matches a framework pattern for a rule */
    shouldSuppressBlock(blockLines: string[], ruleId: string, language: string): boolean {
        for (const line of blockLines) {
            if (this.shouldSuppress(line, ruleId, language)) { return true; }
        }
        return false;
    }

    getDetectedFrameworks(): string[] {
        return [...this.detectedFrameworks];
    }

    reset(): void {
        this.detectedFrameworks.clear();
        this.allPatterns = [];
    }
}
