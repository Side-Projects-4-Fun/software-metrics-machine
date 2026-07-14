import { describe, expect, it, vi } from 'vitest';
import { CodeController } from '../src/controllers/code.controller';

describe('CodeController', () => {
  function createController() {
    const pairingService = {
      getPairingIndex: vi.fn(),
    };
    const codemaat = {
      getCodeChurn: vi.fn(),
      getCodeChurnHistory: vi.fn(),
      getFileCoupling: vi.fn(),
      getFileCouplingHistory: vi.fn(),
      getLayeredCoupling: vi.fn(),
      getLayeredCouplingHistory: vi.fn(),
      getEntityChurn: vi.fn(),
      getEntityChurnHistory: vi.fn(),
      getEntityEffort: vi.fn(),
      getEntityEffortHistory: vi.fn(),
      getEntityOwnership: vi.fn(),
      getEntityOwnershipHistory: vi.fn(),
    };
    const bigOService = {
      listFiles: vi.fn(),
      analyzeFile: vi.fn(),
    };
    const controller = new CodeController(
      pairingService as never,
      codemaat as never,
      bigOService as never
    );

    return { controller, pairingService, codemaat, bigOService };
  }

  describe('pairingIndex', () => {
    it('maps a full pairing result to the response shape', async () => {
      const { controller, pairingService } = createController();
      pairingService.getPairingIndex.mockResolvedValue({
        pairingIndexPercentage: 42.5,
        totalAnalyzedCommits: 100,
        pairedCommits: 30,
        topPairings: [{ author: 'alice', coAuthor: 'bob', pairedCommits: 5 }],
        latestPairedCommits: [
          {
            hash: 'abc123',
            author: 'alice',
            coAuthors: ['bob'],
            timestamp: '2026-01-01T00:00:00Z',
            subject: 'fix things',
          },
        ],
      });

      const result = await controller.pairingIndex('2026-01-01', '2026-06-01', 'alice,bob');

      expect(pairingService.getPairingIndex).toHaveBeenCalledWith({
        startDate: '2026-01-01',
        endDate: '2026-06-01',
        includeAuthors: 'alice,bob',
      });
      expect(result).toEqual({
        pairing_index_percentage: 42.5,
        total_analyzed_commits: 100,
        paired_commits: 30,
        top_pairs: [{ author: 'alice', co_author: 'bob', paired_commits: 5 }],
        latest_paired_commits: [
          {
            hash: 'abc123',
            author: 'alice',
            co_authors: ['bob'],
            timestamp: '2026-01-01T00:00:00Z',
            subject: 'fix things',
          },
        ],
      });
    });

    it('falls back to defaults when pairing result is nullish', async () => {
      const { controller, pairingService } = createController();
      pairingService.getPairingIndex.mockResolvedValue(null);

      const result = await controller.pairingIndex();

      expect(result).toEqual({
        pairing_index_percentage: 0,
        total_analyzed_commits: 0,
        paired_commits: 0,
        top_pairs: [],
        latest_paired_commits: [],
      });
    });
  });

  describe('codeChurn', () => {
    it('forwards query params and returns churn.data as-is', async () => {
      const { controller, codemaat } = createController();
      const data = [{ date: '2026-01-01', type: 'added', value: 10 }];
      codemaat.getCodeChurn.mockResolvedValue({ data });

      const result = await controller.codeChurn('2026-01-01', '2026-06-01', 'added');

      expect(codemaat.getCodeChurn).toHaveBeenCalledWith({
        startDate: '2026-01-01',
        endDate: '2026-06-01',
        typeChurn: 'added',
      });
      expect(result).toBe(data);
    });
  });

  describe('codeChurnHistory', () => {
    it('forwards query params and returns timestamped history entries', async () => {
      const { controller, codemaat } = createController();
      const history = [{ fetchedAt: '2026-07-13T12:00:00.000Z', data: [] }];
      codemaat.getCodeChurnHistory.mockResolvedValue(history);

      const result = await controller.codeChurnHistory('2026-01-01', '2026-06-01');

      expect(codemaat.getCodeChurnHistory).toHaveBeenCalledWith({
        startDate: '2026-01-01',
        endDate: '2026-06-01',
      });
      expect(result).toBe(history);
    });
  });

  describe('coupling', () => {
    it('forwards query params with sortBy hardcoded to degree', async () => {
      const { controller, codemaat } = createController();
      const coupling = [{ entity: 'a.ts', coupled: 'b.ts', degree: 80, averageRevs: 3 }];
      codemaat.getFileCoupling.mockResolvedValue(coupling);

      const result = await controller.coupling('ignored.ts', 'included.ts', '5');

      expect(codemaat.getFileCoupling).toHaveBeenCalledWith({
        ignorePatterns: 'ignored.ts',
        includePatterns: 'included.ts',
        top: '5',
        sortBy: 'degree',
      });
      expect(result).toBe(coupling);
    });
  });

  describe('couplingHistory', () => {
    it('forwards query params with sortBy hardcoded to degree', async () => {
      const { controller, codemaat } = createController();
      const history = [{ fetchedAt: '2026-07-13T12:00:00.000Z', data: [] }];
      codemaat.getFileCouplingHistory.mockResolvedValue(history);

      const result = await controller.couplingHistory('ignored.ts', 'included.ts', '5');

      expect(codemaat.getFileCouplingHistory).toHaveBeenCalledWith({
        ignorePatterns: 'ignored.ts',
        includePatterns: 'included.ts',
        top: '5',
        sortBy: 'degree',
      });
      expect(result).toBe(history);
    });
  });

  describe('layeredCoupling', () => {
    it('forwards query params with sortBy hardcoded to degree', async () => {
      const { controller, codemaat } = createController();
      const coupling = [{ entity: 'layer-a', coupled: 'layer-b', degree: 80, averageRevs: 3 }];
      codemaat.getLayeredCoupling.mockResolvedValue(coupling);

      const result = await controller.layeredCoupling('ignored.ts', 'included.ts', '5');

      expect(codemaat.getLayeredCoupling).toHaveBeenCalledWith({
        ignorePatterns: 'ignored.ts',
        includePatterns: 'included.ts',
        top: '5',
        sortBy: 'degree',
      });
      expect(result).toBe(coupling);
    });
  });

  describe('layeredCouplingHistory', () => {
    it('forwards query params with sortBy hardcoded to degree', async () => {
      const { controller, codemaat } = createController();
      const history = [{ fetchedAt: '2026-07-13T12:00:00.000Z', data: [] }];
      codemaat.getLayeredCouplingHistory.mockResolvedValue(history);

      const result = await controller.layeredCouplingHistory('ignored.ts', 'included.ts', '5');

      expect(codemaat.getLayeredCouplingHistory).toHaveBeenCalledWith({
        ignorePatterns: 'ignored.ts',
        includePatterns: 'included.ts',
        top: '5',
        sortBy: 'degree',
      });
      expect(result).toBe(history);
    });
  });

  describe('entityChurn', () => {
    it('forwards query params to getEntityChurn', async () => {
      const { controller, codemaat } = createController();
      const churn = [{ entity: 'a.ts', added: 10, deleted: 2, commits: 3 }];
      codemaat.getEntityChurn.mockResolvedValue(churn);

      const result = await controller.entityChurn('ignored.ts', 'included.ts', '5');

      expect(codemaat.getEntityChurn).toHaveBeenCalledWith({
        ignorePatterns: 'ignored.ts',
        includePatterns: 'included.ts',
        top: '5',
      });
      expect(result).toBe(churn);
    });
  });

  describe('entityChurnHistory', () => {
    it('forwards query params to getEntityChurnHistory', async () => {
      const { controller, codemaat } = createController();
      const history = [{ fetchedAt: '2026-07-13T12:00:00.000Z', data: [] }];
      codemaat.getEntityChurnHistory.mockResolvedValue(history);

      const result = await controller.entityChurnHistory('ignored.ts', 'included.ts', '5');

      expect(codemaat.getEntityChurnHistory).toHaveBeenCalledWith({
        ignorePatterns: 'ignored.ts',
        includePatterns: 'included.ts',
        top: '5',
      });
      expect(result).toBe(history);
    });
  });

  describe('entityEffort', () => {
    it('forwards query params to getEntityEffort', async () => {
      const { controller, codemaat } = createController();
      const effort = [{ entity: 'a.ts', 'total-revs': 12 }];
      codemaat.getEntityEffort.mockResolvedValue(effort);

      const result = await controller.entityEffort('ignored.ts', 'included.ts', '5');

      expect(codemaat.getEntityEffort).toHaveBeenCalledWith({
        ignorePatterns: 'ignored.ts',
        includePatterns: 'included.ts',
        top: '5',
      });
      expect(result).toBe(effort);
    });
  });

  describe('entityEffortHistory', () => {
    it('forwards query params to getEntityEffortHistory', async () => {
      const { controller, codemaat } = createController();
      const history = [{ fetchedAt: '2026-07-13T12:00:00.000Z', data: [] }];
      codemaat.getEntityEffortHistory.mockResolvedValue(history);

      const result = await controller.entityEffortHistory('ignored.ts', 'included.ts', '5');

      expect(codemaat.getEntityEffortHistory).toHaveBeenCalledWith({
        ignorePatterns: 'ignored.ts',
        includePatterns: 'included.ts',
        top: '5',
      });
      expect(result).toBe(history);
    });
  });

  describe('entityOwnership', () => {
    it('forwards query params to getEntityOwnership', async () => {
      const { controller, codemaat } = createController();
      const ownership = [{ entity: 'a.ts', author: 'alice', added: 10, deleted: 2 }];
      codemaat.getEntityOwnership.mockResolvedValue(ownership);

      const result = await controller.entityOwnership(
        'ignored.ts',
        'included.ts',
        'alice,bob',
        '5'
      );

      expect(codemaat.getEntityOwnership).toHaveBeenCalledWith({
        ignorePatterns: 'ignored.ts',
        includePatterns: 'included.ts',
        authors: 'alice,bob',
        top: '5',
      });
      expect(result).toBe(ownership);
    });
  });

  describe('entityOwnershipHistory', () => {
    it('forwards query params to getEntityOwnershipHistory', async () => {
      const { controller, codemaat } = createController();
      const history = [{ fetchedAt: '2026-07-13T12:00:00.000Z', data: [] }];
      codemaat.getEntityOwnershipHistory.mockResolvedValue(history);

      const result = await controller.entityOwnershipHistory(
        'ignored.ts',
        'included.ts',
        'alice,bob',
        '5'
      );

      expect(codemaat.getEntityOwnershipHistory).toHaveBeenCalledWith({
        ignorePatterns: 'ignored.ts',
        includePatterns: 'included.ts',
        authors: 'alice,bob',
        top: '5',
      });
      expect(result).toBe(history);
    });
  });

  describe('codeAuthors', () => {
    it('calls getEntityOwnership with select authors and no query params', async () => {
      const { controller, codemaat } = createController();
      const authors = ['alice', 'bob'];
      codemaat.getEntityOwnership.mockResolvedValue(authors);

      const result = await controller.codeAuthors();

      expect(codemaat.getEntityOwnership).toHaveBeenCalledWith({ select: 'authors' });
      expect(result).toBe(authors);
    });
  });

  describe('bigOFiles', () => {
    it('forwards search and limit to the Big O service', async () => {
      const { controller, bigOService } = createController();
      const files = [
        {
          filePath: 'src/index.ts',
          fileName: 'index.ts',
          classification: 'O(n)',
          score: 38,
          needsHelp: false,
        },
      ];
      bigOService.listFiles.mockResolvedValue(files);

      const result = await controller.bigOFiles('src', '25', '*.test.ts', 'src/**');

      expect(bigOService.listFiles).toHaveBeenCalledWith({
        search: 'src',
        ignorePatterns: '*.test.ts',
        includePatterns: 'src/**',
        limit: 25,
      });
      expect(result).toBe(files);
    });
  });

  describe('bigOFile', () => {
    it('returns line-level analysis for a file', async () => {
      const { controller, bigOService } = createController();
      const analysis = {
        filePath: 'src/index.ts',
        fileName: 'index.ts',
        classification: 'O(n)',
        score: 38,
        needsHelp: false,
        content: 'for (const item of items) {}',
        lines: [
          {
            lineNumber: 1,
            content: 'for (const item of items) {}',
            classification: 'O(n)',
            reason: 'linear iteration',
          },
        ],
      };
      bigOService.analyzeFile.mockResolvedValue(analysis);

      const result = await controller.bigOFile('src/index.ts');

      expect(bigOService.analyzeFile).toHaveBeenCalledWith('src/index.ts');
      expect(result).toBe(analysis);
    });
  });
});
