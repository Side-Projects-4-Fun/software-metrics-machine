export function calculateCrapScore(complexity: number, coverage: number): number {
  const normalizedCoverage = Math.min(Math.max(coverage, 0), 100) / 100;
  const rawScore = complexity ** 2 * (1 - normalizedCoverage) ** 3 + complexity;

  return Math.round(rawScore * 10) / 10;
}

export function toCrapRisk(score: number): { label: string; color: 'success' | 'warning' | 'error' } {
  if (score > 60) {
    return { label: 'High', color: 'error' };
  }

  if (score > 30) {
    return { label: 'Watch', color: 'warning' };
  }

  return { label: 'OK', color: 'success' };
}
