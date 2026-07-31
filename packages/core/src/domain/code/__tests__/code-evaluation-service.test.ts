import { describe, it, expect } from 'vitest';
import { CodeEvaluationService } from '../code-evaluation-service';
import type { CodeDashboardData } from '../code-evaluation-types';

function makeEmptyData(): CodeDashboardData {
  return {
    entityChurn: [],
    coupling: [],
    entityEffort: [],
    codeChurn: [],
    entityOwnership: [],
    pairing: {
      pairingIndexPercentage: 0,
      totalAnalyzedCommits: 0,
      pairedCommits: 0,
      topPairs: [],
    },
    bigOFiles: [],
    crapMetrics: [],
  };
}

function makeRichData(): CodeDashboardData {
  return {
    entityChurn: [
      { entity: 'src/main.ts', added: 200, deleted: 50, commits: 15 },
      { entity: 'src/utils.ts', added: 30, deleted: 20, commits: 5 },
      { entity: 'src/legacy.ts', added: 10, deleted: 5, commits: 3 },
    ],
    coupling: [
      {
        entity: 'src/auth.ts',
        coupled: 'src/db.ts',
        degree: 85,
        averageRevs: 20,
      },
      {
        entity: 'src/api.ts',
        coupled: 'src/cache.ts',
        degree: 60,
        averageRevs: 15,
      },
      {
        entity: 'src/handler.ts',
        coupled: 'src/router.ts',
        degree: 55,
        averageRevs: 8,
      },
      {
        entity: 'src/middleware.ts',
        coupled: 'src/logger.ts',
        degree: 55,
        averageRevs: 5,
      },
      {
        entity: 'src/config.ts',
        coupled: 'src/env.ts',
        degree: 55,
        averageRevs: 4,
      },
      {
        entity: 'src/format.ts',
        coupled: 'src/types.ts',
        degree: 55,
        averageRevs: 3,
      },
      {
        entity: 'src/helper.ts',
        coupled: 'src/types.ts',
        degree: 30,
        averageRevs: 2,
      },
    ],
    entityEffort: [
      { entity: 'src/main.ts', 'total-revs': 15 },
      { entity: 'src/utils.ts', 'total-revs': 5 },
    ],
    codeChurn: [
      { date: '2025-01-01', added: 100, deleted: 20, commits: 5 },
      { date: '2025-01-02', added: 50, deleted: 30, commits: 3 },
    ],
    entityOwnership: [
      { entity: 'src/main.ts', author: 'alice', added: 180, deleted: 40 },
      { entity: 'src/main.ts', author: 'bob', added: 20, deleted: 10 },
      { entity: 'src/utils.ts', author: 'alice', added: 20, deleted: 10 },
      { entity: 'src/utils.ts', author: 'charlie', added: 10, deleted: 10 },
      { entity: 'src/legacy.ts', author: 'alice', added: 5, deleted: 3 },
      { entity: 'src/legacy.ts', author: 'dave', added: 5, deleted: 2 },
    ],
    pairing: {
      pairingIndexPercentage: 25,
      totalAnalyzedCommits: 100,
      pairedCommits: 25,
      topPairs: [
        { author: 'alice', coAuthor: 'bob', pairedCommits: 15 },
        { author: 'charlie', coAuthor: 'dave', pairedCommits: 5 },
      ],
    },
    bigOFiles: [
      {
        filePath: 'src/sort.ts',
        classification: 'Polynomial',
        score: 8,
        needsHelp: true,
      },
      {
        filePath: 'src/search.ts',
        classification: 'Logarithmic',
        score: 2,
        needsHelp: false,
      },
    ],
    crapMetrics: [
      { name: 'src/main.ts', complexity: 45, coverage: 20, crap: 35 },
      { name: 'src/utils.ts', complexity: 10, coverage: 80, crap: 5 },
    ],
  };
}

describe('CodeEvaluationService', () => {
  const service = new CodeEvaluationService();

  describe('evaluate', () => {
    it('returns evaluation with signals and summary', () => {
      const result = service.evaluate(makeRichData());
      expect(result.generatedAt).toBeDefined();
      expect(Array.isArray(result.signals)).toBe(true);
      expect(result.signals.length).toBeGreaterThan(0);
      expect(result.summary.totalChurn).toBeGreaterThan(0);
    });

    it('returns insufficient data signals for empty input', () => {
      const result = service.evaluate(makeEmptyData());
      expect(result.signals.length).toBeGreaterThan(0);
      for (const signal of result.signals) {
        expect(signal.metrics).toEqual([]);
        expect(signal.severity).toBe('good');
      }
    });

    it('detects churn hotspot when one file dominates', () => {
      const data = makeRichData();
      const result = service.evaluate(data);
      const hotspot = result.signals.find((s) => s.id === 'churn_hotspot');
      expect(hotspot).toBeDefined();
      expect(hotspot!.severity).toBe('critical');
    });

    it('detects coupling top with high degree', () => {
      const data = makeRichData();
      const result = service.evaluate(data);
      const coupling = result.signals.find((s) => s.id === 'coupling_top');
      expect(coupling).toBeDefined();
      expect(coupling!.severity).toBe('critical');
    });

    it('detects coupling burst with many high-coupling pairs', () => {
      const data = makeRichData();
      const result = service.evaluate(data);
      const burst = result.signals.find((s) => s.id === 'coupling_burst');
      expect(burst).toBeDefined();
      expect(burst!.severity).toBe('warning');
    });

    it('detects ownership concentration', () => {
      const data = makeRichData();
      const result = service.evaluate(data);
      const conc = result.signals.find((s) => s.id === 'ownership_concentration');
      expect(conc).toBeDefined();
      expect(conc!.severity).toBe('critical');
    });

    it('detects complexity hotspot from CRAP scores', () => {
      const data = makeRichData();
      const result = service.evaluate(data);
      const complexity = result.signals.find((s) => s.id === 'complexity_hotspot');
      expect(complexity).toBeDefined();
      expect(complexity!.severity).toBe('critical');
    });

    it('detects Big O performance risk', () => {
      const data = makeRichData();
      const result = service.evaluate(data);
      const bigO = result.signals.find((s) => s.id === 'complexity_big_o');
      expect(bigO).toBeDefined();
      expect(bigO!.severity).toBe('critical');
    });

    it('detects healthy pairing index', () => {
      const data = makeRichData();
      const result = service.evaluate(data);
      const pairing = result.signals.find((s) => s.id === 'pairing_index');
      expect(pairing).toBeDefined();
      expect(pairing!.severity).toBe('good');
    });

    it('detects pairing concentration', () => {
      const data = makeRichData();
      const result = service.evaluate(data);
      const conc = result.signals.find((s) => s.id === 'pairing_concentration');
      expect(conc).toBeDefined();
      expect(conc!.severity).toBe('critical');
    });

    it('builds summary correctly', () => {
      const data = makeRichData();
      const result = service.evaluate(data);
      expect(result.summary.totalChurn).toBe(315);
      expect(result.summary.topChurnFile).toBe('src/main.ts');
      expect(result.summary.mostCoupledPair).toContain('src/auth.ts');
      expect(result.summary.mostCoupledPair).toContain('src/db.ts');
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
