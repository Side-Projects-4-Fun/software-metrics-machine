import { describe, it, expect } from 'vitest';
import { SonarqubeEvaluationService } from '../sonarqube-evaluation-service';
import type { SonarqubeDashboardData } from '../sonarqube-evaluation-types';

function makeEmptyData(): SonarqubeDashboardData {
  return { quality: null, componentTree: [] };
}

function makeRichData(): SonarqubeDashboardData {
  return {
    quality: {
      reliabilityRating: 2,
      securityRating: 1,
      maintainabilityRating: 3,
      duplicationDensity: 7,
    },
    componentTree: [
      {
        key: 'src/main.ts',
        name: 'src/main.ts',
        complexity: 25,
        cognitiveComplexity: 15,
        ncloc: 200,
        coverage: 45,
        maintainabilityRating: 3,
      },
      {
        key: 'src/utils.ts',
        name: 'src/utils.ts',
        complexity: 5,
        cognitiveComplexity: 3,
        ncloc: 80,
        coverage: 90,
        maintainabilityRating: 1,
      },
    ],
  };
}

describe('SonarqubeEvaluationService', () => {
  const service = new SonarqubeEvaluationService();

  describe('evaluate', () => {
    it('returns evaluation with signals and summary', () => {
      const result = service.evaluate(makeRichData());
      expect(result.generatedAt).toBeDefined();
      expect(Array.isArray(result.signals)).toBe(true);
      expect(result.signals.length).toBeGreaterThan(0);
      expect(result.summary.totalComponents).toBe(2);
    });

    it('returns insufficient data signals for empty input', () => {
      const result = service.evaluate(makeEmptyData());
      expect(result.signals.length).toBeGreaterThan(0);
      for (const signal of result.signals) {
        expect(signal.severity).toBe('good');
      }
    });

    it('evaluates reliability rating', () => {
      const data = makeRichData();
      const result = service.evaluate(data);
      const rel = result.signals.find((s) => s.id === 'reliability_rating');
      expect(rel).toBeDefined();
      expect(rel!.severity).toBe('good');
    });

    it('flags critical reliability at rating 4', () => {
      const data = makeRichData();
      data.quality!.reliabilityRating = 4;
      const result = service.evaluate(data);
      const rel = result.signals.find((s) => s.id === 'reliability_rating');
      expect(rel!.severity).toBe('critical');
    });

    it('evaluates security rating', () => {
      const data = makeRichData();
      const result = service.evaluate(data);
      const sec = result.signals.find((s) => s.id === 'security_rating');
      expect(sec).toBeDefined();
      expect(sec!.severity).toBe('good');
    });

    it('evaluates maintainability rating', () => {
      const data = makeRichData();
      const result = service.evaluate(data);
      const maint = result.signals.find((s) => s.id === 'maintainability_rating');
      expect(maint).toBeDefined();
      expect(maint!.severity).toBe('warning');
    });

    it('evaluates duplication density', () => {
      const data = makeRichData();
      const result = service.evaluate(data);
      const dup = result.signals.find((s) => s.id === 'duplication_density');
      expect(dup).toBeDefined();
      expect(dup!.severity).toBe('warning');
    });

    it('flags critical duplication at 15%', () => {
      const data = makeRichData();
      data.quality!.duplicationDensity = 15;
      const result = service.evaluate(data);
      const dup = result.signals.find((s) => s.id === 'duplication_density');
      expect(dup!.severity).toBe('critical');
    });

    it('evaluates coverage health from component tree', () => {
      const data = makeRichData();
      const result = service.evaluate(data);
      const cov = result.signals.find((s) => s.id === 'coverage_health');
      expect(cov).toBeDefined();
    });

    it('detects complexity outlier', () => {
      const data = makeRichData();
      const result = service.evaluate(data);
      const comp = result.signals.find((s) => s.id === 'complexity_outlier');
      expect(comp).toBeDefined();
      expect(comp!.severity).toBe('good');
    });

    it('detects coverage outlier', () => {
      const data = makeRichData();
      const result = service.evaluate(data);
      const covOut = result.signals.find((s) => s.id === 'coverage_outlier');
      expect(covOut).toBeDefined();
    });

    it('builds summary correctly', () => {
      const data = makeRichData();
      const result = service.evaluate(data);
      expect(result.summary.totalComponents).toBe(2);
      expect(result.summary.avgComplexity).toBe(15);
      expect(result.summary.avgCoverage).toBe(67.5);
      expect(result.summary.totalNLOC).toBe(280);
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
