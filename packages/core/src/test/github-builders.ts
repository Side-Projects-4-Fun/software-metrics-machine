import {
  PullRequestCommentJsonResponse,
  PullRequestJsonResponse,
  PullRequestLabelJsonResponse,
  WorkflowJobJsonResponse,
  WorkflowJsonResponse,
} from '../providers/github/github-response-types';

/**
 * Builder for creating mock PullRequestJsonResponse objects (GitHub API response).
 * Replaces ad-hoc createPullRequest() helpers across multiple test files.
 *
 * Usage:
 *   new PullRequestJsonResponseBuilder()
 *     .withAuthor('alice')
 *     .withLabels([{ ... }])
 *     .build()
 */
export class PullRequestJsonResponseBuilder {
  private data: PullRequestJsonResponse = {
    url: '',
    id: '1',
    node_id: '',
    html_url: '',
    diff_url: '',
    patch_url: '',
    issue_url: '',
    number: '1',
    state: 'open',
    locked: false,
    title: 'Test PR',
    body: '',
    created_at: '2026-05-10T00:00:00Z',
    updated_at: '2026-05-10T00:00:00Z',
    closed_at: '',
    merged_at: '',
    labels: [],
    user: {
      login: 'alice',
      id: 1,
      node_id: '',
      avatar_url: '',
      gravatar_id: '',
      url: '',
      html_url: '',
      followers_url: '',
      following_url: '',
      gists_url: '',
      starred_url: '',
      subscriptions_url: '',
      organizations_url: '',
      repos_url: '',
      events_url: '',
      received_events_url: '',
      type: 'User',
      user_view_type: '',
      site_admin: false,
    },
  };

  withId(id: string): this {
    this.data.id = id;
    return this;
  }

  withNumber(number: string): this {
    this.data.number = number;
    return this;
  }

  withTitle(title: string): this {
    this.data.title = title;
    return this;
  }

  withState(state: string): this {
    this.data.state = state;
    return this;
  }

  withAuthor(login: string, id: number = 1): this {
    this.data.user = {
      ...this.data.user!,
      login,
      id,
    };
    return this;
  }

  withCreatedAt(date: string): this {
    this.data.created_at = date;
    return this;
  }

  withUpdatedAt(date: string): this {
    this.data.updated_at = date;
    return this;
  }

  withMergedAt(date: string): this {
    this.data.merged_at = date;
    this.data.state = 'closed';
    return this;
  }

  withClosedAt(date: string): this {
    this.data.closed_at = date;
    this.data.state = 'closed';
    return this;
  }

  withBody(body: string): this {
    this.data.body = body;
    return this;
  }

  withLabels(labels: PullRequestLabelJsonResponse[]): this {
    this.data.labels = labels;
    return this;
  }

  withUrl(url: string): this {
    this.data.html_url = url;
    return this;
  }

  build(): PullRequestJsonResponse {
    return { ...this.data };
  }
}

/**
 * Builder for creating mock PullRequestCommentJsonResponse objects (GitHub API response).
 */
export class PullRequestCommentJsonResponseBuilder {
  private data: PullRequestCommentJsonResponse = {
    url: '',
    pull_request_review_id: 1,
    id: 1,
    node_id: '',
    diff_hunk: '',
    path: '',
    commit_id: '',
    original_commit_id: '',
    user: {
      login: 'reviewer',
      id: 1,
    },
    body: 'Looks good',
    created_at: '2026-05-10T00:00:00Z',
    updated_at: '2026-05-10T00:00:00Z',
    html_url: '',
    pull_request_url: '',
    reactions: {
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
    },
  };

  withId(id: number): this {
    this.data.id = id;
    return this;
  }

  withBody(body: string): this {
    this.data.body = body;
    return this;
  }

  withPath(path: string): this {
    this.data.path = path;
    return this;
  }

  withAuthor(login: string, id: number = 1): this {
    this.data.user = { ...this.data.user!, login, id };
    return this;
  }

  withCreatedAt(date: string): this {
    this.data.created_at = date;
    return this;
  }

  withUpdatedAt(date: string): this {
    this.data.updated_at = date;
    return this;
  }

  withHtmlUrl(url: string): this {
    this.data.html_url = url;
    return this;
  }

  withPullRequestUrl(url: string): this {
    this.data.pull_request_url = url;
    return this;
  }

  withReviewId(reviewId: number): this {
    this.data.pull_request_review_id = reviewId;
    return this;
  }

  build(): PullRequestCommentJsonResponse {
    return { ...this.data };
  }
}

/**
 * Builder for creating GitHub workflow run API responses.
 */
export class PipelineGitHubRunBuilder {
  private data: WorkflowJsonResponse = {
    id: 'run-1',
    run_number: '1',
    name: 'CI',
    status: 'completed',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    run_started_at: new Date().toISOString(),
    head_branch: 'main',
    head_sha: '1mna9sd',
    path: '.github/workflows/ci.yml',
    check_suite_id: '',
    check_suite_node_id: '',
    conclusion: '',
    display_title: '',
    event: '',
    html_url: '',
    node_id: '',
    run_attempt: '',
    url: '',
    workflow_id: '',
  };

  id(value: string): PipelineGitHubRunBuilder {
    this.data.id = value;
    return this;
  }

  number(value: string): PipelineGitHubRunBuilder {
    this.data.run_number = value;
    return this;
  }

  name(value: string): PipelineGitHubRunBuilder {
    this.data.name = value;
    return this;
  }

  status(value: string): PipelineGitHubRunBuilder {
    this.data.status = value;
    return this;
  }

  conclusion(value: string): PipelineGitHubRunBuilder {
    this.data.conclusion = value;
    return this;
  }

  event(value: string): PipelineGitHubRunBuilder {
    this.data.event = value;
    return this;
  }

  createdAt(value: string): PipelineGitHubRunBuilder {
    this.data.created_at = value;
    return this;
  }

  updatedAt(value: string): PipelineGitHubRunBuilder {
    this.data.updated_at = value;
    return this;
  }

  startedAt(value: string): PipelineGitHubRunBuilder {
    this.data.run_started_at = value;
    return this;
  }

  branch(value: string): PipelineGitHubRunBuilder {
    this.data.head_branch = value;
    return this;
  }

  commit(value: string): PipelineGitHubRunBuilder {
    this.data.head_sha = value;
    return this;
  }

  path(value: string): PipelineGitHubRunBuilder {
    this.data.path = value;
    return this;
  }

  build(): WorkflowJsonResponse {
    return { ...this.data };
  }
}

/**
 * Builder for creating GitHub workflow job API responses.
 */
export class PipelineGitHubJobBuilder {
  private data: WorkflowJobJsonResponse = {
    created_at: '',
    head_branch: '',
    head_sha: '',
    html_url: '',
    node_id: '',
    run_attempt: '',
    run_url: '',
    url: '',
    workflow_name: '',
    id: 'job-1',
    run_id: 'run-1',
    name: 'build',
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    conclusion: 'success',
    status: 'completed',
  };

  id(value: string): PipelineGitHubJobBuilder {
    this.data.id = value;
    return this;
  }

  runId(value: string): PipelineGitHubJobBuilder {
    this.data.run_id = value;
    return this;
  }

  name(value: string): PipelineGitHubJobBuilder {
    this.data.name = value;
    return this;
  }

  startedAt(value: string): PipelineGitHubJobBuilder {
    this.data.started_at = value;
    return this;
  }

  completedAt(value: string): PipelineGitHubJobBuilder {
    this.data.completed_at = value;
    return this;
  }

  conclusion(value: string): PipelineGitHubJobBuilder {
    this.data.conclusion = value;
    return this;
  }

  status(value: string): PipelineGitHubJobBuilder {
    this.data.status = value;
    return this;
  }

  build(): WorkflowJobJsonResponse {
    return { ...this.data };
  }
}
