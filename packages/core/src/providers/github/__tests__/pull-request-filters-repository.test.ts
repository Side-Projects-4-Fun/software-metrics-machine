import { describe, expect, it } from 'vitest';
import { PullRequestFilterOptions, PullRequestFiltersRepository } from '../../..';
import { PullRequestCommentJsonResponse, PullRequestJsonResponse } from '../github-response-types';
import { InMemoryRepository } from '../../../test/repositories/in-memory-repository';
import {
  PullRequestJsonResponseBuilder,
  PullRequestCommentJsonResponseBuilder,
} from '../../../test/github/github-builders';

describe('PullRequestFiltersRepository', () => {
  it('loads distinct filter options from cached pull requests', async () => {
    const pullRequestRepository = new InMemoryRepository<PullRequestJsonResponse>();
    const pullRequestCommentsRepository = new InMemoryRepository<PullRequestCommentJsonResponse>();
    const filterOptionsRepository = new InMemoryRepository<PullRequestFilterOptions>();
    await pullRequestRepository.saveAll([
      new PullRequestJsonResponseBuilder()
        .withId('1')
        .withAuthor('alice')
        .withTitle('Test PR')
        .withLabels([
          {
            id: '1',
            node_id: '',
            url: '',
            name: 'bug',
            color: '',
            default: false,
            description: '',
          },
        ])
        .build(),
      new PullRequestJsonResponseBuilder()
        .withId('2')
        .withAuthor('bob')
        .withTitle('Test PR')
        .withLabels([
          {
            id: '2',
            node_id: '',
            url: '',
            name: 'feature',
            color: '',
            default: false,
            description: '',
          },
          {
            id: '3',
            node_id: '',
            url: '',
            name: 'bug',
            color: '',
            default: false,
            description: '',
          },
        ])
        .build(),
    ]);
    await pullRequestCommentsRepository.saveAll([
      new PullRequestCommentJsonResponseBuilder().withId(1).withAuthor('reviewer').build(),
      new PullRequestCommentJsonResponseBuilder().withId(2).withAuthor('bot').build(),
      new PullRequestCommentJsonResponseBuilder().withId(3).withAuthor('reviewer').build(),
    ]);

    const repository = new PullRequestFiltersRepository(
      pullRequestRepository,
      pullRequestCommentsRepository,
      filterOptionsRepository
    );

    const options = await repository.loadOptions();

    expect(options).toEqual({
      authors: ['alice', 'bob'],
      commenters: ['bot', 'reviewer'],
      labels: ['bug', 'feature'],
    });
    expect(await filterOptionsRepository.load()).toEqual({
      authors: ['alice', 'bob'],
      labels: ['bug', 'feature'],
    });
  });
});
