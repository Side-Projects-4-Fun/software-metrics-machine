import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { commands } from '../../src';
import {
  BigOService,
  CodemaatFactory,
  CodemaatService,
  GitFactory,
  PairingFactory,
} from '@smmachine/core';

describe('cli: Code Commands', () => {
  let program: Command;
  let fetchCommits: ReturnType<typeof vi.fn>;
  let fetchCodeMaat: ReturnType<typeof vi.fn>;
  let listFilesSpy: ReturnType<typeof vi.spyOn>;
  let analyzeFileSpy: ReturnType<typeof vi.spyOn>;
  let pairingIndexSpy: ReturnType<typeof vi.fn>;
  let getCodeChurnSpy: ReturnType<typeof vi.spyOn>;
  let getFileCouplingSpy: ReturnType<typeof vi.spyOn>;
  let getEntityEffortSpy: ReturnType<typeof vi.spyOn>;
  let getEntityOwnershipSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubEnv('SMM_STORE_DATA_AT', '/tmp');
    vi.stubEnv('OWNER_REPO_GIT_PROVIDER', 'github');
    vi.stubEnv('OWNER_REPO_GITHUB_TOKEN', 'fake-token');
    vi.stubEnv('OWNER_REPO_GIT_REPOSITORY_PATH', '/tmp/repo');

    fetchCommits = vi.fn().mockResolvedValue([
      {
        hash: 'abc123',
        author: 'Alice',
        email: 'alice@example.com',
        subject: 'Add feature',
        msg: 'Add feature',
        timestamp: '2025-01-01T00:00:00Z',
      },
    ]);

    vi.spyOn(GitFactory, 'create').mockReturnValue({
      fetchCommits,
    } as unknown as ReturnType<typeof GitFactory.create>);

    listFilesSpy = vi.spyOn(BigOService.prototype, 'listFiles').mockResolvedValue([
      {
        filePath: 'src/index.ts',
        fileName: 'index.ts',
        classification: 'O(n)',
        score: 10,
        needsHelp: false,
      },
    ]);

    analyzeFileSpy = vi.spyOn(BigOService.prototype, 'analyzeFile').mockResolvedValue({
      filePath: 'src/index.ts',
      fileName: 'index.ts',
      classification: 'O(n)',
      score: 10,
      needsHelp: false,
      content: 'const a = 1;',
      lines: [],
    });

    pairingIndexSpy = vi.fn().mockResolvedValue({
      pairingIndexPercentage: 30,
      totalAnalyzedCommits: 10,
      pairedCommits: 3,
      topPairings: [],
      latestPairedCommits: [],
    });

    vi.spyOn(PairingFactory, 'create').mockReturnValue({
      getPairingIndex: pairingIndexSpy,
    } as unknown as ReturnType<typeof PairingFactory.create>);

    fetchCodeMaat = vi.fn().mockReturnValue({
      repository: '/tmp/repo',
      outputDirectory: '/tmp/out',
      stdout: 'ok',
    });

    vi.spyOn(CodemaatFactory, 'createWriteRepository').mockReturnValue({
      fetch: fetchCodeMaat,
    } as unknown as ReturnType<typeof CodemaatFactory.createWriteRepository>);

    vi.spyOn(CodemaatFactory, 'create').mockReturnValue(
      {} as unknown as ReturnType<typeof CodemaatFactory.create>
    );

    getCodeChurnSpy = vi.spyOn(CodemaatService.prototype, 'getCodeChurn').mockResolvedValue({
      data: [{ commits: 2, added: 10, deleted: 4 }],
    } as unknown as Awaited<ReturnType<CodemaatService['getCodeChurn']>>);

    getFileCouplingSpy = vi
      .spyOn(CodemaatService.prototype, 'getFileCoupling')
      .mockResolvedValue([{ entity: 'a', coupled: 'b', degree: 40 }] as unknown as Awaited<
        ReturnType<CodemaatService['getFileCoupling']>
      >);

    getEntityEffortSpy = vi.spyOn(CodemaatService.prototype, 'getEntityEffort').mockResolvedValue([
      {
        entity: 'src/index.ts',
        'total-revs': 3,
      },
    ] as unknown as Awaited<ReturnType<CodemaatService['getEntityEffort']>>);

    getEntityOwnershipSpy = vi
      .spyOn(CodemaatService.prototype, 'getEntityOwnership')
      .mockResolvedValue([
        {
          entity: 'src/index.ts',
          author: 'Alice',
          added: 10,
          deleted: 2,
        },
      ] as unknown as Awaited<ReturnType<CodemaatService['getEntityOwnership']>>);

    program = commands();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('code big-o', () => {
    it('passes list filters to BigOService.listFiles', async () => {
      await program.parseAsync(
        [
          'code',
          'big-o',
          '--search',
          'src',
          '--ignore-files',
          '*.test.ts,*.spec.ts',
          '--include-only',
          'apps/cli/**',
          '--limit',
          '123',
          '--output',
          'json',
        ],
        { from: 'user' }
      );

      expect(listFilesSpy).toHaveBeenCalledWith({
        search: 'src',
        ignorePatterns: '*.test.ts,*.spec.ts',
        includePatterns: 'apps/cli/**',
        limit: 123,
      });
      expect(analyzeFileSpy).not.toHaveBeenCalled();
    });

    it('uses analyzeFile when --file is provided', async () => {
      await program.parseAsync(
        ['code', 'big-o', '--file', 'apps/cli/src/commands/code.ts', '--output', 'json'],
        { from: 'user' }
      );

      expect(analyzeFileSpy).toHaveBeenCalledWith('apps/cli/src/commands/code.ts');
      expect(listFilesSpy).not.toHaveBeenCalled();
    });
  });

  describe('code summary', () => {
    it('passes date filters to pairingService.getPairingIndex', async () => {
      await program.parseAsync(
        [
          'code',
          'summary',
          '--start-date',
          '2025-01-01',
          '--end-date',
          '2025-01-31',
          '--output',
          'json',
        ],
        { from: 'user' }
      );

      expect(pairingIndexSpy).toHaveBeenCalledWith({
        startDate: '2025-01-01',
        endDate: '2025-01-31',
      });
    });
  });

  describe('code fetch-commits', () => {
    it('passes fetch-commits filters to the git fetch repository', async () => {
      await program.parseAsync(
        [
          'code',
          'fetch-commits',
          '--start-date',
          '2025-01-01',
          '--end-date',
          '2025-01-31',
          '--authors',
          'Alice, Bob',
          '--force',
          '--buffer',
          '200',
        ],
        { from: 'user' }
      );

      expect(fetchCommits).toHaveBeenCalledWith({
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        selectedAuthors: ['Alice', 'Bob'],
        forceRefresh: true,
        maxBuffer: 200,
      });
    });

    it('omits selectedAuthors when --authors is not provided', async () => {
      await program.parseAsync(
        [
          'code',
          'fetch-commits',
          '--start-date',
          '2025-01-01',
          '--end-date',
          '2025-01-31',
          '--buffer',
          '50',
        ],
        { from: 'user' }
      );

      expect(fetchCommits).toHaveBeenCalledWith({
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        selectedAuthors: undefined,
        forceRefresh: undefined,
        maxBuffer: 50,
      });
    });
  });

  describe('code codemaat-fetch', () => {
    it('passes group-depth to codemaat fetch repository', async () => {
      await program.parseAsync(
        [
          'code',
          'codemaat-fetch',
          '--start-date',
          '2025-01-01',
          '--end-date',
          '2025-01-31',
          '--group-depth',
          '4',
          '--min-revs',
          '7',
          '--min-shared-revs',
          '9',
          '--min-coupling',
          '33',
        ],
        { from: 'user' }
      );

      expect(fetchCodeMaat).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: '2025-01-01',
          endDate: '2025-01-31',
          groupDepth: 4,
          minRevs: 7,
          minSharedRevs: 9,
          minCoupling: 33,
        })
      );
    });

    it('uses the default coupling thresholds when they are omitted', async () => {
      await program.parseAsync(
        ['code', 'codemaat-fetch', '--start-date', '2025-01-01', '--end-date', '2025-01-31'],
        { from: 'user' }
      );

      expect(fetchCodeMaat).toHaveBeenCalledWith(
        expect.objectContaining({
          minRevs: 5,
          minSharedRevs: 5,
          minCoupling: 30,
        })
      );
    });
  });

  describe('code churn', () => {
    it('passes date filters to CodemaatService.getCodeChurn', async () => {
      await program.parseAsync(
        [
          'code',
          'churn',
          '--start-date',
          '2025-02-01',
          '--end-date',
          '2025-02-28',
          '--output',
          'json',
        ],
        { from: 'user' }
      );

      expect(getCodeChurnSpy).toHaveBeenCalledWith({
        startDate: '2025-02-01',
        endDate: '2025-02-28',
      });
    });
  });

  describe('code coupling', () => {
    it('calls CodemaatService.getFileCoupling with command filters', async () => {
      await program.parseAsync(
        [
          'code',
          'coupling',
          '--start-date',
          '2025-03-01',
          '--end-date',
          '2025-03-31',
          '--min-coupling',
          '0.7',
          '--output',
          'json',
        ],
        { from: 'user' }
      );

      expect(getFileCouplingSpy).toHaveBeenCalledWith({
        ignorePatterns: undefined,
      });
    });
  });

  describe('code entity-churn', () => {
    it('passes date filters to CodemaatService.getCodeChurn', async () => {
      await program.parseAsync(
        [
          'code',
          'entity-churn',
          '--start-date',
          '2025-04-01',
          '--end-date',
          '2025-04-30',
          '--top',
          '15',
          '--output',
          'json',
        ],
        { from: 'user' }
      );

      expect(getCodeChurnSpy).toHaveBeenCalledWith({
        startDate: '2025-04-01',
        endDate: '2025-04-30',
      });
    });
  });

  describe('code entity-effort', () => {
    it('passes top to CodemaatService.getEntityEffort', async () => {
      await program.parseAsync(
        [
          'code',
          'entity-effort',
          '--top',
          '25',
          '--start-date',
          '2025-05-01',
          '--end-date',
          '2025-05-31',
        ],
        { from: 'user' }
      );

      expect(getEntityEffortSpy).toHaveBeenCalledWith({ top: 25 });
    });
  });

  describe('code entity-ownership', () => {
    it('calls CodemaatService.getEntityOwnership with expected defaults', async () => {
      await program.parseAsync(
        [
          'code',
          'entity-ownership',
          '--start-date',
          '2025-06-01',
          '--end-date',
          '2025-06-30',
          '--entity',
          'src/index.ts',
          '--output',
          'json',
        ],
        { from: 'user' }
      );

      expect(getEntityOwnershipSpy).toHaveBeenCalledWith({
        authors: undefined,
        top: 100,
      });
    });
  });

  describe('code pairing-index', () => {
    it('passes date filters to pairingService.getPairingIndex', async () => {
      await program.parseAsync(
        [
          'code',
          'pairing-index',
          '--start-date',
          '2025-07-01',
          '--end-date',
          '2025-07-31',
          '--min-shared',
          '5',
          '--output',
          'json',
        ],
        { from: 'user' }
      );

      expect(pairingIndexSpy).toHaveBeenCalledWith({
        startDate: '2025-07-01',
        endDate: '2025-07-31',
      });
    });
  });
});
