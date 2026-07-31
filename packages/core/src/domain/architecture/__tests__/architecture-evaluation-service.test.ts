import { describe, it, expect } from 'vitest';
import { ArchitectureEvaluationService } from '../architecture-evaluation-service';
import type { ArchitectureDashboardData } from '../architecture-evaluation-types';

function makeEmptyData(): ArchitectureDashboardData {
  return {
    snapshotId: 'snap-1',
    generatedAt: '2025-01-01T00:00:00.000Z',
    commitCount: 0,
    view: { level: 'container', title: 'Empty', nodes: [], edges: [] },
  };
}

function makeRichData(): ArchitectureDashboardData {
  return {
    snapshotId: 'snap-1',
    generatedAt: '2025-01-01T00:00:00.000Z',
    commitCount: 42,
    view: {
      level: 'container',
      title: 'Container View',
      nodes: [
        {
          id: 'c:api',
          kind: 'container',
          name: 'API',
          technology: 'NestJS',
        },
        {
          id: 'c:web',
          kind: 'container',
          name: 'Web App',
          technology: 'Next.js',
        },
        { id: 'c:db', kind: 'container', name: 'Database' },
        {
          id: 'c:worker',
          kind: 'container',
          name: 'Worker',
          technology: 'BullMQ',
        },
        {
          id: 'p:dev',
          kind: 'person',
          name: 'Developer',
        },
        { id: 's:github', kind: 'system', name: 'GitHub' },
      ],
      edges: [
        {
          id: 'e1',
          source: 'c:web',
          target: 'c:api',
          confidence: 0.9,
        },
        {
          id: 'e2',
          source: 'c:api',
          target: 'c:db',
          confidence: 0.8,
        },
        {
          id: 'e3',
          source: 'c:api',
          target: 'c:worker',
          confidence: 0.7,
        },
        {
          id: 'e4',
          source: 'c:web',
          target: 'c:db',
          confidence: 0.3,
        },
        {
          id: 'e5',
          source: 'p:dev',
          target: 'c:web',
          confidence: 1.0,
        },
        {
          id: 'e6',
          source: 'c:api',
          target: 's:github',
          confidence: 0.6,
        },
      ],
    },
  };
}

describe('ArchitectureEvaluationService', () => {
  const service = new ArchitectureEvaluationService();

  describe('evaluate', () => {
    it('returns evaluation with signals and summary', () => {
      const result = service.evaluate(makeRichData());
      expect(result.generatedAt).toBeDefined();
      expect(Array.isArray(result.signals)).toBe(true);
      expect(result.signals.length).toBeGreaterThan(0);
      expect(result.summary.totalContainers).toBe(4);
    });

    it('returns insufficient data signals for empty input', () => {
      const result = service.evaluate(makeEmptyData());
      expect(result.signals.length).toBeGreaterThan(0);
      for (const signal of result.signals) {
        expect(signal.severity).toBe('good');
        expect(signal.metrics).toEqual([]);
      }
    });

    it('detects dependency concentration when one node dominates', () => {
      const data = makeRichData();
      const result = service.evaluate(data);
      const conc = result.signals.find((s) => s.id === 'dependency_concentration');
      expect(conc).toBeDefined();
      // c:api receives from c:web (twice from e1,e4), so it's the top target
    });

    it('detects hub dependency when one node has many outgoing edges', () => {
      const data = makeRichData();
      const result = service.evaluate(data);
      const hub = result.signals.find((s) => s.id === 'hub_dependency');
      expect(hub).toBeDefined();
      // c:api has the most outgoing (to db, worker, github)
    });

    it('detects orphan nodes with no connections', () => {
      const data = makeRichData();
      const result = service.evaluate(data);
      const orphan = result.signals.find((s) => s.id === 'orphan_nodes');
      expect(orphan).toBeDefined();
    });

    it('evaluates confidence health from edge confidence values', () => {
      const data = makeRichData();
      const result = service.evaluate(data);
      const conf = result.signals.find((s) => s.id === 'confidence_health');
      expect(conf).toBeDefined();
      expect(['critical', 'warning', 'good']).toContain(conf!.severity);
    });

    it('evaluates container count', () => {
      const data = makeRichData();
      const result = service.evaluate(data);
      const count = result.signals.find((s) => s.id === 'container_count');
      expect(count).toBeDefined();
      expect(count!.severity).toBe('good');
    });

    it('builds summary correctly', () => {
      const data = makeRichData();
      const result = service.evaluate(data);
      expect(result.summary.totalContainers).toBe(4);
      expect(result.summary.totalEdges).toBe(6);
      expect(result.summary.avgConfidence).toBeGreaterThan(0);
    });

    it('all signals have expected structure', () => {
      const result = service.evaluate(makeRichData());
      for (const signal of result.signals) {
        expect(signal).toHaveProperty('id');
        expect(signal).toHaveProperty('title');
        expect(signal).toHaveProperty('description');
        expect(['critical', 'warning', 'good']).toContain(signal.severity);
      }
    });
  });
});
