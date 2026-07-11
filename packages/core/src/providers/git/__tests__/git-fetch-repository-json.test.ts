import { describe, expect, it, vi } from 'vitest';
import { type ICommitTraverser } from '../../..';
import { Commit } from '../../../domain-types';
import { InMemoryRepository } from '../../../test/repositories/in-memory-repository';
import { GitFetchRepository } from '../git-fetch-repository-json';
import { MockLoggerBuilder } from '../../../test/infrastructure/mock-logger-builder';

describe('GitFetchRepository', () => {
  const logger = new MockLoggerBuilder().build();

  const createMocks = (commits?: Commit[]) => {
    const traverseCommits = vi.fn().mockResolvedValue({
      totalAnalyzedCommits: commits?.length ?? 0,
      pairedCommits: 0,
      commits: commits ?? [],
    });

    const commitTraverser: ICommitTraverser = { traverseCommits };
    const commitCache = new InMemoryRepository<Commit>();

    return { traverseCommits, commitTraverser, commitCache };
  };

  it('should pass maxBuffer to traverser when force refreshing', async () => {
    const { traverseCommits, commitTraverser, commitCache } = createMocks();

    const repository = new GitFetchRepository(commitTraverser, commitCache, logger);
    await repository.fetchCommits({ forceRefresh: true, maxBuffer: 200 });

    expect(traverseCommits).toHaveBeenCalledWith({ maxBuffer: 200 });
  });

  it('should pass maxBuffer with startDate and endDate to traverser', async () => {
    const { traverseCommits, commitTraverser, commitCache } = createMocks();

    const repository = new GitFetchRepository(commitTraverser, commitCache, logger);
    await repository.fetchCommits({
      startDate: '2025-01-01',
      endDate: '2025-01-31',
      forceRefresh: true,
      maxBuffer: 500,
    });

    expect(traverseCommits).toHaveBeenCalledWith({
      startDate: '2025-01-01',
      endDate: '2025-01-31',
      maxBuffer: 500,
    });
  });

  it('should pass selected authors to traverser when force refreshing', async () => {
    const { traverseCommits, commitTraverser, commitCache } = createMocks();

    const repository = new GitFetchRepository(commitTraverser, commitCache, logger);
    await repository.fetchCommits({
      selectedAuthors: ['Alice', 'Bob'],
      forceRefresh: true,
    });

    expect(traverseCommits).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedAuthors: ['Alice', 'Bob'],
      })
    );
  });

  it('should return cached commits without traversing when cache exists', async () => {
    const cachedCommits: Commit[] = [
      {
        hash: 'abc',
        author: 'Alice',
        email: 'a@b.com',
        subject: 'fix',
        msg: 'fix',
        timestamp: '2025-01-01T00:00:00Z',
      },
    ];
    const { traverseCommits, commitTraverser, commitCache } = createMocks();
    await commitCache.saveAll(cachedCommits);

    const repository = new GitFetchRepository(commitTraverser, commitCache, logger);
    const result = await repository.fetchCommits();

    expect(result).toEqual(cachedCommits);
    expect(traverseCommits).not.toHaveBeenCalled();
  });

  it('should save fetched commits to cache after traversal', async () => {
    const fetchedCommits: Commit[] = [
      {
        hash: 'def',
        author: 'Bob',
        email: 'b@c.com',
        subject: 'feat',
        msg: 'feat',
        timestamp: '2025-01-02T00:00:00Z',
      },
    ];
    const { commitTraverser, commitCache } = createMocks(fetchedCommits);

    const repository = new GitFetchRepository(commitTraverser, commitCache, logger);
    await repository.fetchCommits({ forceRefresh: true });

    const cached = await commitCache.loadAll();
    expect(cached).toEqual(fetchedCommits);
  });
});
