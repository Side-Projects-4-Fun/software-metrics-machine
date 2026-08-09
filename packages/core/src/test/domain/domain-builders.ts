import type { Commit, CodeChange } from '../../domain-types';
import type {
  PipelineJob,
  PipelineRun,
  PipelineStep,
  ChangeRequestComment,
  ChangeRequestDetails,
  ChangeRequestLabel,
} from '../../index';

/**
 * Builder for creating mock Commit objects
 */
export class CommitBuilder {
  private commit: Commit = {
    author: 'Test Author',
    msg: 'Test commit message',
    hash: 'abc123def456',
    timestamp: new Date().toISOString(),
    files: [],
  };

  withAuthor(author: string): CommitBuilder {
    this.commit.author = author;
    return this;
  }

  withEmail(email: string): CommitBuilder {
    this.commit.email = email;
    return this;
  }

  withMessage(msg: string): CommitBuilder {
    this.commit.msg = msg;
    return this;
  }

  withHash(hash: string): CommitBuilder {
    this.commit.hash = hash;
    return this;
  }

  withTimestamp(timestamp: string | Date): CommitBuilder {
    this.commit.timestamp = timestamp;
    return this;
  }

  withSubject(subject: string): CommitBuilder {
    this.commit.subject = subject;
    return this;
  }

  withCoAuthors(coAuthors: string[]): CommitBuilder {
    this.commit.coAuthors = coAuthors;
    return this;
  }

  withFiles(files: CodeChange[]): CommitBuilder {
    this.commit.files = files;
    return this;
  }

  build(): Commit {
    return { ...this.commit };
  }
}

/**
 * Builder for creating mock change request objects
 */
export class ChangeRequestBuilder {
  private changeRequest: ChangeRequestDetails = {
    id: 1,
    number: 1,
    title: 'Test Change Request',
    author: { login: 'Test Author', id: 1 },
    url: 'https://github.com/example/pr/1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    state: 'open',
    labels: [],
    comments: [],
    totalComments: 0,
  };

  withId(id: number | undefined): ChangeRequestBuilder {
    this.changeRequest.id = id as number;
    return this;
  }

  withNumber(number: number): ChangeRequestBuilder {
    this.changeRequest.number = number;
    return this;
  }

  withTitle(title: string | undefined): ChangeRequestBuilder {
    this.changeRequest.title = title as string;
    return this;
  }

  withAuthor(author: string, id: number = 1): ChangeRequestBuilder {
    this.changeRequest.author = { login: author, id };
    return this;
  }

  withoutAuthor(): ChangeRequestBuilder {
    this.changeRequest.author = { login: 'builder-1', id: 1 };
    return this;
  }

  withState(state: 'open' | 'closed' | 'merged' | 'draft'): ChangeRequestBuilder {
    this.changeRequest.state = state;
    return this;
  }

  withCreatedAt(createdAt: string): ChangeRequestBuilder {
    this.changeRequest.createdAt = createdAt;
    return this;
  }

  withUpdatedAt(updatedAt: string): ChangeRequestBuilder {
    this.changeRequest.updatedAt = updatedAt;
    return this;
  }

  withMergedAt(mergedAt: string): ChangeRequestBuilder {
    this.changeRequest.mergedAt = mergedAt;
    this.changeRequest.state = 'merged';
    return this;
  }

  withClosedAt(closedAt: string): ChangeRequestBuilder {
    this.changeRequest.closedAt = closedAt;
    this.changeRequest.state = 'closed';
    return this;
  }

  withComments(comments: number | ChangeRequestComment[]): ChangeRequestBuilder {
    if (typeof comments === 'number') {
      this.changeRequest.totalComments = comments;
      return this;
    }

    this.changeRequest.totalComments = comments.length;
    this.changeRequest.comments = comments;
    return this;
  }

  withCommentDetails(comments: Array<Partial<ChangeRequestComment>>): ChangeRequestBuilder {
    this.changeRequest.comments = comments.map((comment, index) => ({
      url: comment.url ?? `https://example.test/comments/${index + 1}`,
      body: comment.body ?? '',
      change_request_review_id: comment.change_request_review_id ?? 0,
      id: comment.id ?? index + 1,
      createdAt: comment.createdAt ?? new Date().toISOString(),
      author: comment.author ?? { login: `user-${index + 1}`, id: index + 1 },
      reactions: comment.reactions ?? {
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
    }));
    this.changeRequest.totalComments = this.changeRequest.comments.length;
    return this;
  }

  withLabels(labels: Array<Partial<ChangeRequestLabel>> | undefined): ChangeRequestBuilder {
    this.changeRequest.labels = (labels?.map((label) => ({
      name: label.name ?? '',
    })) ?? []) as ChangeRequestLabel[];
    return this;
  }

  withUrl(url: string | undefined): ChangeRequestBuilder {
    this.changeRequest.url = url as string;
    return this;
  }

  build(): ChangeRequestDetails {
    return { ...this.changeRequest };
  }
}

/**
 * Builder for creating mock PipelineRun objects
 */
export class PipelineRunBuilder {
  private run: PipelineRun = {
    id: 'run-1',
    runAttempt: 1,
    number: 1,
    name: 'Build',
    status: 'completed',
    conclusion: 'success',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    branch: 'main',
    commit: 'abc123',
    path: '.github/workflows/build.yml',
    jobs: [],
  };

  withId(id: string): PipelineRunBuilder {
    this.run.id = id;
    return this;
  }

  withNumber(number: number): PipelineRunBuilder {
    this.run.number = number;
    return this;
  }

  withName(name: string): PipelineRunBuilder {
    this.run.name = name;
    return this;
  }

  withStatus(status: string): PipelineRunBuilder {
    this.run.status = status;
    return this;
  }

  withConclusion(conclusion: string): PipelineRunBuilder {
    this.run.conclusion = conclusion;
    return this;
  }

  withBranch(branch: string): PipelineRunBuilder {
    this.run.branch = branch;
    return this;
  }

  withCommit(commit: string): PipelineRunBuilder {
    this.run.commit = commit;
    return this;
  }

  withCreatedAt(createdAt: string): PipelineRunBuilder {
    this.run.createdAt = createdAt;
    return this;
  }

  withStartedAt(startedAt: string | undefined): PipelineRunBuilder {
    this.run.startedAt = startedAt;
    return this;
  }

  withCompletedAt(completedAt: string | undefined): PipelineRunBuilder {
    this.run.completedAt = completedAt;
    return this;
  }

  withUpdatedAt(updatedAt: string): PipelineRunBuilder {
    this.run.updatedAt = updatedAt;
    return this;
  }

  withRunAttempt(runAttempt: number | undefined): PipelineRunBuilder {
    this.run.runAttempt = runAttempt;
    return this;
  }

  withPath(path: string): PipelineRunBuilder {
    this.run.path = path;
    return this;
  }

  withJobs(jobs: PipelineJob[] | undefined): PipelineRunBuilder {
    this.run.jobs = jobs;
    return this;
  }

  withDuration(seconds: number): PipelineRunBuilder {
    const startDate = new Date(this.run.startedAt || this.run.createdAt);
    this.run.completedAt = new Date(startDate.getTime() + seconds * 1000).toISOString();
    return this;
  }

  build(): PipelineRun {
    return { ...this.run };
  }
}

/**
 * Builder for creating mock PipelineJob objects
 */
export class PipelineJobBuilder {
  private job: PipelineJob = {
    id: 'job-1',
    runId: 'run-1',
    name: 'test',
    status: 'completed',
    conclusion: 'success',
    startedAt: '2025-01-01T08:00:00Z',
    completedAt: '2025-01-01T08:05:00Z',
  };

  withId(id: string): PipelineJobBuilder {
    this.job.id = id;
    return this;
  }

  withName(name: string): PipelineJobBuilder {
    this.job.name = name;
    return this;
  }

  withStatus(status: string): PipelineJobBuilder {
    this.job.status = status;
    return this;
  }

  withConclusion(conclusion: string): PipelineJobBuilder {
    this.job.conclusion = conclusion;
    return this;
  }

  withStartedAt(startedAt: string): PipelineJobBuilder {
    this.job.startedAt = startedAt;
    return this;
  }

  withCompletedAt(completedAt: string | undefined): PipelineJobBuilder {
    this.job.completedAt = completedAt;
    return this;
  }

  withSteps(steps: PipelineStep[] | undefined): PipelineJobBuilder {
    this.job.steps = steps;
    return this;
  }

  build(): PipelineJob {
    return { ...this.job };
  }
}

/**
 * Builder for creating mock PipelineStep objects
 */
export class PipelineStepBuilder {
  private step: PipelineStep = {
    name: 'checkout',
    status: 'completed',
    conclusion: 'success',
    number: 1,
    startedAt: '2025-01-01T08:00:00Z',
    completedAt: '2025-01-01T08:05:00Z',
  };

  withName(name: string | undefined): PipelineStepBuilder {
    this.step.name = name as string;
    return this;
  }

  withNumber(number: number): PipelineStepBuilder {
    this.step.number = number;
    return this;
  }

  withStartedAt(startedAt: string | undefined): PipelineStepBuilder {
    this.step.startedAt = startedAt;
    return this;
  }

  withCompletedAt(completedAt: string | undefined): PipelineStepBuilder {
    this.step.completedAt = completedAt;
    return this;
  }

  build(): PipelineStep {
    return { ...this.step };
  }
}

/**
 * Factory for creating test data collections
 */
export class TestDataFactory {
  static createCommits(count: number): Commit[] {
    const commits: Commit[] = [];
    for (let i = 0; i < count; i++) {
      commits.push(
        new CommitBuilder()
          .withHash(`commit${i}`)
          .withAuthor(`author${i % 3}`)
          .withMessage(`Commit message ${i}`)
          .build()
      );
    }
    return commits;
  }

  static createChangeRequests(count: number): ChangeRequestDetails[] {
    const changeRequests: ChangeRequestDetails[] = [];
    for (let i = 0; i < count; i++) {
      changeRequests.push(
        new ChangeRequestBuilder()
          .withNumber(i + 1)
          .withAuthor(`author${i % 3}`)
          .withTitle(`Change request: Feature ${i}`)
          .build()
      );
    }
    return changeRequests;
  }

  static createPipelineRuns(count: number): PipelineRun[] {
    const runs: PipelineRun[] = [];
    for (let i = 0; i < count; i++) {
      runs.push(
        new PipelineRunBuilder()
          .withNumber(i + 1)
          .withCommit(`commit${i}`)
          .withDuration((crypto.getRandomValues(new Uint32Array(1))[0] / 0xffffffff) * 3600)
          .build()
      );
    }
    return runs;
  }
}
