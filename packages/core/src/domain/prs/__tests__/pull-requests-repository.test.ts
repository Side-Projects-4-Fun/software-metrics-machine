import { describe, expect, it, vi } from 'vitest';
import { PullRequestsRepository } from '../../../domain';
import {
  PullRequestJsonResponseBuilder,
  PullRequestCommentJsonResponseBuilder,
} from '../../../test/builders';
import { TimeZoneProvider } from '../../../infrastructure/timezone-provider';

const timeZoneProvider = new TimeZoneProvider('UTC');

describe('PullRequestsRepository filters', () => {
  it('excludes PR authors from loaded results', async () => {
    const repository = new PullRequestsRepository(
      {
        loadAll: vi
          .fn()
          .mockResolvedValue([
            new PullRequestJsonResponseBuilder()
              .withId('1')
              .withNumber('1')
              .withAuthor('alice')
              .build(),
            new PullRequestJsonResponseBuilder()
              .withId('2')
              .withNumber('2')
              .withAuthor('bot')
              .build(),
          ]),
      } as any,
      { loadAll: vi.fn().mockResolvedValue([]) } as any,
      timeZoneProvider
    );

    const prs = await repository.loadPrsWithFilters({ excludeAuthors: ['bot'] });

    expect(prs.map((pr) => pr.author.login)).toEqual(['alice']);
  });

  it('excludes commenters from PR comments without removing the PR', async () => {
    const repository = new PullRequestsRepository(
      {
        loadAll: vi
          .fn()
          .mockResolvedValue([
            new PullRequestJsonResponseBuilder().withId('1').withAuthor('alice').build(),
          ]),
      } as any,
      {
        loadAll: vi
          .fn()
          .mockResolvedValue([
            new PullRequestCommentJsonResponseBuilder()
              .withId(1)
              .withReviewId(1)
              .withAuthor('reviewer')
              .withPullRequestUrl('https://api.github.com/repos/acme/app/pulls/1')
              .build(),
            new PullRequestCommentJsonResponseBuilder()
              .withId(2)
              .withReviewId(2)
              .withAuthor('bot')
              .withPullRequestUrl('https://api.github.com/repos/acme/app/pulls/1')
              .build(),
          ]),
      } as any,
      timeZoneProvider
    );

    const prs = await repository.loadPrsWithFilters({ excludeCommenters: ['bot'] });

    expect(prs).toHaveLength(1);
    expect(prs[0].totalComments).toBe(1);
    expect(prs[0].comments.map((comment) => comment.author.login)).toEqual(['reviewer']);
  });

  it('applies raw filters as a final generic filter over loaded pull requests', async () => {
    const repository = new PullRequestsRepository(
      {
        loadAll: vi
          .fn()
          .mockResolvedValue([
            new PullRequestJsonResponseBuilder()
              .withId('1')
              .withNumber('1')
              .withAuthor('alice')
              .withTitle('Keep this PR')
              .build(),
            new PullRequestJsonResponseBuilder()
              .withId('2')
              .withNumber('2')
              .withAuthor('bob')
              .withTitle('Ignore this PR')
              .build(),
          ]),
      } as any,
      { loadAll: vi.fn().mockResolvedValue([]) } as any,
      timeZoneProvider
    );

    const prs = await repository.loadPrsWithFilters({
      rawFilters: 'author.login=alice,bob|title=Keep this PR',
    });

    expect(prs.map((pr) => pr.number)).toEqual([1]);
  });

  it('excludes PRs created before the startDate', async () => {
    const repository = new PullRequestsRepository(
      {
        loadAll: vi
          .fn()
          .mockResolvedValue([
            new PullRequestJsonResponseBuilder()
              .withId('1')
              .withNumber('1')
              .withCreatedAt('2026-01-01T00:00:00Z')
              .build(),
            new PullRequestJsonResponseBuilder()
              .withId('2')
              .withNumber('2')
              .withCreatedAt('2026-02-01T00:00:00Z')
              .build(),
          ]),
      } as any,
      { loadAll: vi.fn().mockResolvedValue([]) } as any,
      timeZoneProvider
    );

    const prs = await repository.loadPrsWithFilters({ startDate: '2026-01-15' });

    expect(prs.map((pr) => pr.number)).toEqual([2]);
  });

  it('excludes PRs created after the endDate', async () => {
    const repository = new PullRequestsRepository(
      {
        loadAll: vi
          .fn()
          .mockResolvedValue([
            new PullRequestJsonResponseBuilder()
              .withId('1')
              .withNumber('1')
              .withCreatedAt('2026-01-01T00:00:00Z')
              .build(),
            new PullRequestJsonResponseBuilder()
              .withId('2')
              .withNumber('2')
              .withCreatedAt('2026-02-01T00:00:00Z')
              .build(),
          ]),
      } as any,
      { loadAll: vi.fn().mockResolvedValue([]) } as any,
      timeZoneProvider
    );

    const prs = await repository.loadPrsWithFilters({ endDate: '2026-01-15' });

    expect(prs.map((pr) => pr.number)).toEqual([1]);
  });

  it('includes PRs created within both the startDate and endDate bounds', async () => {
    const repository = new PullRequestsRepository(
      {
        loadAll: vi
          .fn()
          .mockResolvedValue([
            new PullRequestJsonResponseBuilder()
              .withId('1')
              .withNumber('1')
              .withCreatedAt('2026-01-01T00:00:00Z')
              .build(),
            new PullRequestJsonResponseBuilder()
              .withId('2')
              .withNumber('2')
              .withCreatedAt('2026-01-15T00:00:00Z')
              .build(),
            new PullRequestJsonResponseBuilder()
              .withId('3')
              .withNumber('3')
              .withCreatedAt('2026-02-01T00:00:00Z')
              .build(),
          ]),
      } as any,
      { loadAll: vi.fn().mockResolvedValue([]) } as any,
      timeZoneProvider
    );

    const prs = await repository.loadPrsWithFilters({
      startDate: '2026-01-10',
      endDate: '2026-01-20',
    });

    expect(prs.map((pr) => pr.number)).toEqual([2]);
  });

  it('excludes weekend PRs when cleaning.weekends is set to exclude', async () => {
    const repository = new PullRequestsRepository(
      {
        loadAll: vi.fn().mockResolvedValue([
          new PullRequestJsonResponseBuilder()
            .withId('1')
            .withNumber('1')
            .withCreatedAt('2026-06-06T10:00:00Z')
            .build(),
          new PullRequestJsonResponseBuilder()
            .withId('2')
            .withNumber('2')
            .withCreatedAt('2026-06-08T10:00:00Z')
            .build(),
        ]),
      } as any,
      { loadAll: vi.fn().mockResolvedValue([]) } as any,
      timeZoneProvider
    );

    const prs = await repository.loadPrsWithFilters({
      cleaning: { weekends: 'exclude' },
    });

    expect(prs.map((pr) => pr.number)).toEqual([2]);
  });

  it('keeps only weekend PRs when cleaning.weekends is set to weekends_only', async () => {
    const repository = new PullRequestsRepository(
      {
        loadAll: vi.fn().mockResolvedValue([
          new PullRequestJsonResponseBuilder()
            .withId('1')
            .withNumber('1')
            .withCreatedAt('2026-06-06T10:00:00Z')
            .build(),
          new PullRequestJsonResponseBuilder()
            .withId('2')
            .withNumber('2')
            .withCreatedAt('2026-06-08T10:00:00Z')
            .build(),
        ]),
      } as any,
      { loadAll: vi.fn().mockResolvedValue([]) } as any,
      timeZoneProvider
    );

    const prs = await repository.loadPrsWithFilters({
      cleaning: { weekends: 'weekends_only' },
    });

    expect(prs.map((pr) => pr.number)).toEqual([1]);
  });

  it('keeps only PRs whose author matches the authors filter, case-insensitively', async () => {
    const repository = new PullRequestsRepository(
      {
        loadAll: vi
          .fn()
          .mockResolvedValue([
            new PullRequestJsonResponseBuilder()
              .withId('1')
              .withNumber('1')
              .withAuthor('Alice')
              .build(),
            new PullRequestJsonResponseBuilder()
              .withId('2')
              .withNumber('2')
              .withAuthor('bob')
              .build(),
          ]),
      } as any,
      { loadAll: vi.fn().mockResolvedValue([]) } as any,
      timeZoneProvider
    );

    const prs = await repository.loadPrsWithFilters({ authors: ['alice'] });

    expect(prs.map((pr) => pr.number)).toEqual([1]);
  });

  it('keeps only PRs with a label matching the labels filter, case-insensitively, excluding label-less PRs', async () => {
    const labelFixture = {
      id: 'l1',
      node_id: '',
      url: '',
      color: '',
      default: false,
      description: '',
    };

    const repository = new PullRequestsRepository(
      {
        loadAll: vi.fn().mockResolvedValue([
          new PullRequestJsonResponseBuilder()
            .withId('1')
            .withNumber('1')
            .withLabels([{ ...labelFixture, name: 'Bug' }])
            .build(),
          new PullRequestJsonResponseBuilder()
            .withId('2')
            .withNumber('2')
            .withLabels([{ ...labelFixture, name: 'enhancement' }])
            .build(),
          new PullRequestJsonResponseBuilder().withId('3').withNumber('3').withLabels([]).build(),
        ]),
      } as any,
      { loadAll: vi.fn().mockResolvedValue([]) } as any,
      timeZoneProvider
    );

    const prs = await repository.loadPrsWithFilters({ labels: ['bug'] });

    expect(prs.map((pr) => pr.number)).toEqual([1]);
  });

  it('keeps only merged PRs when filters.state is "merged"', async () => {
    const repository = new PullRequestsRepository(
      {
        loadAll: vi
          .fn()
          .mockResolvedValue([
            new PullRequestJsonResponseBuilder()
              .withId('1')
              .withNumber('1')
              .withMergedAt('2026-01-02T00:00:00Z')
              .build(),
            new PullRequestJsonResponseBuilder().withId('2').withNumber('2').build(),
          ]),
      } as any,
      { loadAll: vi.fn().mockResolvedValue([]) } as any,
      timeZoneProvider
    );

    const prs = await repository.loadPrsWithFilters({ state: 'merged' });

    expect(prs.map((pr) => pr.number)).toEqual([1]);
  });

  it('excludes a PR that is both merged and closed when filters.state is "closed"', async () => {
    const repository = new PullRequestsRepository(
      {
        loadAll: vi
          .fn()
          .mockResolvedValue([
            new PullRequestJsonResponseBuilder()
              .withId('1')
              .withNumber('1')
              .withClosedAt('2026-01-02T00:00:00Z')
              .build(),
            new PullRequestJsonResponseBuilder()
              .withId('2')
              .withNumber('2')
              .withClosedAt('2026-01-03T00:00:00Z')
              .withMergedAt('2026-01-03T00:00:00Z')
              .build(),
          ]),
      } as any,
      { loadAll: vi.fn().mockResolvedValue([]) } as any,
      timeZoneProvider
    );

    const prs = await repository.loadPrsWithFilters({ state: 'closed' });

    expect(prs.map((pr) => pr.number)).toEqual([1]);
  });

  it('keeps only PRs with neither closedAt nor mergedAt when filters.state is "open"', async () => {
    const repository = new PullRequestsRepository(
      {
        loadAll: vi
          .fn()
          .mockResolvedValue([
            new PullRequestJsonResponseBuilder().withId('1').withNumber('1').build(),
            new PullRequestJsonResponseBuilder()
              .withId('2')
              .withNumber('2')
              .withClosedAt('2026-01-03T00:00:00Z')
              .build(),
          ]),
      } as any,
      { loadAll: vi.fn().mockResolvedValue([]) } as any,
      timeZoneProvider
    );

    const prs = await repository.loadPrsWithFilters({ state: 'open' });

    expect(prs.map((pr) => pr.number)).toEqual([1]);
  });

  it('keeps only PRs with a truthy draft field when filters.state is "draft"', async () => {
    const repository = new PullRequestsRepository(
      {
        loadAll: vi.fn().mockResolvedValue([
          {
            ...new PullRequestJsonResponseBuilder().withId('1').withNumber('1').build(),
            draft: true,
          },
          new PullRequestJsonResponseBuilder().withId('2').withNumber('2').build(),
        ]),
      } as any,
      { loadAll: vi.fn().mockResolvedValue([]) } as any,
      timeZoneProvider
    );

    const prs = await repository.loadPrsWithFilters({ state: 'draft' });

    expect(prs.map((pr) => pr.number)).toEqual([1]);
  });

  it('returns all cached PRs mapped, unfiltered, when no filters argument is passed', async () => {
    const repository = new PullRequestsRepository(
      {
        loadAll: vi
          .fn()
          .mockResolvedValue([
            new PullRequestJsonResponseBuilder().withId('1').withNumber('1').build(),
            new PullRequestJsonResponseBuilder().withId('2').withNumber('2').build(),
          ]),
      } as any,
      { loadAll: vi.fn().mockResolvedValue([]) } as any,
      timeZoneProvider
    );

    const prs = await repository.loadPrsWithFilters();

    expect(prs.map((pr) => pr.number)).toEqual([1, 2]);
  });

  it('falls back to defaults when body, merged_at, closed_at, user, labels and html_url are missing', async () => {
    const prWithoutOptionalFields = new PullRequestJsonResponseBuilder()
      .withId('1')
      .withNumber('1')
      .build();
    delete (prWithoutOptionalFields as Partial<typeof prWithoutOptionalFields>).body;
    delete (prWithoutOptionalFields as Partial<typeof prWithoutOptionalFields>).merged_at;
    delete (prWithoutOptionalFields as Partial<typeof prWithoutOptionalFields>).closed_at;
    delete (prWithoutOptionalFields as Partial<typeof prWithoutOptionalFields>).user;
    delete (prWithoutOptionalFields as Partial<typeof prWithoutOptionalFields>).labels;
    delete (prWithoutOptionalFields as Partial<typeof prWithoutOptionalFields>).html_url;

    const repository = new PullRequestsRepository(
      { loadAll: vi.fn().mockResolvedValue([prWithoutOptionalFields]) } as any,
      { loadAll: vi.fn().mockResolvedValue([]) } as any,
      timeZoneProvider
    );

    const prs = await repository.loadPrsWithFilters();

    expect(prs).toHaveLength(1);
    expect(prs[0].description).toBe('');
    expect(prs[0].mergedAt).toBeUndefined();
    expect(prs[0].closedAt).toBeUndefined();
    expect(prs[0].author).toEqual({ login: 'unknown', id: 0 });
    expect(prs[0].labels).toEqual([]);
    expect(prs[0].url).toBe('');
  });

  it('falls back to defaults when a comment has no pull_request_review_id, user or reactions', async () => {
    const pr = new PullRequestJsonResponseBuilder().withId('1').withNumber('1').build();

    const comment = new PullRequestCommentJsonResponseBuilder()
      .withId(1)
      .withPullRequestUrl(`https://api.github.com/repos/acme/app/pulls/${pr.number}`)
      .build();
    const commentWithoutOptionalFields = { ...comment };
    delete (commentWithoutOptionalFields as Partial<typeof commentWithoutOptionalFields>)
      .pull_request_review_id;
    delete (commentWithoutOptionalFields as Partial<typeof commentWithoutOptionalFields>).user;
    delete (commentWithoutOptionalFields as Partial<typeof commentWithoutOptionalFields>).reactions;

    const repository = new PullRequestsRepository(
      { loadAll: vi.fn().mockResolvedValue([pr]) } as any,
      { loadAll: vi.fn().mockResolvedValue([commentWithoutOptionalFields]) } as any,
      timeZoneProvider
    );

    const prs = await repository.loadPrsWithFilters();

    expect(prs).toHaveLength(1);
    const [mappedComment] = prs[0].comments;
    expect(mappedComment.pull_request_review_id).toBe(0);
    expect(mappedComment.author).toEqual({ login: 'unknown', id: 0 });
    expect(mappedComment.reactions).toEqual({
      url: '',
      total_count: 0,
      '+1': 0,
      '-1': 0,
      laugh: 0,
      hooray: 0,
      confused: 0,
      heart: 0,
      rocket: 0,
      eyes: 0,
    });
  });
});
