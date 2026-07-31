import type {
  ArchitectureDashboardData,
  ArchitectureEvaluation,
  ArchitectureEvaluationSeverity,
  ArchitectureEvaluationSignal,
} from './architecture-evaluation-types';

export class ArchitectureEvaluationService {
  evaluate(data: ArchitectureDashboardData): ArchitectureEvaluation {
    const rawSignals: Array<ArchitectureEvaluationSignal | null> = [
      this.evaluateContainerCount(data),
      this.evaluateDependencyConcentration(data),
      this.evaluateHubDependency(data),
      this.evaluateOrphanNodes(data),
      this.evaluateConfidenceHealth(data),
    ];

    return {
      generatedAt: new Date().toISOString(),
      signals: rawSignals.filter((s): s is ArchitectureEvaluationSignal => s !== null),
      summary: this.buildSummary(data),
    };
  }

  private evaluateContainerCount(
    data: ArchitectureDashboardData
  ): ArchitectureEvaluationSignal | null {
    const containers = data.view.nodes.filter(
      (n) => n.kind === 'container' || n.kind === 'component'
    );
    if (containers.length === 0) {
      return this.insufficientData('container_count', 'structure');
    }

    const count = containers.length;
    const severity = this.severityFromThresholds(count, 20, 12);

    return {
      id: 'container_count',
      title:
        count >= 15
          ? `${count} containers detected — architecture may be too granular`
          : 'Container count is healthy',
      description:
        count >= 15
          ? `${count} containers/components were detected. High container counts can indicate over-fragmentation and increased integration complexity.`
          : count >= 10
            ? `${count} containers/components detected — moderate complexity.`
            : `${count} containers/components detected — architecture is well scoped.`,
      severity,
      category: 'structure',
      metrics: [
        { label: 'Containers', value: String(count) },
        { label: 'Snapshot', value: data.snapshotId.slice(0, 8) },
      ],
    };
  }

  private evaluateDependencyConcentration(
    data: ArchitectureDashboardData
  ): ArchitectureEvaluationSignal | null {
    const edges = data.view.edges;
    if (edges.length === 0) {
      return this.insufficientData('dependency_concentration', 'coupling');
    }

    const incoming = new Map<string, number>();
    for (const edge of edges) {
      incoming.set(edge.target, (incoming.get(edge.target) || 0) + 1);
    }

    const nodes = data.view.nodes.filter((n) => n.kind !== 'person' && n.kind !== 'system');

    let topNode: { id: string; name: string; count: number } = {
      id: '',
      name: '',
      count: 0,
    };
    for (const node of nodes) {
      const count = incoming.get(node.id) || 0;
      if (count > topNode.count) {
        topNode = { id: node.id, name: node.name, count };
      }
    }

    if (topNode.count === 0) {
      return this.insufficientData('dependency_concentration', 'coupling');
    }

    const avgIncoming =
      nodes.length > 0 ? [...incoming.values()].reduce((s, v) => s + v, 0) / nodes.length : 0;
    const ratio = avgIncoming > 0 ? topNode.count / avgIncoming : 1;

    const severity = this.severityFromThresholds(ratio, 3, 1.5);

    return {
      id: 'dependency_concentration',
      title:
        ratio >= 2
          ? `"${topNode.name}" has ${topNode.count}x more dependencies than average`
          : 'Dependency load is balanced',
      description:
        ratio >= 2
          ? `"${topNode.name}" receives ${topNode.count} incoming dependencies vs an average of ${avgIncoming.toFixed(1)} across ${nodes.length} components. This component is a dependency bottleneck.`
          : `"${topNode.name}" receives ${topNode.count} incoming dependencies (${ratio.toFixed(1)}x average). Dependency load is evenly spread.`,
      severity,
      category: 'coupling',
      metrics: [
        { label: 'Most depended-on', value: topNode.name },
        { label: 'Incoming edges', value: String(topNode.count) },
        { label: 'Average incoming', value: avgIncoming.toFixed(1) },
      ],
    };
  }

  private evaluateHubDependency(
    data: ArchitectureDashboardData
  ): ArchitectureEvaluationSignal | null {
    const edges = data.view.edges;
    if (edges.length === 0) {
      return this.insufficientData('hub_dependency', 'coupling');
    }

    const outgoing = new Map<string, number>();
    for (const edge of edges) {
      outgoing.set(edge.source, (outgoing.get(edge.source) || 0) + 1);
    }

    const nodes = data.view.nodes.filter((n) => n.kind !== 'person' && n.kind !== 'system');

    let topNode: { id: string; name: string; count: number } = {
      id: '',
      name: '',
      count: 0,
    };
    for (const node of nodes) {
      const count = outgoing.get(node.id) || 0;
      if (count > topNode.count) {
        topNode = { id: node.id, name: node.name, count };
      }
    }

    if (topNode.count === 0) {
      return this.insufficientData('hub_dependency', 'coupling');
    }

    const avgOutgoing =
      nodes.length > 0 ? [...outgoing.values()].reduce((s, v) => s + v, 0) / nodes.length : 0;
    const ratio = avgOutgoing > 0 ? topNode.count / avgOutgoing : 1;

    const severity = this.severityFromThresholds(ratio, 3, 1.5);

    return {
      id: 'hub_dependency',
      title:
        ratio >= 2
          ? `"${topNode.name}" is a hub component with ${topNode.count} outgoing dependencies`
          : 'No hub dependency risk detected',
      description:
        ratio >= 2
          ? `"${topNode.name}" has ${topNode.count} outgoing dependencies (${ratio.toFixed(1)}x average). Hub components increase coupling risk and make the system harder to change.`
          : `"${topNode.name}" has the most outgoing dependencies at ${topNode.count} (${ratio.toFixed(1)}x average). Outgoing dependency load is reasonable.`,
      severity,
      category: 'coupling',
      metrics: [
        { label: 'Hub component', value: topNode.name },
        { label: 'Outgoing edges', value: String(topNode.count) },
        { label: 'Average outgoing', value: avgOutgoing.toFixed(1) },
      ],
    };
  }

  private evaluateOrphanNodes(
    data: ArchitectureDashboardData
  ): ArchitectureEvaluationSignal | null {
    const nodes = data.view.nodes.filter((n) => n.kind !== 'person' && n.kind !== 'system');
    if (nodes.length === 0) {
      return this.insufficientData('orphan_nodes', 'structure');
    }

    const connectedIds = new Set<string>();
    for (const edge of data.view.edges) {
      connectedIds.add(edge.source);
      connectedIds.add(edge.target);
    }

    const orphans = nodes.filter((n) => !connectedIds.has(n.id));
    const orphanCount = orphans.length;
    const share = (orphanCount / nodes.length) * 100;
    const severity = this.severityFromThresholds(orphanCount, 5, 2);

    return {
      id: 'orphan_nodes',
      title:
        orphanCount >= 3 ? `${orphanCount} orphan components detected` : 'No orphan components',
      description:
        orphanCount >= 3
          ? `${orphanCount} out of ${nodes.length} components (${share.toFixed(1)}%) have no dependencies. These may be dead code or missing dependency detection.${
              orphans.length > 0
                ? ` Affected: ${orphans
                    .slice(0, 3)
                    .map((n) => n.name)
                    .join(', ')}${orphans.length > 3 ? ` and ${orphans.length - 3} more` : ''}.`
                : ''
            }`
          : orphanCount > 0
            ? `Only ${orphanCount} component(s) out of ${nodes.length} have no connections — within acceptable range.`
            : `All ${nodes.length} components have at least one connection — no orphan components found.`,
      severity,
      category: 'structure',
      metrics: [
        { label: 'Orphan count', value: String(orphanCount) },
        { label: 'Total components', value: String(nodes.length) },
        { label: 'Orphan share', value: `${share.toFixed(1)}%` },
      ],
    };
  }

  private evaluateConfidenceHealth(
    data: ArchitectureDashboardData
  ): ArchitectureEvaluationSignal | null {
    const edges = data.view.edges;
    if (edges.length === 0) {
      return this.insufficientData('confidence_health', 'quality');
    }

    const avgConfidence = edges.reduce((sum, e) => sum + e.confidence, 0) / edges.length;
    const lowConfidenceEdges = edges.filter((e) => e.confidence < 0.5).length;
    const lowShare = (lowConfidenceEdges / edges.length) * 100;

    const severity: ArchitectureEvaluationSeverity =
      avgConfidence < 0.5 ? 'critical' : avgConfidence < 0.7 ? 'warning' : 'good';

    return {
      id: 'confidence_health',
      title:
        avgConfidence < 0.5
          ? `Low dependency confidence at ${(avgConfidence * 100).toFixed(0)}%`
          : avgConfidence < 0.7
            ? `Dependency confidence is moderate at ${(avgConfidence * 100).toFixed(0)}%`
            : 'Dependency confidence is high',
      description:
        avgConfidence < 0.5
          ? `Average confidence across ${edges.length} dependencies is only ${(avgConfidence * 100).toFixed(0)}%. ${lowConfidenceEdges} edges (${lowShare.toFixed(0)}%) have confidence below 50%. Low confidence means the dependency detection may be unreliable.`
          : avgConfidence < 0.7
            ? `Average confidence is ${(avgConfidence * 100).toFixed(0)}% across ${edges.length} dependencies. ${lowConfidenceEdges} edges (${lowShare.toFixed(0)}%) fall below 50% confidence.`
            : `Average confidence is ${(avgConfidence * 100).toFixed(0)}% across ${edges.length} dependencies — the detected architecture is reliable.`,
      severity,
      category: 'quality',
      metrics: [
        {
          label: 'Avg confidence',
          value: `${(avgConfidence * 100).toFixed(0)}%`,
        },
        {
          label: 'Low confidence edges',
          value: `${lowConfidenceEdges} of ${edges.length}`,
        },
        {
          label: 'Low confidence share',
          value: `${lowShare.toFixed(0)}%`,
        },
      ],
    };
  }

  private buildSummary(data: ArchitectureDashboardData): ArchitectureEvaluation['summary'] {
    const nodes = data.view.nodes.filter((n) => n.kind !== 'person' && n.kind !== 'system');
    const edges = data.view.edges;

    const incoming = new Map<string, number>();
    const outgoing = new Map<string, number>();
    const connectedIds = new Set<string>();

    for (const edge of edges) {
      incoming.set(edge.target, (incoming.get(edge.target) || 0) + 1);
      outgoing.set(edge.source, (outgoing.get(edge.source) || 0) + 1);
      connectedIds.add(edge.source);
      connectedIds.add(edge.target);
    }

    let mostConnectedName: string | undefined;
    let mostConnectedCount = 0;
    for (const node of nodes) {
      const count = incoming.get(node.id) || 0;
      if (count > mostConnectedCount) {
        mostConnectedName = node.name;
        mostConnectedCount = count;
      }
    }

    let hubName: string | undefined;
    let hubCount = 0;
    for (const node of nodes) {
      const count = outgoing.get(node.id) || 0;
      if (count > hubCount) {
        hubName = node.name;
        hubCount = count;
      }
    }

    const orphans = nodes.filter((n) => !connectedIds.has(n.id)).length;
    const avgConfidence =
      edges.length > 0 ? edges.reduce((sum, e) => sum + e.confidence, 0) / edges.length : 0;

    return {
      totalContainers: nodes.length,
      totalEdges: edges.length,
      avgConfidence: Math.round(avgConfidence * 100) / 100,
      orphanNodes: orphans,
      mostConnectedNode: mostConnectedName,
      hubNode: hubName,
    };
  }

  private severityFromThresholds(
    value: number,
    criticalThreshold: number,
    warningThreshold: number
  ): ArchitectureEvaluationSeverity {
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
    category: ArchitectureEvaluationSignal['category']
  ): ArchitectureEvaluationSignal {
    return {
      id,
      title: 'Not enough data',
      description: 'Generate an architecture snapshot to populate this analysis.',
      severity: 'good',
      category,
      metrics: [],
    };
  }
}
