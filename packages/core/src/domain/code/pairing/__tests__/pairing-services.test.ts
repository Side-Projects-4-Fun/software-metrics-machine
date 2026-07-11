import { describe, it, expect, beforeEach } from 'vitest';
import { PairingService } from '../pairing-service';
import { CommitBuilder } from '../../../../test/domain-builders';
import { RepositoryBuilder } from '../../../../test/repository-builders';
import { Commit } from '../../../../domain-types';
import { IRepository, TimeZoneProvider } from '../../../../infrastructure';
import { MockLoggerBuilder } from '../../../../test/mock-logger-builder';

const logger = new MockLoggerBuilder().build();

describe('PairingService', () => {
  let pairingService: PairingService;
  let mockCommitRepo: IRepository<Commit>;

  beforeEach(() => {
    mockCommitRepo = new RepositoryBuilder<Commit>()
      .withLoadAll([
        new CommitBuilder()
          .withAuthor('Alice')
          .withMessage('Add feature')
          .withTimestamp('2024-01-01T10:00:00Z')
          .withFiles([{ path: 'src/main.ts', additions: 10, deletions: 0, status: 'added' }])
          .build(),
        new CommitBuilder()
          .withAuthor('Bob')
          .withMessage('Fix bug')
          .withTimestamp('2024-01-02T10:00:00Z')
          .withFiles([{ path: 'src/utils.ts', additions: 5, deletions: 2, status: 'modified' }])
          .build(),
      ])
      .build();

    pairingService = new PairingService(mockCommitRepo, new TimeZoneProvider('UTC'), logger);
  });

  it('should calculate pairing index correctly', async () => {
    const result = await pairingService.getPairingIndex();

    expect(result.totalAnalyzedCommits).toBeGreaterThan(0);
    expect(result.pairingIndexPercentage).toBeGreaterThanOrEqual(0);
    expect(result.pairingIndexPercentage).toBeLessThanOrEqual(100);
  });

  it('should return 0 for pairing index when no commits', async () => {
    pairingService = new PairingService(
      new RepositoryBuilder<Commit>().withLoadAll([]).build(),
      new TimeZoneProvider('UTC'),
      logger
    );

    const result = await pairingService.getPairingIndex();

    expect(result.totalAnalyzedCommits).toBe(0);
    expect(result.pairingIndexPercentage).toBe(0);
  });

  it('should filter commits by author', async () => {
    const result = await pairingService.getPairingIndex({
      selectedAuthors: ['Alice'],
    });

    expect(result).toBeDefined();
    expect(typeof result.pairingIndexPercentage).toBe('number');
  });

  it('should filter commits by exclude authors', async () => {
    const result = await pairingService.getPairingIndex({
      excludeAuthors: 'Bob',
    });

    expect(result).toBeDefined();
    expect(result.totalAnalyzedCommits).toBeGreaterThanOrEqual(0);
  });

  it('should round pairing index to 2 decimal places', async () => {
    const result = await pairingService.getPairingIndex();

    const decimalPlaces = result.pairingIndexPercentage.toString().split('.')[1]?.length || 0;
    expect(decimalPlaces).toBeLessThanOrEqual(2);
  });

  it('should filter commits by start date', async () => {
    const result = await pairingService.getPairingIndex({
      startDate: '2024-01-02',
    });

    expect(result.totalAnalyzedCommits).toBe(1);
  });

  it('should filter commits by end date', async () => {
    const result = await pairingService.getPairingIndex({
      endDate: '2024-01-01',
    });

    expect(result.totalAnalyzedCommits).toBe(1);
  });

  it('should filter commits by date range', async () => {
    const result = await pairingService.getPairingIndex({
      startDate: '2024-01-01',
      endDate: '2024-01-01',
    });

    expect(result.totalAnalyzedCommits).toBe(1);
  });

  it('should return 0 when start date is after all commits', async () => {
    const result = await pairingService.getPairingIndex({
      startDate: '2025-01-01',
    });

    expect(result.totalAnalyzedCommits).toBe(0);
  });

  it('should return 0 when end date is before all commits', async () => {
    const result = await pairingService.getPairingIndex({
      endDate: '2023-01-01',
    });

    expect(result.totalAnalyzedCommits).toBe(0);
  });

  it('should count a commit with coAuthors but no files as paired', async () => {
    pairingService = new PairingService(
      new RepositoryBuilder<Commit>()
        .withLoadAll([
          new CommitBuilder().withAuthor('Alice').withFiles([]).withCoAuthors(['Bob']).build(),
        ])
        .build(),
      new TimeZoneProvider('UTC'),
      logger
    );

    const result = await pairingService.getPairingIndex();

    expect(result.totalAnalyzedCommits).toBe(1);
    expect(result.pairedCommits).toBe(1);
  });

  it('should parse includeAuthors comma-separated string, trimming whitespace and dropping empty segments', async () => {
    pairingService = new PairingService(
      new RepositoryBuilder<Commit>()
        .withLoadAll([
          new CommitBuilder().withAuthor('Alice').build(),
          new CommitBuilder().withAuthor('Bob').build(),
          new CommitBuilder().withAuthor('Carol').build(),
        ])
        .build(),
      new TimeZoneProvider('UTC'),
      logger
    );

    const result = await pairingService.getPairingIndex({
      includeAuthors: 'Alice, Bob,',
    });

    expect(result.totalAnalyzedCommits).toBe(2);
  });

  it('should merge includeAuthors string with selectedAuthors array', async () => {
    pairingService = new PairingService(
      new RepositoryBuilder<Commit>()
        .withLoadAll([
          new CommitBuilder().withAuthor('Alice').build(),
          new CommitBuilder().withAuthor('Bob').build(),
          new CommitBuilder().withAuthor('Carol').build(),
        ])
        .build(),
      new TimeZoneProvider('UTC'),
      logger
    );

    const result = await pairingService.getPairingIndex({
      selectedAuthors: ['Alice'],
      includeAuthors: 'Bob',
    });

    expect(result.totalAnalyzedCommits).toBe(2);
  });

  describe('calculateTopPairings (via getPairingIndex)', () => {
    it('should produce one pairing entry per coAuthor on a commit with multiple coAuthors', async () => {
      pairingService = new PairingService(
        new RepositoryBuilder<Commit>()
          .withLoadAll([
            new CommitBuilder().withAuthor('Alice').withCoAuthors(['Bob', 'Carol']).build(),
          ])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await pairingService.getPairingIndex();

      expect(result.topPairings).toEqual(
        expect.arrayContaining([
          { author: 'Alice', coAuthor: 'Bob', pairedCommits: 1 },
          { author: 'Alice', coAuthor: 'Carol', pairedCommits: 1 },
        ])
      );
      expect(result.topPairings).toHaveLength(2);
    });

    it('should merge the same pair from two commits regardless of which author is primary', async () => {
      pairingService = new PairingService(
        new RepositoryBuilder<Commit>()
          .withLoadAll([
            new CommitBuilder().withAuthor('Alice').withCoAuthors(['Bob']).build(),
            new CommitBuilder().withAuthor('Bob').withCoAuthors(['Alice']).build(),
          ])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await pairingService.getPairingIndex();

      expect(result.topPairings).toEqual([{ author: 'Alice', coAuthor: 'Bob', pairedCommits: 2 }]);
    });

    it('should exclude a self-pair where the author and coAuthor are the same person case-insensitively', async () => {
      pairingService = new PairingService(
        new RepositoryBuilder<Commit>()
          .withLoadAll([new CommitBuilder().withAuthor('Alice').withCoAuthors(['alice']).build()])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await pairingService.getPairingIndex();

      expect(result.topPairings).toEqual([]);
    });

    it('should skip an empty-string or whitespace-only coAuthor entry', async () => {
      pairingService = new PairingService(
        new RepositoryBuilder<Commit>()
          .withLoadAll([new CommitBuilder().withAuthor('Alice').withCoAuthors(['   ']).build()])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await pairingService.getPairingIndex();

      expect(result.topPairings).toEqual([]);
    });

    it('should skip a commit whose author is empty or whitespace-only', async () => {
      pairingService = new PairingService(
        new RepositoryBuilder<Commit>()
          .withLoadAll([new CommitBuilder().withAuthor('   ').withCoAuthors(['Bob']).build()])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await pairingService.getPairingIndex();

      expect(result.topPairings).toEqual([]);
    });

    it('should sort pairings descending by pairedCommits, then by author, then by coAuthor', async () => {
      pairingService = new PairingService(
        new RepositoryBuilder<Commit>()
          .withLoadAll([
            // Alice/Bob paired twice -> highest count
            new CommitBuilder().withAuthor('Alice').withHash('c1').withCoAuthors(['Bob']).build(),
            new CommitBuilder().withAuthor('Alice').withHash('c2').withCoAuthors(['Bob']).build(),
            // Alice/Zoe and Alice/Yara both paired once -> tie broken by coAuthor
            new CommitBuilder().withAuthor('Alice').withHash('c3').withCoAuthors(['Zoe']).build(),
            new CommitBuilder().withAuthor('Alice').withHash('c4').withCoAuthors(['Yara']).build(),
          ])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await pairingService.getPairingIndex();

      expect(result.topPairings).toEqual([
        { author: 'Alice', coAuthor: 'Bob', pairedCommits: 2 },
        { author: 'Alice', coAuthor: 'Yara', pairedCommits: 1 },
        { author: 'Alice', coAuthor: 'Zoe', pairedCommits: 1 },
      ]);
    });

    it('should sort same-count, same-author pairings by coAuthor alphabetically using a third distinct pair', async () => {
      pairingService = new PairingService(
        new RepositoryBuilder<Commit>()
          .withLoadAll([
            new CommitBuilder().withAuthor('Bob').withHash('c1').withCoAuthors(['Carol']).build(),
            new CommitBuilder().withAuthor('Alice').withHash('c2').withCoAuthors(['Zoe']).build(),
            new CommitBuilder().withAuthor('Alice').withHash('c3').withCoAuthors(['Yara']).build(),
          ])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await pairingService.getPairingIndex();

      expect(result.topPairings).toEqual([
        { author: 'Alice', coAuthor: 'Yara', pairedCommits: 1 },
        { author: 'Alice', coAuthor: 'Zoe', pairedCommits: 1 },
        { author: 'Bob', coAuthor: 'Carol', pairedCommits: 1 },
      ]);
    });
  });

  describe('getLatestPairedCommits (via getPairingIndex)', () => {
    it('should only include commits with coAuthors, excluding unpaired commits from the latest list', async () => {
      pairingService = new PairingService(
        new RepositoryBuilder<Commit>()
          .withLoadAll([
            new CommitBuilder()
              .withAuthor('Alice')
              .withHash('paired-1')
              .withCoAuthors(['Bob'])
              .build(),
            new CommitBuilder().withAuthor('Carol').withHash('unpaired-1').build(),
          ])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await pairingService.getPairingIndex();

      expect(result.totalAnalyzedCommits).toBe(2);
      expect(result.latestPairedCommits).toHaveLength(1);
      expect(result.latestPairedCommits?.[0].hash).toBe('paired-1');
    });

    it('should sort latest paired commits by timestamp descending', async () => {
      pairingService = new PairingService(
        new RepositoryBuilder<Commit>()
          .withLoadAll([
            new CommitBuilder()
              .withAuthor('Alice')
              .withHash('older')
              .withTimestamp('2024-01-01T10:00:00Z')
              .withCoAuthors(['Bob'])
              .build(),
            new CommitBuilder()
              .withAuthor('Alice')
              .withHash('newer')
              .withTimestamp('2024-01-05T10:00:00Z')
              .withCoAuthors(['Bob'])
              .build(),
          ])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await pairingService.getPairingIndex();

      expect(result.latestPairedCommits?.map((c) => c.hash)).toEqual(['newer', 'older']);
    });

    it('should serialize a Date timestamp via toISOString', async () => {
      const dateTimestamp = new Date('2024-01-01T10:00:00Z');
      pairingService = new PairingService(
        new RepositoryBuilder<Commit>()
          .withLoadAll([
            new CommitBuilder()
              .withAuthor('Alice')
              .withHash('date-commit')
              .withCoAuthors(['Bob'])
              .withTimestamp(dateTimestamp)
              .build(),
          ])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await pairingService.getPairingIndex();

      expect(result.latestPairedCommits?.[0].timestamp).toBe(dateTimestamp.toISOString());
    });

    it('should use subject when set, falling back to msg, then to an empty string', async () => {
      pairingService = new PairingService(
        new RepositoryBuilder<Commit>()
          .withLoadAll([
            new CommitBuilder()
              .withAuthor('Alice')
              .withHash('with-subject')
              .withMessage('fallback msg')
              .withCoAuthors(['Bob'])
              .withSubject('explicit subject')
              .build(),
            new CommitBuilder()
              .withAuthor('Alice')
              .withHash('without-subject')
              .withMessage('used as fallback')
              .withCoAuthors(['Bob'])
              .build(),
            new CommitBuilder()
              .withAuthor('Alice')
              .withHash('neither')
              .withCoAuthors(['Bob'])
              .withSubject('')
              .withMessage('')
              .build(),
          ])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await pairingService.getPairingIndex();

      const byHash = new Map(result.latestPairedCommits?.map((c) => [c.hash, c.subject]));
      expect(byHash.get('with-subject')).toBe('explicit subject');
      expect(byHash.get('without-subject')).toBe('used as fallback');
      expect(byHash.get('neither')).toBe('');
    });
  });

  describe('filterByAuthors (via getPairingIndex)', () => {
    it('should exclude an author even when that author is also in selectedAuthors', async () => {
      pairingService = new PairingService(
        new RepositoryBuilder<Commit>()
          .withLoadAll([
            new CommitBuilder().withAuthor('Alice').withHash('alice-commit').build(),
            new CommitBuilder().withAuthor('Bob').withHash('bob-commit').build(),
          ])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await pairingService.getPairingIndex({
        selectedAuthors: ['Alice', 'Bob'],
        excludeAuthors: 'Alice',
      });

      expect(result.totalAnalyzedCommits).toBe(1);
    });
  });
});
