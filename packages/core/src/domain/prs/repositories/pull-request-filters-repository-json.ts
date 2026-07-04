import { IRepository } from '../../../infrastructure';
import {
  PullRequestCommentJsonResponse,
  PullRequestJsonResponse,
} from '../../../providers/github/github-response-types';

export type PullRequestFilterOptions = {
  authors: string[];
  labels: string[];
};

export type PullRequestFilterOptionsResult = PullRequestFilterOptions & {
  commenters: string[];
};

export class PullRequestFiltersRepository {
  constructor(
    private pullRequestsJsonRepository: IRepository<PullRequestJsonResponse>,
    private pullRequestCommentsJsonRepository: IRepository<PullRequestCommentJsonResponse>,
    private pullRequestFiltersJsonRepository: IRepository<PullRequestFilterOptions>
  ) {}

  async loadOptions(): Promise<PullRequestFilterOptionsResult> {
    const cachedOptions =
      (await this.pullRequestFiltersJsonRepository.load()) || (await this.refreshOptions());
    return {
      ...cachedOptions,
      commenters: await this.loadCommenterOptions(),
    };
  }

  async refreshOptions(): Promise<PullRequestFilterOptions> {
    const prs = await this.pullRequestsJsonRepository.loadAll();
    const authors = new Set<string>();
    const labels = new Set<string>();

    for (const pr of prs) {
      this.addValue(authors, pr.user?.login);

      for (const label of pr.labels || []) {
        this.addValue(labels, label.name);
      }
    }

    const options = {
      authors: this.sortedValues(authors),
      labels: this.sortedValues(labels),
    };

    await this.pullRequestFiltersJsonRepository.save(options);
    return options;
  }

  private async loadCommenterOptions(): Promise<string[]> {
    const comments = await this.pullRequestCommentsJsonRepository.loadAll();
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
