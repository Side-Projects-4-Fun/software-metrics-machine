import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Logger } from '@smmachine/utils';
import {
  Configuration,
  RepositoryFactory,
  SqliteRepository,
  TimeZoneProvider,
} from '../../../infrastructure';
import type {
  PullRequestCommentJsonResponse,
  PullRequestJsonResponse,
} from '../../../providers/github/github-response-types';
import {
  PullRequestCommentJsonResponseBuilder,
  PullRequestJsonResponseBuilder,
} from '../../../test/github/github-builders';
import { ChangeRequestFactory } from '../factories';
import { ChangeRequestsSqliteRepository } from '../repositories';

describe('ChangeRequestsSqliteRepository', () => {
  const logger = new Logger('ChangeRequestsSqliteRepositoryTest', 'CRITICAL');
  const timeZoneProvider = new TimeZoneProvider('UTC');
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  function createConfiguration(): Configuration {
    tempDir = mkdtempSync(join(tmpdir(), 'smm-change-requests-sqlite-'));

    return new Configuration({
      storeData: tempDir,
      gitProvider: 'github',
      githubRepository: 'owner/repo',
      internal: { storageType: 'sqlite' },
    });
  }

  async function seedChangeRequests(
    config: Configuration,
    changeRequests: PullRequestJsonResponse[],
    comments: PullRequestCommentJsonResponse[]
  ): Promise<void> {
    await new SqliteRepository<PullRequestJsonResponse>(
      RepositoryFactory.getSqliteDatabasePath(config),
      RepositoryFactory.getSqliteNamespace(`${config.getPathFromGitProvider()}/prs.json`, config),
      logger
    ).saveAll(changeRequests);
    await new SqliteRepository<PullRequestCommentJsonResponse>(
      RepositoryFactory.getSqliteDatabasePath(config),
      RepositoryFactory.getSqliteNamespace(
        `${config.getPathFromGitProvider()}/pr-comments.json`,
        config
      ),
      logger
    ).saveAll(comments);
  }

  it('loads only SQL-filtered change requests and comments for the selected change request numbers', async () => {
    const config = createConfiguration();
    await seedChangeRequests(
      config,
      [
        new PullRequestJsonResponseBuilder()
          .withId('1')
          .withNumber('1')
          .withAuthor('alice')
          .withCreatedAt('2026-01-10T10:00:00Z')
          .build(),
        new PullRequestJsonResponseBuilder()
          .withId('2')
          .withNumber('2')
          .withAuthor('bob')
          .withCreatedAt('2026-01-10T10:00:00Z')
          .build(),
        new PullRequestJsonResponseBuilder()
          .withId('3')
          .withNumber('10')
          .withAuthor('alice')
          .withCreatedAt('2025-12-31T10:00:00Z')
          .build(),
      ],
      [
        new PullRequestCommentJsonResponseBuilder()
          .withId(101)
          .withAuthor('reviewer')
          .withPullRequestUrl('https://api.github.com/repos/owner/repo/pulls/1')
          .build(),
        new PullRequestCommentJsonResponseBuilder()
          .withId(102)
          .withAuthor('bot')
          .withPullRequestUrl('https://api.github.com/repos/owner/repo/pulls/1')
          .build(),
        new PullRequestCommentJsonResponseBuilder()
          .withId(201)
          .withAuthor('reviewer')
          .withPullRequestUrl('https://api.github.com/repos/owner/repo/pulls/2')
          .build(),
        new PullRequestCommentJsonResponseBuilder()
          .withId(1001)
          .withAuthor('reviewer')
          .withPullRequestUrl('https://api.github.com/repos/owner/repo/pulls/10')
          .build(),
      ]
    );

    const repository = new ChangeRequestsSqliteRepository(config, timeZoneProvider);
    const changeRequests = await repository.loadChangeRequestsWithFilters({
      startDate: '2026-01-01',
      authors: ['alice'],
      excludeCommenters: ['bot'],
    });

    expect(changeRequests.map((changeRequest) => changeRequest.number)).toEqual([1]);
    expect(changeRequests[0].comments.map((comment) => comment.id)).toEqual([101]);
  });

  it('is created by the change request factory when storage is sqlite', () => {
    const config = createConfiguration();

    expect(ChangeRequestFactory.create(config, logger, timeZoneProvider)).toBeInstanceOf(
      ChangeRequestsSqliteRepository
    );
  });
});
