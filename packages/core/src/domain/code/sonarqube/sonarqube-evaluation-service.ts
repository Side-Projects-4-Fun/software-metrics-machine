import type {
  SonarqubeDashboardData,
  SonarqubeEvaluation,
  SonarqubeEvaluationSeverity,
  SonarqubeEvaluationSignal,
} from './sonarqube-evaluation-types';

export class SonarqubeEvaluationService {
  evaluate(data: SonarqubeDashboardData): SonarqubeEvaluation {
    const rawSignals: Array<SonarqubeEvaluationSignal | null> = [
      this.evaluateReliabilityRating(data),
      this.evaluateSecurityRating(data),
      this.evaluateMaintainabilityRating(data),
      this.evaluateDuplicationDensity(data),
      this.evaluateCoverageHealth(data),
      this.evaluateComplexityOutlier(data),
      this.evaluateCoverageOutlier(data),
    ];

    return {
      generatedAt: new Date().toISOString(),
      signals: rawSignals.filter((s): s is SonarqubeEvaluationSignal => s !== null),
      summary: this.buildSummary(data),
    };
  }

  private evaluateReliabilityRating(
    data: SonarqubeDashboardData
  ): SonarqubeEvaluationSignal | null {
    if (!data.quality) {
      return this.insufficientData('reliability_rating', 'quality');
    }

    const rating = data.quality.reliabilityRating;
    const severity = this.ratingToSeverity(rating, 3, 4);
    const labels: Record<number, string> = {
      1: 'A (Excellent)',
      2: 'B (Good)',
      3: 'C (Moderate)',
      4: 'D (Poor)',
      5: 'E (Critical)',
    };

    return {
      id: 'reliability_rating',
      title:
        rating >= 4
          ? `Reliability rating is ${labels[rating] || rating}`
          : rating >= 3
            ? `Reliability rating is ${labels[rating] || rating}`
            : 'Reliability rating is healthy',
      description:
        rating >= 4
          ? `The reliability rating is ${labels[rating] || rating}. This indicates serious bugs or reliability issues that need immediate attention.`
          : rating >= 3
            ? `The reliability rating is ${labels[rating] || rating}. There are moderate reliability concerns that should be addressed.`
            : `The reliability rating is ${labels[rating] || rating} — code is reliable with few bugs.`,
      severity,
      category: 'quality',
      metrics: [
        { label: 'Rating', value: labels[rating] || String(rating) },
        { label: 'Numeric', value: `${rating}/5` },
      ],
    };
  }

  private evaluateSecurityRating(data: SonarqubeDashboardData): SonarqubeEvaluationSignal | null {
    if (!data.quality) {
      return this.insufficientData('security_rating', 'quality');
    }

    const rating = data.quality.securityRating;
    const severity = this.ratingToSeverity(rating, 2, 3);
    const labels: Record<number, string> = {
      1: 'A (Excellent)',
      2: 'B (Good)',
      3: 'C (Moderate)',
      4: 'D (Poor)',
      5: 'E (Critical)',
    };

    return {
      id: 'security_rating',
      title:
        rating >= 3
          ? `Security rating is ${labels[rating] || rating} — vulnerabilities detected`
          : 'Security rating is healthy',
      description:
        rating >= 3
          ? `The security rating is ${labels[rating] || rating}. Vulnerabilities have been detected that require attention. Review and fix security issues.`
          : `The security rating is ${labels[rating] || rating} — no significant security vulnerabilities detected.`,
      severity,
      category: 'quality',
      metrics: [
        { label: 'Rating', value: labels[rating] || String(rating) },
        { label: 'Numeric', value: `${rating}/5` },
      ],
    };
  }

  private evaluateMaintainabilityRating(
    data: SonarqubeDashboardData
  ): SonarqubeEvaluationSignal | null {
    if (!data.quality) {
      return this.insufficientData('maintainability_rating', 'quality');
    }

    const rating = data.quality.maintainabilityRating;
    const severity = this.ratingToSeverity(rating, 3, 4);
    const labels: Record<number, string> = {
      1: 'A (Excellent)',
      2: 'B (Good)',
      3: 'C (Moderate)',
      4: 'D (Poor)',
      5: 'E (Critical)',
    };

    return {
      id: 'maintainability_rating',
      title:
        rating >= 4
          ? `Maintainability rating is ${labels[rating] || rating}`
          : rating >= 3
            ? `Maintainability rating is ${labels[rating] || rating}`
            : 'Maintainability rating is healthy',
      description:
        rating >= 4
          ? `The maintainability rating is ${labels[rating] || rating}. Technical debt is high — consider refactoring.`
          : rating >= 3
            ? `The maintainability rating is ${labels[rating] || rating}. Moderate technical debt detected.`
            : `The maintainability rating is ${labels[rating] || rating} — code is maintainable with low technical debt.`,
      severity,
      category: 'quality',
      metrics: [
        { label: 'Rating', value: labels[rating] || String(rating) },
        { label: 'Numeric', value: `${rating}/5` },
      ],
    };
  }

  private evaluateDuplicationDensity(
    data: SonarqubeDashboardData
  ): SonarqubeEvaluationSignal | null {
    if (!data.quality) {
      return this.insufficientData('duplication_density', 'quality');
    }

    const density = data.quality.duplicationDensity;
    const severity = this.severityFromThresholds(density, 15, 5);

    return {
      id: 'duplication_density',
      title:
        density >= 10
          ? `Duplication density is high at ${density.toFixed(1)}%`
          : density >= 3
            ? `Duplication density is moderate at ${density.toFixed(1)}%`
            : 'Duplication density is low',
      description:
        density >= 10
          ? `${density.toFixed(1)}% of code is duplicated. High duplication increases maintenance burden and bug risk.`
          : density >= 3
            ? `${density.toFixed(1)}% of code is duplicated. Some duplication exists that could be consolidated.`
            : `Only ${density.toFixed(1)}% of code is duplicated — duplication is well controlled.`,
      severity,
      category: 'quality',
      metrics: [
        {
          label: 'Duplication',
          value: `${density.toFixed(1)}%`,
        },
      ],
    };
  }

  private evaluateCoverageHealth(data: SonarqubeDashboardData): SonarqubeEvaluationSignal | null {
    const tree = data.componentTree;
    if (tree.length === 0) {
      return this.insufficientData('coverage_health', 'coverage');
    }

    const totalCoverage = tree.reduce((sum, c) => sum + c.coverage, 0) / tree.length;
    const lowCoverageFiles = tree.filter((c) => c.coverage < 50).length;
    const lowShare = (lowCoverageFiles / tree.length) * 100;

    const severity: SonarqubeEvaluationSeverity =
      totalCoverage < 30 ? 'critical' : totalCoverage < 60 ? 'warning' : 'good';

    return {
      id: 'coverage_health',
      title:
        totalCoverage < 30
          ? `Average coverage is critically low at ${totalCoverage.toFixed(0)}%`
          : totalCoverage < 60
            ? `Average coverage is moderate at ${totalCoverage.toFixed(0)}%`
            : 'Code coverage is healthy',
      description:
        totalCoverage < 30
          ? `Average coverage is only ${totalCoverage.toFixed(0)}% across ${tree.length} files. ${lowCoverageFiles} files (${lowShare.toFixed(0)}%) have below 50% coverage.`
          : totalCoverage < 60
            ? `Average coverage is ${totalCoverage.toFixed(0)}% across ${tree.length} files. ${lowCoverageFiles} files (${lowShare.toFixed(0)}%) have below 50% coverage.`
            : `Average coverage is ${totalCoverage.toFixed(0)}% across ${tree.length} files. Only ${lowCoverageFiles} files (${lowShare.toFixed(0)}%) are below 50%.`,
      severity,
      category: 'coverage',
      metrics: [
        {
          label: 'Avg coverage',
          value: `${totalCoverage.toFixed(0)}%`,
        },
        {
          label: 'Files below 50%',
          value: String(lowCoverageFiles),
        },
        {
          label: 'Low coverage share',
          value: `${lowShare.toFixed(0)}%`,
        },
      ],
    };
  }

  private evaluateComplexityOutlier(
    data: SonarqubeDashboardData
  ): SonarqubeEvaluationSignal | null {
    const tree = data.componentTree;
    if (tree.length === 0) {
      return this.insufficientData('complexity_outlier', 'complexity');
    }

    const avgComplexity = tree.reduce((sum, c) => sum + c.complexity, 0) / tree.length;
    const sorted = [...tree].sort((a, b) => b.complexity - a.complexity);
    const top = sorted[0];
    const ratio = avgComplexity > 0 ? top.complexity / avgComplexity : 1;

    const severity = this.severityFromThresholds(ratio, 5, 3);
    const highComplexityFiles = tree.filter((c) => c.complexity > 20).length;

    return {
      id: 'complexity_outlier',
      title:
        ratio >= 4
          ? `"${top.name}" is a complexity outlier (${top.complexity} vs avg ${avgComplexity.toFixed(0)})`
          : 'Complexity is evenly distributed',
      description:
        ratio >= 4
          ? `"${top.name}" has complexity ${top.complexity} — ${ratio.toFixed(1)}x the average (${avgComplexity.toFixed(0)}). ${highComplexityFiles} files exceed complexity of 20.`
          : ratio >= 2
            ? `"${top.name}" has the highest complexity at ${top.complexity} (${ratio.toFixed(1)}x average). ${highComplexityFiles} files exceed 20.`
            : `The most complex file is "${top.name}" at ${top.complexity} (${ratio.toFixed(1)}x average). Complexity is well managed.`,
      severity,
      category: 'complexity',
      metrics: [
        { label: 'Top file', value: top.name },
        { label: 'Complexity', value: String(top.complexity) },
        { label: 'vs. average', value: `${ratio.toFixed(1)}x` },
        {
          label: 'Files > 20 complexity',
          value: String(highComplexityFiles),
        },
      ],
    };
  }

  private evaluateCoverageOutlier(data: SonarqubeDashboardData): SonarqubeEvaluationSignal | null {
    const tree = data.componentTree;
    if (tree.length === 0) {
      return this.insufficientData('coverage_outlier', 'coverage');
    }

    const sorted = [...tree].sort((a, b) => a.coverage - b.coverage);
    const worst = sorted[0];

    const actualSeverity: SonarqubeEvaluationSeverity =
      worst.coverage < 10 ? 'critical' : worst.coverage < 30 ? 'warning' : 'good';

    return {
      id: 'coverage_outlier',
      title:
        worst.coverage < 20
          ? `"${worst.name}" has critically low coverage at ${worst.coverage}%`
          : worst.coverage < 50
            ? `"${worst.name}" has low coverage at ${worst.coverage}%`
            : 'No significant coverage gaps',
      description:
        worst.coverage < 20
          ? `"${worst.name}" has only ${worst.coverage}% test coverage. This file is a testing gap and a change risk.`
          : worst.coverage < 50
            ? `"${worst.name}" has ${worst.coverage}% test coverage — below the recommended threshold.`
            : `The least covered file is "${worst.name}" at ${worst.coverage}% — no significant gaps.`,
      severity: actualSeverity,
      category: 'coverage',
      metrics: [
        { label: 'Worst file', value: worst.name },
        { label: 'Coverage', value: `${worst.coverage}%` },
        { label: 'Complexity', value: String(worst.complexity) },
        {
          label: 'NLOC',
          value: String(worst.ncloc),
        },
      ],
    };
  }

  private buildSummary(data: SonarqubeDashboardData): SonarqubeEvaluation['summary'] {
    const tree = data.componentTree || [];
    const totalComponents = tree.length;
    const avgComplexity =
      totalComponents > 0 ? tree.reduce((sum, c) => sum + c.complexity, 0) / totalComponents : 0;
    const avgCoverage =
      totalComponents > 0 ? tree.reduce((sum, c) => sum + c.coverage, 0) / totalComponents : 0;
    const totalNLOC = tree.reduce((sum, c) => sum + c.ncloc, 0);

    return {
      totalComponents,
      avgComplexity: Math.round(avgComplexity * 10) / 10,
      avgCoverage: Math.round(avgCoverage * 10) / 10,
      totalNLOC,
      duplicationDensity: data.quality?.duplicationDensity || 0,
      maintainabilityRating: data.quality?.maintainabilityRating || 0,
      reliabilityRating: data.quality?.reliabilityRating || 0,
      securityRating: data.quality?.securityRating || 0,
    };
  }

  private ratingToSeverity(
    rating: number,
    warningThreshold: number,
    criticalThreshold: number
  ): SonarqubeEvaluationSeverity {
    // SonarQube ratings are 1-5 where 1=best, 5=worst
    if (rating >= criticalThreshold) {
      return 'critical';
    }
    if (rating >= warningThreshold) {
      return 'warning';
    }
    return 'good';
  }

  private severityFromThresholds(
    value: number,
    criticalThreshold: number,
    warningThreshold: number
  ): SonarqubeEvaluationSeverity {
    if (value >= criticalThreshold) {
      return 'critical';
    }
    if (value >= warningThreshold) {
      return 'warning';
    }
    return 'good';
  }

  private insufficientData(
    id: string,
    category: SonarqubeEvaluationSignal['category']
  ): SonarqubeEvaluationSignal {
    return {
      id,
      title: 'Not enough data',
      description: 'Fetch SonarQube quality data to populate this analysis.',
      severity: 'good',
      category,
      metrics: [],
    };
  }
}
