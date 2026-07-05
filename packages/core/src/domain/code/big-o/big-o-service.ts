import { promises as fs, readFileSync } from 'fs';
import * as path from 'path';
import type { Configuration } from '../../../infrastructure';
import {
  createPathMatchers,
  isGlobPattern,
  matchesAnyPathPattern,
  matchesIncludePatterns,
} from '../pattern-filters';

export type BigOClassification = 'O(1)' | 'O(log n)' | 'O(n)' | 'O(n log n)' | 'O(n^2)' | 'O(n^3+)';

export interface BigOFileSummary {
  filePath: string;
  fileName: string;
  classification: BigOClassification;
  score: number;
  needsHelp: boolean;
}

export interface BigOLineClassification {
  lineNumber: number;
  content: string;
  classification: BigOClassification;
  reason: string;
}

export interface BigOFileAnalysis extends BigOFileSummary {
  content: string;
  lines: BigOLineClassification[];
}

type LineSignal = {
  lineNumber: number;
  content: string;
  classification: BigOClassification;
  reason: string;
  weight: number;
};

const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.next',
  '.turbo',
  'coverage',
  'dist',
  'build',
  'node_modules',
  'out',
]);

const ANALYZABLE_EXTENSIONS = new Set([
  '.c',
  '.cc',
  '.cpp',
  '.cs',
  '.go',
  '.java',
  '.js',
  '.jsx',
  '.kt',
  '.mjs',
  '.php',
  '.py',
  '.rb',
  '.rs',
  '.swift',
  '.ts',
  '.tsx',
]);

const CLASSIFICATION_WEIGHT: Record<BigOClassification, number> = {
  'O(1)': 1,
  'O(log n)': 2,
  'O(n)': 3,
  'O(n log n)': 4,
  'O(n^2)': 5,
  'O(n^3+)': 6,
};

export class BigOService {
  constructor(private readonly configuration: Configuration) {}

  async listFiles(
    options: {
      search?: string;
      ignorePatterns?: string | string[];
      includePatterns?: string | string[];
      limit?: number;
    } = {}
  ): Promise<BigOFileSummary[]> {
    const repository = this.getRepositoryLocation();
    const files = await this.walk(repository);
    const matcher = this.createSearchMatcher(options.search);
    const includeMatchers = createPathMatchers(options.includePatterns, { splitOnNewline: true });
    const ignoreMatchers = createPathMatchers(options.ignorePatterns, { splitOnNewline: true });
    const limit = options.limit ?? 200;

    return files
      .filter((filePath) => this.matchesIncludePatterns(filePath, includeMatchers))
      .filter((filePath) => !this.matchesAnyPattern(filePath, ignoreMatchers))
      .filter((filePath) => !matcher || matcher(filePath))
      .slice(0, limit)
      .map((filePath) => this.analyzeSummary(repository, filePath));
  }

  async analyzeFile(filePath: string): Promise<BigOFileAnalysis> {
    const repository = this.getRepositoryLocation();
    const absolutePath = this.resolveRepositoryFile(repository, filePath);
    const content = await fs.readFile(absolutePath, 'utf8');
    const relativePath = this.toRelativePath(repository, absolutePath);
    const signals = this.classifyLines(content);
    const summary = this.toSummary(relativePath, signals);

    return {
      ...summary,
      content,
      lines: signals.map(({ weight: _weight, ...signal }) => signal),
    };
  }

  private analyzeSummary(repository: string, relativePath: string): BigOFileSummary {
    return this.toSummary(relativePath, this.classifyLinesFromFile(repository, relativePath));
  }

  private classifyLinesFromFile(repository: string, relativePath: string): LineSignal[] {
    const absolutePath = path.join(repository, relativePath);
    try {
      const content = readFileSync(absolutePath, 'utf8');
      return this.classifyLines(content);
    } catch {
      return [];
    }
  }

  private classifyLines(content: string): LineSignal[] {
    const lines = content.split(/\r?\n/);
    const signals: LineSignal[] = [];
    let loopDepth = 0;
    let braceDepth = 0;
    const loopDepths: number[] = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      const closedBefore = (trimmed.match(/}/g) ?? []).length;

      for (let i = 0; i < closedBefore; i += 1) {
        if (loopDepths[loopDepths.length - 1] === braceDepth) {
          loopDepths.pop();
          loopDepth = Math.max(0, loopDepth - 1);
        }
        braceDepth = Math.max(0, braceDepth - 1);
      }

      const signal = this.classifyLine(trimmed, loopDepth, index + 1, line);
      if (signal) {
        signals.push(signal);
      }

      if (this.isLoop(trimmed)) {
        loopDepth += 1;
        loopDepths.push(braceDepth + ((trimmed.match(/{/g) ?? []).length > 0 ? 1 : 0));
      }

      const openedAfter = (trimmed.match(/{/g) ?? []).length;
      braceDepth += openedAfter;
    });

    return signals;
  }

  private classifyLine(
    trimmed: string,
    loopDepth: number,
    lineNumber: number,
    content: string
  ): LineSignal | null {
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) {
      return null;
    }

    if (/\b(sort|sorted|orderBy|OrderBy)\s*\(/.test(trimmed)) {
      return {
        lineNumber,
        content,
        classification: loopDepth > 0 ? 'O(n^2)' : 'O(n log n)',
        reason: loopDepth > 0 ? 'sort inside an iteration' : 'sorting operation',
        weight: loopDepth > 0 ? 5 : 4,
      };
    }

    if (/\b(binarySearch|bisect|lower_bound|upper_bound)\b/.test(trimmed)) {
      return {
        lineNumber,
        content,
        classification: 'O(log n)',
        reason: 'binary search pattern',
        weight: 2,
      };
    }

    if (
      this.isLoop(trimmed) ||
      /\.(map|filter|reduce|forEach|some|every|find)\s*\(/.test(trimmed)
    ) {
      const nestedDepth = Math.max(1, loopDepth + 1);
      const classification = this.classificationForLoopDepth(nestedDepth);
      return {
        lineNumber,
        content,
        classification,
        reason: nestedDepth > 1 ? `nested iteration depth ${nestedDepth}` : 'linear iteration',
        weight: CLASSIFICATION_WEIGHT[classification],
      };
    }

    return null;
  }

  private classificationForLoopDepth(depth: number): BigOClassification {
    if (depth <= 1) return 'O(n)';
    if (depth === 2) return 'O(n^2)';
    return 'O(n^3+)';
  }

  private toSummary(relativePath: string, signals: LineSignal[]): BigOFileSummary {
    const topSignal = signals.reduce<LineSignal | null>(
      (highest, signal) => (!highest || signal.weight > highest.weight ? signal : highest),
      null
    );
    const classification = topSignal?.classification ?? 'O(1)';
    const score = Math.min(100, Math.round((topSignal?.weight ?? 1) * 12 + signals.length * 2));

    return {
      filePath: relativePath,
      fileName: path.basename(relativePath),
      classification,
      score,
      needsHelp: score >= 60,
    };
  }

  private async walk(root: string, current = root): Promise<string[]> {
    const entries = await fs.readdir(current, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) {
          files.push(...(await this.walk(root, absolutePath)));
        }
        continue;
      }

      if (entry.isFile() && ANALYZABLE_EXTENSIONS.has(path.extname(entry.name))) {
        files.push(this.toRelativePath(root, absolutePath));
      }
    }

    return files.sort((a, b) => a.localeCompare(b));
  }

  private resolveRepositoryFile(repository: string, filePath: string): string {
    const absolutePath = path.resolve(repository, filePath);
    const relative = path.relative(repository, absolutePath);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('File path must be inside the configured repository');
    }

    return absolutePath;
  }

  private getRepositoryLocation(): string {
    if (!this.configuration.gitRepositoryLocation) {
      throw new Error('Git repository location is required for Big O analysis');
    }

    return path.resolve(this.configuration.gitRepositoryLocation);
  }

  private toRelativePath(root: string, absolutePath: string): string {
    return path.relative(root, absolutePath).split(path.sep).join('/');
  }

  private createSearchMatcher(search?: string): ((filePath: string) => boolean) | null {
    const normalizedSearch = search?.trim().replace(/\\/g, '/');

    if (!normalizedSearch) {
      return null;
    }

    if (!isGlobPattern(normalizedSearch)) {
      const loweredSearch = normalizedSearch.toLowerCase();
      return (filePath) => filePath.toLowerCase().includes(loweredSearch);
    }

    const searchMatcher = createPathMatchers(normalizedSearch, {
      matchBasenameWhenPatternHasNoSlash: false,
    })[0];
    return searchMatcher;
  }

  private matchesIncludePatterns(
    filePath: string,
    includeMatchers: Array<(filePath: string) => boolean>
  ): boolean {
    return matchesIncludePatterns(filePath, includeMatchers);
  }

  private matchesAnyPattern(
    filePath: string,
    matchers: Array<(filePath: string) => boolean>
  ): boolean {
    return matchesAnyPathPattern(filePath, matchers);
  }

  private isLoop(line: string): boolean {
    return /\b(for|while)\s*\(|\bfor\s+\w+\s+in\b|\bfor\s+\w+\s+of\b/.test(line);
  }
}
