import { describe, it, expect, vi } from 'vitest';
import { SonarqubeEvaluationController } from '../src/controllers/sonarqube-evaluation.controller';
import type { SonarqubeRepository } from '@smmachine/core';

function makeQualityMeasures() {
  return {
    id: 'comp-1',
    key: 'test-project',
    name: 'Test Project',
    measures: [
      { metric: 'reliability_rating', value: '2', bestValue: false },
      { metric: 'security_rating', value: '1', bestValue: false },
      {
        metric: 'sqale_rating',
        value: '3',
        bestValue: false,
      },
      {
        metric: 'duplicated_lines_density',
        value: '4.5',
        bestValue: false,
      },
    ],
  };
}

function makeComponentTree() {
  return [
    {
      key: 'file-a.ts',
      name: 'file-a.ts',
      measures: [
        { metric: 'complexity', value: '25', formatter: 'NUMBER' },
        {
          metric: 'cognitive_complexity',
          value: '15',
          formatter: 'NUMBER',
        },
        { metric: 'ncloc', value: '200', formatter: 'NUMBER' },
        { metric: 'coverage', value: '45', formatter: 'PERCENT' },
        {
          metric: 'sqale_rating',
          value: '3',
          formatter: 'RATING',
        },
      ],
    },
  ];
}

function makeController() {
  const mockRepo = {
    loadAll: vi.fn().mockResolvedValue(makeQualityMeasures()),
    loadComponentTree: vi.fn().mockResolvedValue(makeComponentTree()),
    loadMeasurements: vi.fn(),
    loadAllMeasurementEntries: vi.fn(),
    loadAllComponentTreeEntries: vi.fn(),
    loadHistoricalMeasures: vi.fn(),
    loadCoverageHistory: vi.fn(),
    loadAllHistoricalMeasureEntries: vi.fn(),
  } as unknown as SonarqubeRepository;

  const controller = new SonarqubeEvaluationController(mockRepo);
  return { controller, mockRepo };
}

describe('SonarqubeEvaluationController', () => {
  describe('evaluate', () => {
    it('returns evaluation with signals and summary', async () => {
      const { controller } = makeController();
      const result = await controller.evaluate();

      expect(result).toBeDefined();
      expect(result.generatedAt).toBeDefined();
      expect(Array.isArray(result.signals)).toBe(true);
      expect(result.signals.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
      expect(typeof result.summary.totalComponents).toBe('number');
    });

    it('passes ignore_files and include_files to loadComponentTree', async () => {
      const { controller, mockRepo } = makeController();

      await controller.evaluate('*.test.ts', 'src/**');

      expect(mockRepo.loadComponentTree).toHaveBeenCalledWith(
        expect.objectContaining({
          ignore_files: '*.test.ts',
          include_files: 'src/**',
        })
      );
    });

    it('passes remove_folders to loadComponentTree', async () => {
      const { controller, mockRepo } = makeController();

      await controller.evaluate(undefined, undefined, 'true');

      expect(mockRepo.loadComponentTree).toHaveBeenCalledWith(
        expect.objectContaining({ remove_folders: true })
      );
    });

    it('handles missing quality data gracefully', async () => {
      const { mockRepo } = makeController();
      mockRepo.loadAll = vi.fn().mockResolvedValue(null);
      const controller = new SonarqubeEvaluationController(mockRepo);

      const result = await controller.evaluate();

      expect(result).toBeDefined();
      expect(result.summary.duplicationDensity).toBe(0);
    });

    it('returns signals with expected structure', async () => {
      const { controller } = makeController();
      const result = await controller.evaluate();

      for (const signal of result.signals) {
        expect(signal).toHaveProperty('id');
        expect(signal).toHaveProperty('title');
        expect(signal).toHaveProperty('description');
        expect(signal).toHaveProperty('severity');
        expect(signal).toHaveProperty('category');
        expect(signal).toHaveProperty('metrics');
        expect(Array.isArray(signal.metrics)).toBe(true);
        expect(['critical', 'warning', 'good']).toContain(signal.severity);
      }
    });
  });
});
