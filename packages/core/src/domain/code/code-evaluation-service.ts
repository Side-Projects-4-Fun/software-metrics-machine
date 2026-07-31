import type {
  CodeDashboardData,
  CodeEvaluation,
  CodeEvaluationSignal,
  CodeEvaluationSeverity,
} from './code-evaluation-types';

function calculateCrapScore(complexity: number, coverage: number): number {
  const normalizedCoverage = Math.min(Math.max(coverage, 0), 100) / 100;
  const rawScore = complexity ** 2 * (1 - normalizedCoverage) ** 3 + complexity;
  return Math.round(rawScore * 10) / 10;
}

export class CodeEvaluationService {
  evaluate(data: CodeDashboardData): CodeEvaluation {
    const rawSignals: Array<CodeEvaluationSignal | null> = [
      this.evaluateChurnHotspot(data),
      this.evaluateChurnTrend(data),
      this.evaluateCouplingTop(data),
      this.evaluateCouplingBurst(data),
      this.evaluateOwnershipConcentration(data),
      this.evaluateOwnershipUnknown(data),
      this.evaluateComplexityHotspot(data),
      this.evaluateComplexityBigO(data),
      this.evaluatePairingIndex(data),
      this.evaluatePairingConcentration(data),
    ];

    return {
      generatedAt: new Date().toISOString(),
      signals: rawSignals.filter((s): s is CodeEvaluationSignal => s !== null),
      summary: this.buildSummary(data),
    };
  }

  private evaluateChurnHotspot(data: CodeDashboardData): CodeEvaluationSignal | null {
    const entityChurn = data.entityChurn || [];
    if (entityChurn.length === 0) {
      return this.insufficientData('churn_hotspot', 'churn');
    }

    const totalChurn = entityChurn.reduce((sum, e) => sum + e.added + e.deleted, 0);
    const sorted = [...entityChurn].sort((a, b) => b.added + b.deleted - (a.added + a.deleted));
    const top = sorted[0];
    const topChurn = top.added + top.deleted;
    const share = totalChurn > 0 ? (topChurn / totalChurn) * 100 : 0;

    const severity = this.severityFromThresholds(share, 40, 20);

    return {
      id: 'churn_hotspot',
      title: share >= 30 ? `"${top.entity}" dominates code churn` : 'Churn is evenly distributed',
      description:
        share >= 30
          ? `"${top.entity}" accounts for ${share.toFixed(1)}% of total churn across ${entityChurn.length} files — it is the primary churn hotspot.`
          : `The most changed file ("${top.entity}") accounts for ${share.toFixed(1)}% of total churn — change activity is reasonably balanced across ${entityChurn.length} files.`,
      severity,
      category: 'churn',
      metrics: [
        { label: 'Top file', value: top.entity },
        { label: 'Lines added', value: String(top.added) },
        { label: 'Lines deleted', value: String(top.deleted) },
        { label: 'Share of total churn', value: `${share.toFixed(1)}%` },
      ],
    };
  }

  private evaluateChurnTrend(data: CodeDashboardData): CodeEvaluationSignal | null {
    const codeChurn = data.codeChurn || [];
    if (codeChurn.length === 0) {
      return this.insufficientData('churn_trend', 'churn');
    }

    const totalAdded = codeChurn.reduce((sum, c) => sum + c.added, 0);
    const totalDeleted = codeChurn.reduce((sum, c) => sum + c.deleted, 0);
    const ratio = totalDeleted > 0 ? totalAdded / totalDeleted : totalAdded > 0 ? Infinity : 0;
    const invRatio = totalAdded > 0 ? totalDeleted / totalAdded : totalDeleted > 0 ? Infinity : 0;

    const maxRatio = Math.max(ratio, invRatio);
    const dominant = ratio >= invRatio ? 'additions' : 'deletions';
    const severity = this.severityFromThresholds(maxRatio, 3, 1.5);

    return {
      id: 'churn_trend',
      title:
        maxRatio >= 2 ? `Churn is heavily skewed toward ${dominant}` : 'Churn ratio is balanced',
      description:
        ratio !== 0 && ratio !== Infinity
          ? `${totalAdded} lines added vs ${totalDeleted} lines deleted (ratio ${ratio.toFixed(1)}:1 ${dominant === 'additions' ? 'additions' : 'deletions'} dominant). ${ratio >= 2 ? 'This imbalance may indicate unchecked growth or aggressive refactoring.' : 'Addition and removal are well balanced.'}`
          : dominant === 'additions'
            ? `${totalAdded} lines added with no deletions — possible code growth without cleanup.`
            : `${totalDeleted} lines deleted with no additions — possible aggressive refactoring.`,
      severity,
      category: 'churn',
      metrics: [
        { label: 'Lines added', value: String(totalAdded) },
        { label: 'Lines deleted', value: String(totalDeleted) },
        {
          label: 'Add/Delete ratio',
          value: ratio === Infinity ? '∞' : ratio.toFixed(1),
        },
        { label: 'Dominant', value: dominant },
      ],
    };
  }

  private evaluateCouplingTop(data: CodeDashboardData): CodeEvaluationSignal | null {
    const coupling = data.coupling || [];
    if (coupling.length === 0) {
      return this.insufficientData('coupling_top', 'coupling');
    }

    const sorted = [...coupling].sort((a, b) => b.degree - a.degree);
    const top = sorted[0];
    const severity = this.severityFromThresholds(top.degree, 70, 40);

    return {
      id: 'coupling_top',
      title:
        top.degree >= 60
          ? `"${top.entity}" is tightly coupled to "${top.coupled}"`
          : 'Coupling is manageable',
      description:
        top.degree >= 60
          ? `"${top.entity}" and "${top.coupled}" share ${top.degree}% of changes together — they are strongly coupled and may need decoupling.`
          : `The strongest coupling is between "${top.entity}" and "${top.coupled}" at ${top.degree}% — within healthy range.`,
      severity,
      category: 'coupling',
      metrics: [
        { label: 'Entity', value: top.entity },
        { label: 'Coupled with', value: top.coupled },
        { label: 'Coupling degree', value: `${top.degree}%` },
        { label: 'Avg revs', value: String(top.averageRevs) },
      ],
    };
  }

  private evaluateCouplingBurst(data: CodeDashboardData): CodeEvaluationSignal | null {
    const coupling = data.coupling || [];
    if (coupling.length === 0) {
      return this.insufficientData('coupling_burst', 'coupling');
    }

    const highCouplingCount = coupling.filter((c) => c.degree > 50).length;
    const severity = this.severityFromThresholds(highCouplingCount, 10, 5);

    return {
      id: 'coupling_burst',
      title:
        highCouplingCount >= 8
          ? `${highCouplingCount} highly-coupled file pairs detected`
          : 'No widespread coupling issues',
      description:
        highCouplingCount >= 8
          ? `${highCouplingCount} file pairs have a coupling degree above 50% out of ${coupling.length} total pairs — this suggests architectural entanglement.`
          : highCouplingCount > 0
            ? `Only ${highCouplingCount} file pairs exceed 50% coupling out of ${coupling.length} total — coupling is well contained.`
            : `None of the ${coupling.length} file pairs exceed 50% coupling — architecture is well modularized.`,
      severity,
      category: 'coupling',
      metrics: [
        {
          label: 'Highly coupled pairs',
          value: String(highCouplingCount),
        },
        { label: 'Total pairs', value: String(coupling.length) },
        {
          label: 'High coupling %',
          value: `${coupling.length > 0 ? ((highCouplingCount / coupling.length) * 100).toFixed(1) : 0}%`,
        },
      ],
    };
  }

  private evaluateOwnershipConcentration(data: CodeDashboardData): CodeEvaluationSignal | null {
    const ownership = data.entityOwnership || [];
    if (ownership.length === 0) {
      return this.insufficientData('ownership_concentration', 'ownership');
    }

    const authorChurn = new Map<string, number>();
    for (const entry of ownership) {
      const current = authorChurn.get(entry.author) || 0;
      authorChurn.set(entry.author, current + entry.added + entry.deleted);
    }

    const totalChurn = [...authorChurn.values()].reduce((sum, v) => sum + v, 0);
    let topAuthor = '';
    let topAuthorChurn = 0;
    for (const [author, churn] of authorChurn) {
      if (churn > topAuthorChurn) {
        topAuthor = author;
        topAuthorChurn = churn;
      }
    }

    const share = totalChurn > 0 ? (topAuthorChurn / totalChurn) * 100 : 0;
    const severity = this.severityFromThresholds(share, 60, 40);
    const uniqueAuthors = authorChurn.size;

    return {
      id: 'ownership_concentration',
      title:
        share >= 50
          ? `"${topAuthor}" owns ${share.toFixed(0)}% of the codebase — bus factor risk`
          : 'Code ownership is well distributed',
      description:
        share >= 50
          ? `"${topAuthor}" is responsible for ${share.toFixed(1)}% of total churn across ${uniqueAuthors} contributors. This creates a bus factor risk.`
          : `"${topAuthor}" has the highest contribution at ${share.toFixed(1)}% across ${uniqueAuthors} contributors — ownership is reasonably spread.`,
      severity,
      category: 'ownership',
      metrics: [
        { label: 'Top author', value: topAuthor },
        { label: 'Share of churn', value: `${share.toFixed(1)}%` },
        { label: 'Unique authors', value: String(uniqueAuthors) },
      ],
    };
  }

  private evaluateOwnershipUnknown(data: CodeDashboardData): CodeEvaluationSignal | null {
    const ownership = data.entityOwnership || [];
    if (ownership.length === 0) {
      return this.insufficientData('ownership_unknown', 'ownership');
    }

    const entityAuthors = new Map<string, Set<string>>();
    for (const entry of ownership) {
      const authors = entityAuthors.get(entry.entity) || new Set();
      authors.add(entry.author);
      entityAuthors.set(entry.entity, authors);
    }

    let unknownCount = 0;
    for (const [, authors] of entityAuthors) {
      if (authors.size >= 3) {
        unknownCount++;
      }
    }

    const totalFiles = entityAuthors.size;
    const share = totalFiles > 0 ? (unknownCount / totalFiles) * 100 : 0;
    const severity = this.severityFromThresholds(
      unknownCount,
      Math.max(1, Math.ceil(totalFiles * 0.3)),
      Math.max(1, Math.ceil(totalFiles * 0.15))
    );

    return {
      id: 'ownership_unknown',
      title:
        unknownCount > Math.ceil(totalFiles * 0.2)
          ? `${unknownCount} files lack clear ownership`
          : 'Most files have clear ownership',
      description:
        share >= 20
          ? `${unknownCount} out of ${totalFiles} files (${share.toFixed(1)}%) have 3+ contributors — these files lack a clear owner.`
          : `Only ${unknownCount} out of ${totalFiles} files (${share.toFixed(1)}%) have 3+ contributors — most files have clear ownership.`,
      severity,
      category: 'ownership',
      metrics: [
        { label: 'Files without clear owner', value: String(unknownCount) },
        { label: 'Total files', value: String(totalFiles) },
        { label: 'Share', value: `${share.toFixed(1)}%` },
      ],
    };
  }

  private evaluateComplexityHotspot(data: CodeDashboardData): CodeEvaluationSignal | null {
    const crapMetrics = data.crapMetrics || [];
    if (crapMetrics.length === 0) {
      return this.insufficientData('complexity_hotspot', 'complexity');
    }

    const sorted = [...crapMetrics].sort((a, b) => b.crap - a.crap);
    const top = sorted[0];
    const severity = this.severityFromThresholds(top.crap, 30, 15);

    return {
      id: 'complexity_hotspot',
      title:
        top.crap >= 20
          ? `"${top.name}" has a high CRAP score of ${top.crap}`
          : 'CRAP scores are healthy',
      description:
        top.crap >= 20
          ? `"${top.name}" has a CRAP score of ${top.crap} (complexity ${top.complexity}, coverage ${top.coverage}%). High CRAP scores indicate risky code that is both complex and poorly tested.`
          : `The highest CRAP score is ${top.crap} ("${top.name}") — complexity and test coverage are in good balance across ${crapMetrics.length} files.`,
      severity,
      category: 'complexity',
      metrics: [
        { label: 'Worst file', value: top.name },
        { label: 'CRAP score', value: String(top.crap) },
        { label: 'Complexity', value: String(top.complexity) },
        { label: 'Coverage', value: `${top.coverage}%` },
      ],
    };
  }

  private evaluateComplexityBigO(data: CodeDashboardData): CodeEvaluationSignal | null {
    const bigOFiles = data.bigOFiles || [];
    if (bigOFiles.length === 0) {
      return this.insufficientData('complexity_big_o', 'complexity');
    }

    const needsHelpCount = bigOFiles.filter((f) => f.needsHelp).length;
    const severity = this.severityFromThresholds(
      needsHelpCount,
      Math.max(1, Math.ceil(bigOFiles.length * 0.15)),
      Math.max(1, Math.ceil(bigOFiles.length * 0.05))
    );

    return {
      id: 'complexity_big_o',
      title:
        needsHelpCount >= 0.1 * bigOFiles.length
          ? `${needsHelpCount} files flagged for Big O performance risk`
          : 'Big O analysis is clean',
      description:
        needsHelpCount > 0
          ? `${needsHelpCount} out of ${bigOFiles.length} files (${((needsHelpCount / bigOFiles.length) * 100).toFixed(1)}%) have been flagged as needing performance attention. The worst file is "${bigOFiles.sort((a, b) => b.score - a.score)[0]?.filePath || 'unknown'}" with score ${bigOFiles.sort((a, b) => b.score - a.score)[0]?.score || 0}.`
          : `All ${bigOFiles.length} analyzed files pass Big O performance checks — no algorithmic complexity risks detected.`,
      severity,
      category: 'complexity',
      metrics: [
        { label: 'Files at risk', value: String(needsHelpCount) },
        { label: 'Total analyzed', value: String(bigOFiles.length) },
        {
          label: 'Risk percentage',
          value: `${((needsHelpCount / bigOFiles.length) * 100).toFixed(1)}%`,
        },
      ],
    };
  }

  private evaluatePairingIndex(data: CodeDashboardData): CodeEvaluationSignal | null {
    const pairing = data.pairing;
    if (!pairing || pairing.totalAnalyzedCommits === 0) {
      return this.insufficientData('pairing_index', 'collaboration');
    }

    const percentage = pairing.pairingIndexPercentage || 0;
    const severity: CodeEvaluationSeverity =
      percentage >= 20 ? 'good' : percentage >= 10 ? 'warning' : 'critical';

    return {
      id: 'pairing_index',
      title:
        percentage < 10
          ? `Pairing index is critically low at ${percentage}%`
          : percentage < 20
            ? `Pairing index is moderate at ${percentage}%`
            : `Pairing index is healthy at ${percentage}%`,
      description:
        percentage < 10
          ? `${pairing.pairedCommits} paired commits out of ${pairing.totalAnalyzedCommits} total (${percentage}%). Low pairing increases knowledge silo risk.`
          : percentage < 20
            ? `${pairing.pairedCommits} paired commits out of ${pairing.totalAnalyzedCommits} total (${percentage}%). Consider encouraging more pair programming.`
            : `${pairing.pairedCommits} out of ${pairing.totalAnalyzedCommits} commits were paired (${percentage}%) — knowledge is being shared effectively.`,
      severity,
      category: 'collaboration',
      metrics: [
        { label: 'Pairing index', value: `${percentage}%` },
        {
          label: 'Paired commits',
          value: String(pairing.pairedCommits),
        },
        {
          label: 'Total commits',
          value: String(pairing.totalAnalyzedCommits),
        },
      ],
    };
  }

  private evaluatePairingConcentration(data: CodeDashboardData): CodeEvaluationSignal | null {
    const pairing = data.pairing;
    if (
      !pairing ||
      !pairing.topPairs ||
      pairing.topPairs.length === 0 ||
      pairing.pairedCommits === 0
    ) {
      return this.insufficientData('pairing_concentration', 'collaboration');
    }

    const top = pairing.topPairs[0];
    const share = (top.pairedCommits / pairing.pairedCommits) * 100;
    const severity = this.severityFromThresholds(share, 50, 30);

    return {
      id: 'pairing_concentration',
      title:
        share >= 40
          ? `Pairing is dominated by "${top.author}" and "${top.coAuthor}"`
          : 'Pairing is well distributed',
      description:
        share >= 40
          ? `"${top.author}" and "${top.coAuthor}" account for ${share.toFixed(1)}% of all paired commits (${top.pairedCommits} commits). Pairing is concentrated on a single duo.`
          : `The top pair ("${top.author}" + "${top.coAuthor}") accounts for ${share.toFixed(1)}% of paired commits — pairing is spread across multiple combinations.`,
      severity,
      category: 'collaboration',
      metrics: [
        { label: 'Top pair', value: `${top.author} + ${top.coAuthor}` },
        { label: 'Paired commits', value: String(top.pairedCommits) },
        { label: 'Share of all pairs', value: `${share.toFixed(1)}%` },
      ],
    };
  }

  private buildSummary(data: CodeDashboardData): CodeEvaluation['summary'] {
    const entityChurn = data.entityChurn || [];
    const totalChurn = entityChurn.reduce((sum, e) => sum + e.added + e.deleted, 0);
    const linesAdded = entityChurn.reduce((sum, e) => sum + e.added, 0);
    const linesDeleted = entityChurn.reduce((sum, e) => sum + e.deleted, 0);

    const hotspots = entityChurn.filter((e) => e.added + e.deleted > 100).length;

    const coupling = data.coupling || [];
    const sortedCoupling = [...coupling].sort((a, b) => b.degree - a.degree);

    const crapMetrics = data.crapMetrics || [];
    const highComplexityFiles = crapMetrics.filter(
      (c) => calculateCrapScore(c.complexity, c.coverage) > 15
    ).length;

    const ownership = data.entityOwnership || [];
    const authorChurn = new Map<string, number>();
    for (const entry of ownership) {
      const current = authorChurn.get(entry.author) || 0;
      authorChurn.set(entry.author, current + entry.added + entry.deleted);
    }
    let topAuthor = '';
    let topAuthorChurn = 0;
    for (const [author, churn] of authorChurn) {
      if (churn > topAuthorChurn) {
        topAuthor = author;
        topAuthorChurn = churn;
      }
    }

    return {
      totalChurn,
      linesAdded,
      linesDeleted,
      hotspots,
      avgPairingIndex: data.pairing?.pairingIndexPercentage || 0,
      totalCouplingPairs: coupling.length,
      highComplexityFiles,
      topChurnFile: entityChurn.sort((a, b) => b.added + b.deleted - (a.added + a.deleted))[0]
        ?.entity,
      mostCoupledPair:
        sortedCoupling.length > 0
          ? `${sortedCoupling[0]?.entity || ''} ↔ ${sortedCoupling[0]?.coupled || ''}`
          : undefined,
      dominantAuthor: topAuthor || undefined,
    };
  }

  private severityFromThresholds(
    value: number,
    criticalThreshold: number,
    warningThreshold: number
  ): CodeEvaluationSeverity {
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
    category: CodeEvaluationSignal['category']
  ): CodeEvaluationSignal {
    return {
      id,
      title: 'Not enough data',
      description: 'Commit and analyze more code to populate this analysis.',
      severity: 'good',
      category,
      metrics: [],
    };
  }
}
