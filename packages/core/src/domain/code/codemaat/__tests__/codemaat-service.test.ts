import { describe, expect, it, vi } from 'vitest';
import { CodemaatService } from '../codemaat-service';
import type { ICodeMetricsRepository } from '../repositories/codemaat-metrics-repository';

describe('CodemaatService', () => {
  function createRepository() {
    return {
      getCodeChurn: vi
        .fn()
        .mockResolvedValue({ data: [], startDate: undefined, endDate: undefined }),
      getCodeChurnHistory: vi.fn().mockResolvedValue([]),
      getFileCoupling: vi.fn().mockResolvedValue([]),
      getFileCouplingHistory: vi.fn().mockResolvedValue([]),
      getLayeredCoupling: vi.fn().mockResolvedValue([]),
      getLayeredCouplingHistory: vi.fn().mockResolvedValue([]),
      getEntityChurn: vi.fn().mockResolvedValue([]),
      getEntityChurnHistory: vi.fn().mockResolvedValue([]),
      getEntityEffort: vi.fn().mockResolvedValue([]),
      getEntityEffortHistory: vi.fn().mockResolvedValue([]),
      getEntityOwnership: vi.fn().mockResolvedValue([]),
      getEntityOwnershipHistory: vi.fn().mockResolvedValue([]),
    } as unknown as ICodeMetricsRepository;
  }

  it('forwards code churn date filters to the repository', async () => {
    const repository = createRepository();
    const service = new CodemaatService(repository);

    await service.getCodeChurn({ startDate: '2026-01-01', endDate: '2026-01-31' });

    expect(repository.getCodeChurn).toHaveBeenCalledWith({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });
  });

  it('forwards file coupling ignore patterns to the repository', async () => {
    const repository = createRepository();
    const service = new CodemaatService(repository);

    await service.getFileCoupling({ ignorePatterns: ['**/*.test.ts', 'dist/**'] });

    expect(repository.getFileCoupling).toHaveBeenCalledWith({
      ignorePatterns: ['**/*.test.ts', 'dist/**'],
    });
  });

  it('maps entity effort public filters to repository filter names', async () => {
    const repository = createRepository();
    const service = new CodemaatService(repository);

    await service.getEntityEffort({
      ignoreFiles: '**/*.test.ts',
      includeOnly: 'src/**',
      top: 5,
    });

    expect(repository.getEntityEffort).toHaveBeenCalledWith({
      ignorePatterns: '**/*.test.ts',
      includePatterns: 'src/**',
      top: 5,
    });
  });

  it('maps entity ownership public filters to repository filter names', async () => {
    const repository = createRepository();
    const service = new CodemaatService(repository);

    await service.getEntityOwnership({
      ignoreFiles: '**/*.spec.ts',
      includeOnly: 'packages/core/**',
      authors: 'Ada,Grace',
      top: 3,
    });

    expect(repository.getEntityOwnership).toHaveBeenCalledWith({
      ignorePatterns: '**/*.spec.ts',
      includePatterns: 'packages/core/**',
      authors: 'Ada,Grace',
      top: 3,
    });
  });
});
