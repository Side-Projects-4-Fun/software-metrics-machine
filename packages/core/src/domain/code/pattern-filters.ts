import path from 'path';

export type PatternList = string | string[] | undefined;

export type PatternMatcher = (filePath: string) => boolean;

type NormalizePatternOptions = {
  splitOnNewline?: boolean;
};

type PathMatcherOptions = {
  matchBasenameWhenPatternHasNoSlash?: boolean;
};

export function normalizePatternList(
  value?: PatternList,
  options: NormalizePatternOptions = {}
): string[] {
  if (!value) {
    return [];
  }

  const separator = options.splitOnNewline ? /[,\n]/ : ',';
  const values = Array.isArray(value) ? value : [value];

  return values
    .flatMap((item) => String(item).split(separator))
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function createPathMatcher(
  pattern: string,
  options: PathMatcherOptions = {}
): PatternMatcher {
  const normalizedPattern = pattern.trim().replace(/\\/g, '/');
  const matchBasenameWhenPatternHasNoSlash = options.matchBasenameWhenPatternHasNoSlash ?? true;

  if (!isGlobPattern(normalizedPattern)) {
    const loweredPattern = normalizedPattern.toLowerCase();
    return (filePath) => filePath.toLowerCase().replace(/\\/g, '/').includes(loweredPattern);
  }

  const regex = globToRegex(normalizedPattern);

  if (matchBasenameWhenPatternHasNoSlash && !normalizedPattern.includes('/')) {
    return (filePath) => regex.test(path.posix.basename(filePath.replace(/\\/g, '/')));
  }

  return (filePath) => regex.test(filePath.replace(/\\/g, '/'));
}

export function createPathMatchers(
  value?: PatternList,
  options: NormalizePatternOptions & PathMatcherOptions = {}
): PatternMatcher[] {
  return normalizePatternList(value, options).map((pattern) => createPathMatcher(pattern, options));
}

export function matchesAnyPathPattern(filePath: string, matchers: PatternMatcher[]): boolean {
  return matchers.some((matcher) => matcher(filePath));
}

export function matchesIncludePatterns(
  filePath: string,
  includeMatchers: PatternMatcher[]
): boolean {
  if (includeMatchers.length === 0) {
    return true;
  }

  return matchesAnyPathPattern(filePath, includeMatchers);
}

export function matchesPathPattern(filePath: string, pattern: string): boolean {
  return createPathMatcher(pattern)(filePath);
}

export function isGlobPattern(value: string): boolean {
  return /[*?[\]]/.test(value);
}

function globToRegex(pattern: string): RegExp {
  let expression = '^';

  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    const nextCharacter = pattern[index + 1];

    if (character === '*' && nextCharacter === '*') {
      expression += '.*';
      index += 1;
      continue;
    }

    if (character === '*') {
      expression += '[^/]*';
      continue;
    }

    if (character === '?') {
      expression += '[^/]';
      continue;
    }

    expression += escapeRegexCharacter(character);
  }

  return new RegExp(`${expression}$`, 'i');
}

function escapeRegexCharacter(character: string): string {
  return character.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
}
