import { describe, it, expect, vi } from 'vitest';
import { ArchitectureEvaluationController } from '../src/controllers/architecture-evaluation.controller';
import type { ArchitectureService } from '@smmachine/core';

function makeContainerView() {
  return {
    id: 'view-1',
    level: 'container' as const,
    title: 'Container View',
    nodes: [
      {
        id: 'c:api',
        kind: 'container' as const,
        name: 'API',
        technology: 'NestJS',
      },
      {
        id: 'c:web',
        kind: 'container' as const,
        name: 'Web App',
        technology: 'Next.js',
      },
      { id: 'c:db', kind: 'container' as const, name: 'Database' },
      {
        id: 'p:dev',
        kind: 'person' as const,
        name: 'Developer',
      },
      { id: 's:sys', kind: 'system' as const, name: 'GitHub' },
    ],
    edges: [
      { id: 'e1', source: 'c:web', target: 'c:api', kind: 'uses' as const, confidence: 0.9 },
      { id: 'e2', source: 'c:api', target: 'c:db', kind: 'uses' as const, confidence: 0.8 },
      { id: 'e3', source: 'p:dev', target: 'c:web', kind: 'uses' as const, confidence: 1.0 },
    ],
  };
}

function makeSnapshot() {
  return {
    snapshotId: 'snap-1',
    generatedAt: '2025-01-01T00:00:00.000Z',
    project: 'test/project',
    commitCount: 42,
    views: [makeContainerView()],
  };
}

function makeController() {
  const mockService = {
    getSnapshot: vi.fn().mockResolvedValue(makeSnapshot()),
    getView: vi.fn().mockResolvedValue(makeContainerView()),
    listSnapshots: vi.fn(),
    generateSnapshot: vi.fn(),
  } as unknown as ArchitectureService;

  const controller = new ArchitectureEvaluationController(mockService);
  return { controller, mockService };
}

describe('ArchitectureEvaluationController', () => {
  describe('evaluate', () => {
    it('returns evaluation with signals and summary', async () => {
      const { controller } = makeController();
      const result = await controller.evaluate();

      expect(result).toBeDefined();
      expect(result.generatedAt).toBeDefined();
      expect(Array.isArray(result.signals)).toBe(true);
      expect(result.signals.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
      expect(typeof result.summary.totalContainers).toBe('number');
    });

    it('passes snapshot_id to architecture service', async () => {
      const { controller, mockService } = makeController();

      await controller.evaluate('my-snapshot');

      expect(mockService.getSnapshot).toHaveBeenCalledWith('my-snapshot');
    });

    it('passes level param to filter view', async () => {
      const { controller, mockService } = makeController();

      await controller.evaluate(undefined, 'component');

      expect(mockService.getSnapshot).toHaveBeenCalled();
    });

    it('handles missing snapshot gracefully', async () => {
      const { mockService } = makeController();
      mockService.getSnapshot = vi.fn().mockResolvedValue(null);
      const controller = new ArchitectureEvaluationController(mockService);

      const result = await controller.evaluate();

      expect(result).toBeDefined();
      expect(result.signals).toHaveLength(1);
      expect(result.signals[0]?.id).toBe('no_snapshot');
    });

    it('passes ignore_files and include_only to getView', async () => {
      const { controller, mockService } = makeController();

      await controller.evaluate(undefined, undefined, '*.test.ts', 'src/**');

      expect(mockService.getView).toHaveBeenCalledWith(
        'container',
        'snap-1',
        expect.objectContaining({
          ignorePatterns: '*.test.ts',
          includePatterns: 'src/**',
        })
      );
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
