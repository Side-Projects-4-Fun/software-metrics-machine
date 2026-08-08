import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';

/**
 * These packages contain Node.js built-in imports (node:fs, node:path)
 * and must never be imported by page files in the webapp.
 *
 * Importing them causes build/runtime errors like:
 *   Cannot find module 'node:fs': Unsupported external type Url for commonjs reference
 *
 * This happens because @smmachine/utils exports logger.ts and app-version.ts
 * which use node:fs / node:path, and @smmachine/core transitively depends on
 * @smmachine/utils.
 */
const FORBIDDEN_PACKAGES = ['@smmachine/core', '@smmachine/utils'];

function findPageFiles(rootDir: string): string[] {
  const results: string[] = [];

  function walk(dir: string): void {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory() && entry !== 'node_modules' && !entry.startsWith('.')) {
        walk(fullPath);
      } else if (stat.isFile() && entry === 'page.tsx') {
        results.push(fullPath);
      }
    }
  }

  walk(rootDir);
  return results;
}

function extractImports(filePath: string): string[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const imports: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Match static imports: import ... from '...'
    const staticMatch = trimmed.match(
      /^import\s+(?:type\s+)?(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"]([^'"]+)['"]/,
    );

    if (staticMatch) {
      imports.push(staticMatch[1]);
      continue;
    }

    // Match side-effect imports: import '...'
    const sideEffectMatch = trimmed.match(/^import\s+['"]([^'"]+)['"]/);

    if (sideEffectMatch) {
      imports.push(sideEffectMatch[1]);
      continue;
    }

    // Match dynamic imports: import('...')
    const dynamicMatches = trimmed.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g);

    for (const match of dynamicMatches) {
      imports.push(match[1]);
    }
  }

  return imports;
}

function isForbiddenImport(importPath: string): string | null {
  for (const forbidden of FORBIDDEN_PACKAGES) {
    if (importPath === forbidden) {
      return forbidden;
    }

    // Sub-path imports like @smmachine/core/something
    if (importPath.startsWith(`${forbidden}/`)) {
      return forbidden;
    }
  }

  return null;
}

describe('Server code boundary - page level', () => {
  const webappRoot = resolve(__dirname, '..');
  const appDir = join(webappRoot, 'app');
  const pageFiles = findPageFiles(appDir);

  if (pageFiles.length === 0) {
    test('no page files found', () => {
      throw new Error(`No page.tsx files found under ${appDir}`);
    });
  }

  test.each(
    pageFiles.map((absolutePath) => ({
      absolutePath,
      relativePath: relative(webappRoot, absolutePath),
    })),
  )(
    '$relativePath does not import server-only packages (@smmachine/core, @smmachine/utils)',
    ({ absolutePath, relativePath: relPath }) => {
      const imports = extractImports(absolutePath);
      const violations: Array<{ importPath: string; forbidden: string }> = [];

      for (const importPath of imports) {
        const forbidden = isForbiddenImport(importPath);

        if (forbidden) {
          violations.push({ importPath, forbidden });
        }
      }

      if (violations.length > 0) {
        const violationMessages = violations.map(
          (v) => `  imports "${v.importPath}" from forbidden package "${v.forbidden}"`,
        );

        throw new Error(
          `Page "${relPath}" imports server-only packages that contain Node.js built-ins (node:fs, node:path). ` +
            `These imports will cause build/runtime errors in client bundles.\n` +
            `Violations:\n${violationMessages.join('\n')}\n\n` +
            `Use @/server/api/* modules instead, which are guarded with 'server-only'.`,
        );
      }
    },
  );
});
