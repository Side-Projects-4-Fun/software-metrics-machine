import { describe, expect, it } from 'vitest';
import {
  createPathMatchers,
  matchesAnyPathPattern,
  matchesIncludePatterns,
  normalizePatternList,
} from '../pattern-filters';

describe('pattern filters', () => {
  it('normalizes comma-separated patterns by default', () => {
    expect(normalizePatternList(' src/**, *.test.ts ,,README.md ')).toEqual([
      'src/**',
      '*.test.ts',
      'README.md',
    ]);
  });

  it('can normalize newline-separated patterns for text-area style inputs', () => {
    expect(normalizePatternList('src/**\n*.test.ts', { splitOnNewline: true })).toEqual([
      'src/**',
      '*.test.ts',
    ]);
  });

  it('matches substring, basename glob, and repository-relative glob patterns', () => {
    const matchers = createPathMatchers(['button', '*.test.ts', 'src/**']);

    expect(matchesAnyPathPattern('components/Button.tsx', matchers)).toBe(true);
    expect(matchesAnyPathPattern('components/Button.test.ts', matchers)).toBe(true);
    expect(matchesAnyPathPattern('src/components/Nested.tsx', matchers)).toBe(true);
    expect(matchesAnyPathPattern('docs/readme.md', matchers)).toBe(false);
  });

  it('treats empty include patterns as include everything', () => {
    expect(matchesIncludePatterns('src/index.ts', [])).toBe(true);
  });

  it('can require slashless globs to match the whole repository-relative path', () => {
    const matchers = createPathMatchers('*.ts', {
      matchBasenameWhenPatternHasNoSlash: false,
    });

    expect(matchesAnyPathPattern('index.ts', matchers)).toBe(true);
    expect(matchesAnyPathPattern('src/index.ts', matchers)).toBe(false);
  });
});
