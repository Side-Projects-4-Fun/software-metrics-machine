/**
 * Utilities for handling CI/CD matrix jobs.
 *
 * When a job runs on a matrix, providers such as GitHub Actions append a
 * parenthesized index to each parallel leg's name (e.g. `test (1)`,
 * `test (2)`, `test (3)`). Because these legs execute in parallel, they share
 * the same wall-clock duration and should be treated as a single logical job
 * rather than as N independent jobs. Normalizing the name collapses all legs
 * onto their base name so grouping, lookups, and averages reflect the parallel
 * reality instead of fragmenting statistics.
 */

/**
 * Pattern matching a trailing matrix index, e.g. ` (1)`, ` (42)`.
 * Allows any whitespace before the parentheses to be tolerant of provider
 * formatting differences. Examples matched: `test (1)`, `build (12)`.
 */
const MATRIX_INDEX_PATTERN = /\s*\(\d+\)\s*$/;

/**
 * Normalize a job name by stripping a trailing matrix index such as ` (1)`.
 *
 * Examples:
 *   normalizeMatrixJobName('test (1)')   // => 'test'
 *   normalizeMatrixJobName('test (42)')  // => 'test'
 *   normalizeMatrixJobName('test')       // => 'test'
 *   normalizeMatrixJobName('deploy (prod) (1)') // => 'deploy (prod)'
 *
 * Non-matrix names are returned unchanged (after trimming).
 */
export function normalizeMatrixJobName(name: string | undefined | null): string {
  if (!name) {
    return '';
  }
  return name.trim().replace(MATRIX_INDEX_PATTERN, '').trim();
}
