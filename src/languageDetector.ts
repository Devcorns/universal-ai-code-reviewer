/** Language detection based on file extensions */

export interface LanguageInfo {
    id: string;
    name: string;
    family: LanguageFamily;
    extensions: string[];
}

export enum LanguageFamily {
    CStyle = 'c-style',
    Scripting = 'scripting',
    Markup = 'markup',
    Data = 'data',
    Shell = 'shell',
    Infrastructure = 'infrastructure'
}

const LANGUAGES: LanguageInfo[] = [
    { id: 'javascript', name: 'JavaScript', family: LanguageFamily.CStyle, extensions: ['.js', '.jsx', '.mjs', '.cjs'] },
    { id: 'typescript', name: 'TypeScript', family: LanguageFamily.CStyle, extensions: ['.ts', '.tsx', '.mts', '.cts'] },
    { id: 'python', name: 'Python', family: LanguageFamily.Scripting, extensions: ['.py', '.pyw'] },
    { id: 'java', name: 'Java', family: LanguageFamily.CStyle, extensions: ['.java'] },
    { id: 'c', name: 'C', family: LanguageFamily.CStyle, extensions: ['.c', '.h'] },
    { id: 'cpp', name: 'C++', family: LanguageFamily.CStyle, extensions: ['.cpp', '.cc', '.cxx', '.hpp', '.hh', '.hxx'] },
    { id: 'csharp', name: 'C#', family: LanguageFamily.CStyle, extensions: ['.cs'] },
    { id: 'go', name: 'Go', family: LanguageFamily.CStyle, extensions: ['.go'] },
    { id: 'rust', name: 'Rust', family: LanguageFamily.CStyle, extensions: ['.rs'] },
    { id: 'php', name: 'PHP', family: LanguageFamily.CStyle, extensions: ['.php', '.phtml'] },
    { id: 'ruby', name: 'Ruby', family: LanguageFamily.Scripting, extensions: ['.rb', '.erb'] },
    { id: 'swift', name: 'Swift', family: LanguageFamily.CStyle, extensions: ['.swift'] },
    { id: 'kotlin', name: 'Kotlin', family: LanguageFamily.CStyle, extensions: ['.kt', '.kts'] },
    { id: 'dart', name: 'Dart', family: LanguageFamily.CStyle, extensions: ['.dart'] },
    { id: 'html', name: 'HTML', family: LanguageFamily.Markup, extensions: ['.html', '.htm'] },
    { id: 'css', name: 'CSS', family: LanguageFamily.Markup, extensions: ['.css'] },
    { id: 'scss', name: 'SCSS', family: LanguageFamily.Markup, extensions: ['.scss', '.sass'] },
    { id: 'sql', name: 'SQL', family: LanguageFamily.Data, extensions: ['.sql'] },
    { id: 'shellscript', name: 'Shell/Bash', family: LanguageFamily.Shell, extensions: ['.sh', '.bash'] },
    { id: 'powershell', name: 'PowerShell', family: LanguageFamily.Shell, extensions: ['.ps1', '.psm1', '.psd1'] },
    { id: 'json', name: 'JSON', family: LanguageFamily.Data, extensions: ['.json', '.jsonc'] },
    { id: 'yaml', name: 'YAML', family: LanguageFamily.Data, extensions: ['.yml', '.yaml'] },
    { id: 'dockerfile', name: 'Dockerfile', family: LanguageFamily.Infrastructure, extensions: ['.dockerfile'] },
    { id: 'terraform', name: 'Terraform', family: LanguageFamily.Infrastructure, extensions: ['.tf', '.tfvars'] }
];

const EXT_MAP = new Map<string, LanguageInfo>();
for (const lang of LANGUAGES) {
    for (const ext of lang.extensions) {
        EXT_MAP.set(ext, lang);
    }
}

/** Detect language from a file path */
export function detectLanguage(filePath: string): LanguageInfo | undefined {
    const lower = filePath.toLowerCase();

    // Handle Dockerfile (no extension)
    if (lower.endsWith('dockerfile') || lower.includes('dockerfile.')) {
        return LANGUAGES.find(l => l.id === 'dockerfile');
    }

    const dotIndex = lower.lastIndexOf('.');
    if (dotIndex === -1) { return undefined; }

    const ext = lower.substring(dotIndex);
    return EXT_MAP.get(ext);
}

/** Check if a file path is a supported language */
export function isSupportedFile(filePath: string): boolean {
    return detectLanguage(filePath) !== undefined;
}

/** Get all supported file extensions */
export function getSupportedExtensions(): string[] {
    return LANGUAGES.flatMap(l => l.extensions);
}
