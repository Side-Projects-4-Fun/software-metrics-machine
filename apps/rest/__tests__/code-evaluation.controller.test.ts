import { describe, it, expect, vi } from 'vitest';
import { CodeEvaluationController } from '../src/controllers/code-evaluation.controller';
import type { BigOService, ICodeMetricsRepository, SonarqubeMeasuresClient } from '@smmachine/core';
import type { PairingService } from '@smmachine/core/domain/code/pairing/pairing-service';

function makeEmptyController() {
  const mockCodemaat = {
    getEntityChurn: vi.fn().mockResolvedValue([]),
    getFileCoupling: vi.fn().mockResolvedValue([]),
    getEntityEffort: vi.fn().mockResolvedValue([]),
    getCodeChurn: vi.fn().mockResolvedValue({ data: [] }),
    getEntityOwnership: vi.fn().mockResolvedValue([]),
  } as unknown as ICodeMetricsRepository;

  const mockPairingService = {
    getPairingIndex: vi.fn().mockResolvedValue({
      pairingIndexPercentage: 50,
      totalAnalyzedCommits: 10,
      pairedCommits: 5,
      topPairings: [{ author: 'alice', coAuthor: 'bob', pairedCommits: 5 }],
      latestPairedCommits: [],
    }),
  } as unknown as PairingService;

  const mockBigOService = {
    listFiles: vi.fn().mockResolvedValue([]),
    analyzeFile: vi.fn(),
  } as unknown as BigOService;

  const mockSonarqubeClient = {
    fetchComponentTree: vi.fn().mockResolvedValue([]),
    fetchComponentMeasures: vi.fn(),
    fetchHistoricalMeasures: vi.fn(),
  } as unknown as SonarqubeMeasuresClient;

  const controller = new CodeEvaluationController(
    mockPairingService,
    mockCodemaat,
    mockBigOService,
    mockSonarqubeClient
  );

  return {
    controller,
    mockCodemaat,
    mockPairingService,
    mockBigOService,
    mockSonarqubeClient,
  };
}

describe('CodeEvaluationController', () => {
  describe('evaluate', () => {
    it('returns evaluation with signals and summary', async () => {
      const { controller } = makeEmptyController();
      const result = await controller.evaluate();

      expect(result).toBeDefined();
      expect(result.generatedAt).toBeDefined();
      expect(Array.isArray(result.signals)).toBe(true);
      expect(result.summary).toBeDefined();
      expect(typeof result.summary.totalChurn).toBe('number');
      expect(typeof result.summary.avgPairingIndex).toBe('number');
    });

    it('passes date filters to codemaat', async () => {
      const { controller, mockCodemaat } = makeEmptyController();

      await controller.evaluate('2025-01-01', '2025-01-31');

      expect(mockCodemaat.getCodeChurn).toHaveBeenCalledWith({
        startDate: '2025-01-01',
        endDate: '2025-01-31',
      });
    });

    it('passes ignore_files and include_only to codemaat methods', async () => {
      const { controller, mockCodemaat } = makeEmptyController();

      await controller.evaluate(undefined, undefined, '*.test.ts', 'src/**');

      expect(mockCodemaat.getEntityChurn).toHaveBeenCalledWith(
        expect.objectContaining({
          ignorePatterns: '*.test.ts',
          includePatterns: 'src/**',
        })
      );
    });

    it('passes top limit to codemaat', async () => {
      const { controller, mockCodemaat } = makeEmptyController();

      await controller.evaluate(undefined, undefined, undefined, undefined, 20);

      expect(mockCodemaat.getEntityChurn).toHaveBeenCalledWith(
        expect.objectContaining({ top: 20 })
      );
    });

    it('handles SonarQube failure gracefully', async () => {
      const { controller, mockSonarqubeClient } = makeEmptyController();
      (mockSonarqubeClient.fetchComponentTree as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('SonarQube unavailable')
      );

      const result = await controller.evaluate();

      expect(result).toBeDefined();
      expect(result.signals.length).toBeGreaterThan(0);
    });

    it('handles pairing service failure gracefully', async () => {
      const { controller, mockPairingService } = makeEmptyController();
      (mockPairingService.getPairingIndex as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('No commits')
      );

      const result = await controller.evaluate();

      expect(result).toBeDefined();
      expect(result.summary.avgPairingIndex).toBe(0);
    });

    it('returns signals with expected structure', async () => {
      const { controller } = makeEmptyController();
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
