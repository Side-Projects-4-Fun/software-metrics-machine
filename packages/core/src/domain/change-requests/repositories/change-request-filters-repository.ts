import type { IRepository } from '../../../infrastructure';
import type {
  PullRequestCommentJsonResponse,
  PullRequestJsonResponse,
} from '../../../providers/github/github-response-types';

export type ChangeRequestFilterOptions = {
  authors: string[];
  labels: string[];
};

export type ChangeRequestFilterOptionsResult = ChangeRequestFilterOptions & {
  commenters: string[];
};

export class ChangeRequestFiltersRepository {
  constructor(
    private changeRequestsRepository: IRepository<PullRequestJsonResponse>,
    private changeRequestCommentsRepository: IRepository<PullRequestCommentJsonResponse>,
    private changeRequestFilterOptionsRepository: IRepository<ChangeRequestFilterOptions>
  ) {}

  async loadOptions(): Promise<ChangeRequestFilterOptionsResult> {
    const cachedOptions =
      (await this.changeRequestFilterOptionsRepository.load()) || (await this.refreshOptions());
    return {
      ...cachedOptions,
      commenters: await this.loadCommenterOptions(),
    };
  }

  async refreshOptions(): Promise<ChangeRequestFilterOptions> {
    const changeRequests = await this.changeRequestsRepository.loadAll();
    const authors = new Set<string>();
    const labels = new Set<string>();

    for (const changeRequest of changeRequests) {
      this.addValue(authors, changeRequest.user?.login);

      for (const label of changeRequest.labels || []) {
        this.addValue(labels, label.name);
      }
    }

    const options = {
      authors: this.sortedValues(authors),
      labels: this.sortedValues(labels),
    };

    await this.changeRequestFilterOptionsRepository.save(options);
    return options;
  }

  private async loadCommenterOptions(): Promise<string[]> {
    const comments = await this.changeRequestCommentsRepository.loadAll();
    const commenters = new Set<string>();

    for (const comment of comments) {
      this.addValue(commenters, comment.user?.login);
    }

    return this.sortedValues(commenters);
  }

  private addValue(target: Set<string>, value?: string | null): void {
    const normalized = (value || '').trim();
    if (normalized) {
      target.add(normalized);
    }
  }

  private sortedValues(values: Set<string>): string[] {
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }
}
