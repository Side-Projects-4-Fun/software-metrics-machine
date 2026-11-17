const MATRIX_INDEX_PATTERN = /\s*\(\d+\)\s*$/;

export function normalizeMatrixJobName(name: string | undefined | null): string {
  if (!name) {
    return '';
  }
  return name.trim().replace(MATRIX_INDEX_PATTERN, '').trim();
}
