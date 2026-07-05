import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { Configuration } from '../src';
import { BigOService } from '../src';

describe('BigOService', () => {
  function createRepository(files: Record<string, string>) {
    const root = path.join(tmpdir(), `smm-big-o-${Date.now()}-${Math.random()}`);
    mkdirSync(root, { recursive: true });

    for (const [filePath, content] of Object.entries(files)) {
      const absolutePath = path.join(root, filePath);
      mkdirSync(path.dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, content);
    }

    return {
      root,
      service: new BigOService(new Configuration({ gitRepositoryLocation: root })),
      cleanup: () => rmSync(root, { recursive: true, force: true }),
    };
  }

  it('lists searchable source files with a complexity score', async () => {
    const repo = createRepository({
      'src/linear.ts': 'for (const item of items) {\n  console.log(item);\n}',
      'docs/readme.md': '# ignored',
    });

    try {
      const files = await repo.service.listFiles({ search: 'linear' });

      expect(files).toEqual([
        {
          filePath: 'src/linear.ts',
          fileName: 'linear.ts',
          classification: 'O(n)',
          score: 38,
          needsHelp: false,
        },
      ]);
    } finally {
      repo.cleanup();
    }
  });

  it('filters source files using repository-relative glob patterns', async () => {
    const repo = createRepository({
      'components/Button.tsx': 'items.map((item) => item.id);',
      'components/forms/TextInput.tsx': 'const value = props.value;',
      'src/components/Nested.tsx': 'for (const item of items) {}',
      'src/index.ts': 'const value = 1;',
    });

    try {
      const files = await repo.service.listFiles({ search: 'components/**' });

      expect(files.map((file) => file.filePath)).toEqual([
        'components/Button.tsx',
        'components/forms/TextInput.tsx',
      ]);
    } finally {
      repo.cleanup();
    }
  });

  it('supports single-segment wildcard patterns', async () => {
    const repo = createRepository({
      'components/Button.tsx': 'items.map((item) => item.id);',
      'components/forms/TextInput.tsx': 'const value = props.value;',
    });

    try {
      const files = await repo.service.listFiles({ search: 'components/*.tsx' });

      expect(files.map((file) => file.filePath)).toEqual(['components/Button.tsx']);
    } finally {
      repo.cleanup();
    }
  });

  it('applies include and ignore patterns before search', async () => {
    const repo = createRepository({
      'components/Button.tsx': 'items.map((item) => item.id);',
      'components/Button.test.tsx': 'items.map((item) => item.id);',
      'components/forms/TextInput.tsx': 'const value = props.value;',
      'src/components/Button.tsx': 'for (const item of items) {}',
    });

    try {
      const files = await repo.service.listFiles({
        includePatterns: 'components/**',
        ignorePatterns: '*.test.tsx',
        search: 'button',
      });

      expect(files.map((file) => file.filePath)).toEqual(['components/Button.tsx']);
    } finally {
      repo.cleanup();
    }
  });

  it('returns line-level classifications for a selected file', async () => {
    const repo = createRepository({
      'src/nested.ts': [
        'for (const row of rows) {',
        '  for (const column of row.columns) {',
        '    console.log(column);',
        '  }',
        '}',
      ].join('\n'),
    });

    try {
      const analysis = await repo.service.analyzeFile('src/nested.ts');

      expect(analysis.classification).toBe('O(n^2)');
      expect(analysis.needsHelp).toBe(true);
      expect(analysis.lines).toEqual([
        expect.objectContaining({ lineNumber: 1, classification: 'O(n)' }),
        expect.objectContaining({ lineNumber: 2, classification: 'O(n^2)' }),
      ]);
    } finally {
      repo.cleanup();
    }
  });

  it('rejects paths outside the configured repository', async () => {
    const repo = createRepository({ 'src/index.ts': 'const value = 1;' });

    try {
      await expect(repo.service.analyzeFile('../outside.ts')).rejects.toThrow(
        'File path must be inside the configured repository'
      );
    } finally {
      repo.cleanup();
    }
  });
});
