import { describe, expect, it, vi } from 'vitest';
import { GitlabMrClient, GitlabPipelineClient, type GitlabCliRunner } from '..';
import { MockLoggerBuilder } from '../../../test/infrastructure/mock-logger-builder';

const logger = new MockLoggerBuilder().build();

function createMockRunner(responses: Record<string, string>): GitlabCliRunner {
  return vi.fn(async (args: string[]) => {
    const endpoint = args[1] || '';
    for (const [pattern, response] of Object.entries(responses)) {
      if (endpoint.includes(pattern)) {
        return response;
      }
    }
    return '[]';
  });
}

function mrResponse(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify([
    {
      id: 1001,
      iid: 7,
      title: 'Add checkout flow',
      state: 'merged',
      created_at: '2026-01-05T09:00:00Z',
      updated_at: '2026-01-07T09:00:00Z',
      merged_at: '2026-01-07T09:00:00Z',
      closed_at: null,
      web_url: 'https://gitlab.com/acme/widgets/-/merge_requests/7',
      author: { id: 501, username: 'alice', name: 'Alice' },
      labels: ['feature'],
      ...overrides,
    },
  ]);
}

function notesResponse(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify([
    {
      id: 9001,
      body: 'Please add a regression test.',
      created_at: '2026-01-05T13:00:00Z',
      updated_at: '2026-01-05T13:05:00Z',
      web_url: 'https://gitlab.com/acme/widgets/-/merge_requests/7#note_9001',
      author: { id: 601, username: 'reviewer', name: 'Reviewer' },
      ...overrides,
    },
  ]);
}

function pipelineResponse(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify([
    {
      id: 2001,
      iid: 41,
      ref: 'main',
      sha: 'abc123',
      status: 'success',
      source: 'push',
      created_at: '2026-02-03T10:00:00Z',
      updated_at: '2026-02-03T10:10:00Z',
      started_at: '2026-02-03T10:00:00Z',
      finished_at: '2026-02-03T10:10:00Z',
      web_url: 'https://gitlab.com/acme/widgets/-/pipelines/2001',
      ...overrides,
    },
  ]);
}

function pipelineDetailResponse(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    id: 2001,
    iid: 41,
    ref: 'main',
    sha: 'abc123',
    status: 'success',
    source: 'push',
    created_at: '2026-02-03T10:00:00Z',
    updated_at: '2026-02-03T10:10:00Z',
    started_at: '2026-02-03T10:00:00Z',
    finished_at: '2026-02-03T10:10:00Z',
    web_url: 'https://gitlab.com/acme/widgets/-/pipelines/2001',
    ...overrides,
  });
}

function jobsResponse(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify([
    {
      id: 5001,
      name: 'build',
      stage: 'build',
      ref: 'main',
      commit: { id: 'abc123' },
      status: 'success',
      created_at: '2026-02-03T10:00:00Z',
      started_at: '2026-02-03T10:00:00Z',
      finished_at: '2026-02-03T10:05:00Z',
      web_url: 'https://gitlab.com/acme/widgets/-/jobs/5001',
      pipeline: { id: 2001, web_url: 'https://gitlab.com/acme/widgets/-/pipelines/2001' },
      ...overrides,
    },
  ]);
}

/**
 * Helper: From a mocked runner, extract the endpoint string from the last call.
 * The runner is called as runner(['api', endpointString], env).
 */
function getEndpoint(runner: ReturnType<typeof vi.fn>): string {
  const lastCall = runner.mock.lastCall!;
  // args[0] = ['api', endpointString]
  return lastCall[0][1] || '';
}

/**
 * Helper: From a mocked runner, extract the endpoint string from a specific call index.
 */
function getEndpointAt(runner: ReturnType<typeof vi.fn>, index: number): string {
  const call = runner.mock.calls[index];
  return call[0][1] || '';
}

/**
 * Helper: From a mocked runner, extract the env from the last call.
 */
function getEnv(runner: ReturnType<typeof vi.fn>): NodeJS.ProcessEnv | undefined {
  return runner.mock.lastCall?.[1];
}

// ---------------------------------------------------------------------------
// GitlabMrClient
// ---------------------------------------------------------------------------
describe('GitlabMrClient', () => {
  const token = 'glpat-test-token';
  const projectId = 'acme/widgets';
  const encodedProjectId = encodeURIComponent(projectId);

  it('should fetch merge requests and map to pull request format', async () => {
    const runner = createMockRunner({
      [`projects/${encodedProjectId}/merge_requests`]: mrResponse(),
    });
    const client = new GitlabMrClient(token, projectId, logger, runner);

    const prs = await client.fetchPRs();

    expect(prs).toHaveLength(1);
    const pr = prs[0];
    expect(pr.id).toBe('1001');
    expect(pr.number).toBe('7');
    expect(pr.title).toBe('Add checkout flow');
    expect(pr.state).toBe('merged');
    expect(pr.user?.login).toBe('alice');
    expect(pr.labels).toHaveLength(1);
    expect(pr.labels[0].name).toBe('feature');
    expect(pr.html_url).toBe('https://gitlab.com/acme/widgets/-/merge_requests/7');
  });

  it('should map opened state to open', async () => {
    const runner = createMockRunner({
      [`projects/${encodedProjectId}/merge_requests`]: mrResponse({
        state: 'opened',
        merged_at: null,
      }),
    });
    const client = new GitlabMrClient(token, projectId, logger, runner);

    const prs = await client.fetchPRs();

    expect(prs[0].state).toBe('open');
  });

  it('should map closed state', async () => {
    const runner = createMockRunner({
      [`projects/${encodedProjectId}/merge_requests`]: mrResponse({
        state: 'closed',
        merged_at: null,
        closed_at: '2026-01-08T09:00:00Z',
      }),
    });
    const client = new GitlabMrClient(token, projectId, logger, runner);

    const prs = await client.fetchPRs();

    expect(prs[0].state).toBe('closed');
    expect(prs[0].closed_at).toBe('2026-01-08T09:00:00Z');
  });

  it('should pass state filter correctly', async () => {
    const runner = vi.fn().mockResolvedValue('[]');
    const client = new GitlabMrClient(token, projectId, logger, runner);

    await client.fetchPRs({ state: 'open' });

    expect(getEndpoint(runner)).toContain('state=opened');
  });

  it('should pass state filter as all when not specified', async () => {
    const runner = vi.fn().mockResolvedValue('[]');
    const client = new GitlabMrClient(token, projectId, logger, runner);

    await client.fetchPRs();

    expect(getEndpoint(runner)).toContain('state=all');
  });

  it('should pass date filters', async () => {
    const runner = vi.fn().mockResolvedValue('[]');
    const client = new GitlabMrClient(token, projectId, logger, runner);

    await client.fetchPRs({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });

    const endpoint = getEndpoint(runner);
    expect(endpoint).toContain('created_after=2026-01-01');
    expect(endpoint).toContain('created_before=2026-01-31');
  });

  it('should pass raw filters', async () => {
    const runner = vi.fn().mockResolvedValue('[]');
    const client = new GitlabMrClient(token, projectId, logger, runner);

    await client.fetchPRs({
      rawFilters: 'scope=all,labels=bug',
    });

    const endpoint = getEndpoint(runner);
    expect(endpoint).toContain('scope=all');
    expect(endpoint).toContain('labels=bug');
  });

  it('should paginate through merge requests', async () => {
    const fullPage = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      iid: i + 1,
      title: `MR ${i + 1}`,
      state: 'merged',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      merged_at: '2026-01-01T00:00:00Z',
      web_url: '',
      author: { id: 1, username: 'alice' },
    }));
    const partialPage = [
      {
        id: 200,
        iid: 200,
        title: 'Last MR',
        state: 'merged',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        merged_at: '2026-01-01T00:00:00Z',
        web_url: '',
        author: { id: 1, username: 'alice' },
      },
    ];

    const runner = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify(fullPage))
      .mockResolvedValueOnce(JSON.stringify(partialPage));

    const client = new GitlabMrClient(token, projectId, logger, runner);
    const prs = await client.fetchPRs();

    expect(prs).toHaveLength(101);
    expect(runner).toHaveBeenCalledTimes(2);

    expect(getEndpointAt(runner, 0)).toContain('page=1');
    expect(getEndpointAt(runner, 1)).toContain('page=2');
  });

  it('should fetch MR comments and map to pull request comment format', async () => {
    const runner = createMockRunner({
      [`projects/${encodedProjectId}/merge_requests/7/notes`]: notesResponse(),
    });
    const client = new GitlabMrClient(token, projectId, logger, runner);

    const comments = await client.fetchPRComments(7);

    expect(comments).toHaveLength(1);
    const comment = comments[0];
    expect(comment.id).toBe(9001);
    expect(comment.body).toBe('Please add a regression test.');
    expect(comment.user?.login).toBe('reviewer');
    expect(comment.created_at).toBe('2026-01-05T13:00:00Z');
  });

  it('should set GITLAB_TOKEN and GLAB_TOKEN env vars when token is provided', async () => {
    const runner = vi.fn().mockResolvedValue('[]');
    const client = new GitlabMrClient(token, projectId, logger, runner);

    await client.fetchPRs();

    const env = getEnv(runner)!;
    expect(env.GITLAB_TOKEN).toBe(token);
    expect(env.GLAB_TOKEN).toBe(token);
  });

  it('should pass process.env directly when no token is provided', async () => {
    const runner = vi.fn().mockResolvedValue('[]');
    const client = new GitlabMrClient(undefined, projectId, logger, runner);

    await client.fetchPRs();

    const env = getEnv(runner);
    expect(env).toBe(process.env);
  });

  it('should pass glab api command args', async () => {
    const runner = vi.fn().mockResolvedValue('[]');
    const client = new GitlabMrClient(token, projectId, logger, runner);

    await client.fetchPRs();

    expect(runner.mock.lastCall![0]).toEqual(['api', expect.any(String)]);
  });

  it('should handle empty author gracefully', async () => {
    const runner = createMockRunner({
      [`projects/${encodedProjectId}/merge_requests`]: mrResponse({ author: null }),
    });
    const client = new GitlabMrClient(token, projectId, logger, runner);

    const prs = await client.fetchPRs();

    expect(prs[0].user?.login).toBe('unknown');
    expect(prs[0].user?.id).toBe(0);
  });

  it('should handle missing web_url', async () => {
    const runner = createMockRunner({
      [`projects/${encodedProjectId}/merge_requests`]: mrResponse({ web_url: undefined }),
    });
    const client = new GitlabMrClient(token, projectId, logger, runner);

    const prs = await client.fetchPRs();

    expect(prs[0].html_url).toBe('');
  });

  it('should handle null description', async () => {
    const runner = createMockRunner({
      [`projects/${encodedProjectId}/merge_requests`]: mrResponse({ description: null }),
    });
    const client = new GitlabMrClient(token, projectId, logger, runner);

    const prs = await client.fetchPRs();

    expect(prs[0].body).toBe('');
  });

  it('should work with fetchMergeRequests directly', async () => {
    const runner = createMockRunner({
      [`projects/${encodedProjectId}/merge_requests`]: mrResponse(),
    });
    const client = new GitlabMrClient(token, projectId, logger, runner);

    const prs = await client.fetchMergeRequests({ state: 'merged' });

    expect(prs).toHaveLength(1);
    expect(prs[0].state).toBe('merged');
  });

  it('should include sort and order params by default', async () => {
    const runner = vi.fn().mockResolvedValue('[]');
    const client = new GitlabMrClient(token, projectId, logger, runner);

    await client.fetchPRs();

    const endpoint = getEndpoint(runner);
    expect(endpoint).toContain('order_by=created_at');
    expect(endpoint).toContain('sort=desc');
  });

  it('should pass --hostname to glab api when gitlabUrl is provided', async () => {
    const runner = vi.fn().mockResolvedValue('[]');
    const client = new GitlabMrClient(
      token,
      projectId,
      logger,
      runner,
      'https://gitlab.example.com'
    );

    await client.fetchPRs();

    const args: string[] = runner.mock.lastCall![0];
    expect(args).toEqual(['api', '--hostname', 'gitlab.example.com', expect.any(String)]);
  });

  it('should not include --hostname when gitlabUrl is not provided', async () => {
    const runner = vi.fn().mockResolvedValue('[]');
    const client = new GitlabMrClient(token, projectId, logger, runner);

    await client.fetchPRs();

    const args: string[] = runner.mock.lastCall![0];
    expect(args).toEqual(['api', expect.any(String)]);
    expect(args).not.toContain('--hostname');
  });

  it('should extract hostname from gitlabUrl with trailing path', async () => {
    const runner = vi.fn().mockResolvedValue('[]');
    const client = new GitlabMrClient(
      token,
      projectId,
      logger,
      runner,
      'https://gitlab.internal.com/group/subgroup'
    );

    await client.fetchPRs();

    const args: string[] = runner.mock.lastCall![0];
    expect(args).toEqual(['api', '--hostname', 'gitlab.internal.com', expect.any(String)]);
  });

  it('should construct correct pull_request_url using gitlabUrl for notes without web_url', async () => {
    const runner = vi.fn().mockResolvedValue(notesResponse({ web_url: undefined }));
    const client = new GitlabMrClient(
      token,
      projectId,
      logger,
      runner,
      'https://gitlab.example.com'
    );

    const comments = await client.fetchPRComments(7);

    expect(comments).toHaveLength(1);
    expect(comments[0].pull_request_url).toBe(
      'https://gitlab.example.com/acme/widgets/-/merge_requests/7'
    );
  });

  it('should default pull_request_url to gitlab.com when no gitlabUrl provided', async () => {
    const runner = createMockRunner({
      [`projects/${encodedProjectId}/merge_requests/7/notes`]: notesResponse({
        web_url: undefined,
      }),
    });
    const client = new GitlabMrClient(token, projectId, logger, runner);

    const comments = await client.fetchPRComments(7);

    expect(comments).toHaveLength(1);
    expect(comments[0].pull_request_url).toBe('https://gitlab.com/acme/widgets/-/merge_requests/7');
  });
});

// ---------------------------------------------------------------------------
// GitlabPipelineClient
// ---------------------------------------------------------------------------
describe('GitlabPipelineClient', () => {
  const token = 'glpat-test-token';
  const projectId = 'acme/widgets';
  const encodedProjectId = encodeURIComponent(projectId);

  it('should fetch pipelines and map to workflow format', async () => {
    const runner = createMockRunner({
      [`projects/${encodedProjectId}/pipelines`]: pipelineResponse(),
      [`projects/${encodedProjectId}/pipelines/2001`]: pipelineDetailResponse(),
    });
    const client = new GitlabPipelineClient(token, projectId, logger, runner);

    const response = await client.fetchWorkflowRunsPage(1);

    expect(response.runs).toHaveLength(1);
    const run = response.runs[0];
    expect(run.id).toBe('2001');
    expect(run.run_number).toBe('41');
    expect(run.status).toBe('completed');
    expect(run.conclusion).toBe('success');
    expect(run.head_branch).toBe('main');
    expect(run.path).toBe('.gitlab-ci.yml');
    expect(run.event).toBe('push');
  });

  it('should map running status to in_progress', async () => {
    const runner = createMockRunner({
      [`projects/${encodedProjectId}/pipelines`]: pipelineResponse({ status: 'running' }),
      [`projects/${encodedProjectId}/pipelines/2001`]: pipelineDetailResponse({
        status: 'running',
      }),
    });
    const client = new GitlabPipelineClient(token, projectId, logger, runner);

    const response = await client.fetchWorkflowRunsPage(1);

    expect(response.runs[0].status).toBe('in_progress');
  });

  it('should map failed status to completed with failure conclusion', async () => {
    const runner = createMockRunner({
      [`projects/${encodedProjectId}/pipelines`]: pipelineResponse({
        status: 'failed',
        finished_at: '2026-02-03T10:10:00Z',
      }),
      [`projects/${encodedProjectId}/pipelines/2001`]: pipelineDetailResponse({
        status: 'failed',
        finished_at: '2026-02-03T10:10:00Z',
      }),
    });
    const client = new GitlabPipelineClient(token, projectId, logger, runner);

    const response = await client.fetchWorkflowRunsPage(1);

    expect(response.runs[0].status).toBe('completed');
    expect(response.runs[0].conclusion).toBe('failure');
  });

  it('should map canceled status to completed with cancelled conclusion', async () => {
    const runner = createMockRunner({
      [`projects/${encodedProjectId}/pipelines`]: pipelineResponse({ status: 'canceled' }),
      [`projects/${encodedProjectId}/pipelines/2001`]: pipelineDetailResponse({
        status: 'canceled',
      }),
    });
    const client = new GitlabPipelineClient(token, projectId, logger, runner);

    const response = await client.fetchWorkflowRunsPage(1);

    expect(response.runs[0].status).toBe('completed');
    expect(response.runs[0].conclusion).toBe('cancelled');
  });

  it('should pass unknown status through as-is', async () => {
    const runner = createMockRunner({
      [`projects/${encodedProjectId}/pipelines`]: pipelineResponse({
        status: 'pending',
        finished_at: null,
        started_at: null,
      }),
      [`projects/${encodedProjectId}/pipelines/2001`]: pipelineDetailResponse({
        status: 'pending',
        finished_at: null,
        started_at: null,
      }),
    });
    const client = new GitlabPipelineClient(token, projectId, logger, runner);

    const response = await client.fetchWorkflowRunsPage(1);

    expect(response.runs[0].status).toBe('pending');
    expect(response.runs[0].conclusion).toBe('');
  });

  it('should paginate through workflow runs in fetchWorkflows', async () => {
    const fullPagePipeline = {
      id: 1,
      iid: 1,
      ref: 'main',
      sha: 'abc',
      status: 'success',
      source: 'push',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:10:00Z',
      started_at: '2026-01-01T00:00:00Z',
      finished_at: '2026-01-01T00:10:00Z',
      web_url: '',
    };

    // Page 1: 100 pipelines + 100 details (one detail call per pipeline)
    const fullPage = Array.from({ length: 100 }, (_, i) => ({
      ...fullPagePipeline,
      id: i + 1,
      iid: i + 1,
    }));
    const pageDetails = fullPage.map((p) => ({ ...p }));

    // Page 2: 3 pipelines + 3 details
    const partialPage = [
      { ...fullPagePipeline, id: 200, iid: 200 },
      { ...fullPagePipeline, id: 201, iid: 201 },
    ];
    const partialPageDetails = partialPage.map((p) => ({ ...p }));

    // Mock: list call page1, then detail calls for page1, then list call page2, then detail calls for page2
    const runner = vi.fn();
    runner.mockResolvedValueOnce(JSON.stringify(fullPage)); // page1 list
    for (const detail of pageDetails) {
      runner.mockResolvedValueOnce(JSON.stringify(detail)); // page1 details
    }
    runner.mockResolvedValueOnce(JSON.stringify(partialPage)); // page2 list
    for (const detail of partialPageDetails) {
      runner.mockResolvedValueOnce(JSON.stringify(detail)); // page2 details
    }

    const client = new GitlabPipelineClient(token, projectId, logger, runner);
    const runs = await client.fetchWorkflows();

    expect(runs).toHaveLength(102);
  });

  it('should pass date filters to pipelines', async () => {
    const runner = vi.fn().mockResolvedValue('[]');
    const client = new GitlabPipelineClient(token, projectId, logger, runner);

    await client.fetchWorkflowRunsPage(1, 100, {
      created: '2026-01-01..2026-01-31',
    });

    const endpoint = getEndpoint(runner);
    expect(endpoint).toContain('updated_after=2026-01-01');
    expect(endpoint).toContain('updated_before=2026-01-31');
  });

  it('should pass raw filters to pipelines', async () => {
    const runner = vi.fn().mockResolvedValue('[]');
    const client = new GitlabPipelineClient(token, projectId, logger, runner);

    await client.fetchWorkflowRunsPage(1, 100, {
      rawFilters: 'status=success,ref=main',
    });

    const endpoint = getEndpoint(runner);
    expect(endpoint).toContain('status=success');
    expect(endpoint).toContain('ref=main');
  });

  it('should fetch jobs for a pipeline run', async () => {
    const runner = createMockRunner({
      [`projects/${encodedProjectId}/pipelines/2001/jobs`]: jobsResponse(),
    });
    const client = new GitlabPipelineClient(token, projectId, logger, runner);

    const response = await client.fetchJobsPage('2001', 1, 100);

    expect(response.jobs).toHaveLength(1);
    const job = response.jobs[0];
    expect(job.id).toBe('5001');
    expect(job.name).toBe('build');
    expect(job.status).toBe('completed');
    expect(job.conclusion).toBe('success');
    expect(job.run_id).toBe('2001');
    expect(job.head_branch).toBe('main');
    expect(job.head_sha).toBe('abc123');
  });

  it('should handle job without name by using stage as fallback', async () => {
    const runner = createMockRunner({
      [`projects/${encodedProjectId}/pipelines/2001/jobs`]: jobsResponse({
        name: undefined,
        stage: 'test',
      }),
    });
    const client = new GitlabPipelineClient(token, projectId, logger, runner);

    const response = await client.fetchJobsPage('2001', 1);

    expect(response.jobs[0].name).toBe('test');
  });

  it('should generate fallback job name when no name or stage', async () => {
    const runner = createMockRunner({
      [`projects/${encodedProjectId}/pipelines/2001/jobs`]: jobsResponse({
        name: undefined,
        stage: undefined,
        id: 42,
      }),
    });
    const client = new GitlabPipelineClient(token, projectId, logger, runner);

    const response = await client.fetchJobsPage('2001', 1);

    expect(response.jobs[0].name).toBe('job-42');
  });

  it('should paginate through job pages', async () => {
    const fullJob = {
      id: 1,
      name: 'build',
      status: 'success',
      created_at: '2026-01-01T00:00:00Z',
      started_at: '2026-01-01T00:00:00Z',
      finished_at: '2026-01-01T00:05:00Z',
      pipeline: { id: 2001, web_url: '' },
    };
    const fullPage = Array.from({ length: 100 }, (_, i) => ({
      ...fullJob,
      id: i + 1,
    }));
    const partialPage = [{ ...fullJob, id: 200 }];

    const runner = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify(fullPage))
      .mockResolvedValueOnce(JSON.stringify(partialPage));

    const client = new GitlabPipelineClient(token, projectId, logger, runner);
    const response = await client.fetchJobsPage('2001', 1, 100);

    expect(response.jobs).toHaveLength(100);
    expect(response.hasNext).toBe(true);

    const response2 = await client.fetchJobsPage('2001', 2, 100);
    expect(response2.jobs).toHaveLength(1);
    expect(response2.hasNext).toBe(false);
  });

  it('should include retried jobs', async () => {
    const runner = vi.fn().mockResolvedValue('[]');
    const client = new GitlabPipelineClient(token, projectId, logger, runner);

    await client.fetchJobsPage('2001', 1);

    const endpoint = getEndpoint(runner);
    expect(endpoint).toContain('include_retried=true');
  });

  it('should pass glab api command args for pipelines', async () => {
    const runner = vi.fn().mockResolvedValue('[]');
    const client = new GitlabPipelineClient(token, projectId, logger, runner);

    await client.fetchWorkflowRunsPage(1);

    expect(runner.mock.lastCall![0]).toEqual(['api', expect.any(String)]);
  });

  it('should fetch pipeline details for each pipeline in the page', async () => {
    const runner = vi
      .fn()
      .mockResolvedValueOnce(
        JSON.stringify([
          { id: 2001, status: 'success' },
          { id: 2002, status: 'failed' },
        ])
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          id: 2001,
          iid: 41,
          ref: 'main',
          sha: 'abc123',
          status: 'success',
          source: 'push',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:10:00Z',
        })
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          id: 2002,
          iid: 42,
          ref: 'main',
          sha: 'def456',
          status: 'failed',
          source: 'push',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:10:00Z',
        })
      );

    const client = new GitlabPipelineClient(token, projectId, logger, runner);

    const response = await client.fetchWorkflowRunsPage(1);

    expect(response.runs).toHaveLength(2);
    expect(runner).toHaveBeenCalledTimes(3);
  });

  it('should handle pipeline detail fetch failure gracefully', async () => {
    const runner = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify([{ id: 2001, status: 'success' }]))
      .mockRejectedValueOnce(new Error('fetch error'));

    const client = new GitlabPipelineClient(token, projectId, logger, runner);

    const response = await client.fetchWorkflowRunsPage(1);

    expect(response.runs).toHaveLength(1);
    expect(runner).toHaveBeenCalledTimes(2);
  });

  it('should handle missing pipeline data gracefully', async () => {
    const runner = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify([{ id: 2001 }]))
      .mockResolvedValueOnce(JSON.stringify({ id: 2001 }));

    const client = new GitlabPipelineClient(token, projectId, logger, runner);

    const response = await client.fetchWorkflowRunsPage(1);

    expect(response.runs).toHaveLength(1);
    const run = response.runs[0];
    expect(run.id).toBe('2001');
    expect(run.name).toBe('.gitlab-ci.yml');
    expect(run.head_branch).toBe('');
    expect(run.head_sha).toBe('');
  });

  it('should use fetchPipelines as alternative to sync', async () => {
    const runner = createMockRunner({
      [`projects/${encodedProjectId}/pipelines`]: pipelineResponse(),
      [`projects/${encodedProjectId}/pipelines/2001`]: pipelineDetailResponse(),
    });
    const client = new GitlabPipelineClient(token, projectId, logger, runner);

    const pipelines = await client.fetchPipelines();

    expect(pipelines).toHaveLength(1);
    expect(pipelines[0].id).toBe('2001');
  });

  it('should fetch jobs across multiple pipelines', async () => {
    const runner = vi
      .fn()
      .mockResolvedValueOnce(
        JSON.stringify([{ id: 5001, name: 'build', status: 'success', pipeline: { id: '2001' } }])
      )
      .mockResolvedValueOnce(
        JSON.stringify([{ id: 5002, name: 'test', status: 'success', pipeline: { id: '2002' } }])
      );

    const client = new GitlabPipelineClient(token, projectId, logger, runner);

    const jobs = await client.fetchJobsForPipelines(['2001', '2002']);

    expect(jobs).toHaveLength(2);
    expect(jobs[0].run_id).toBe('2001');
    expect(jobs[1].run_id).toBe('2002');
  });

  it('should handle pipeline without name', async () => {
    const runner = createMockRunner({
      [`projects/${encodedProjectId}/pipelines`]: pipelineResponse({ name: undefined }),
      [`projects/${encodedProjectId}/pipelines/2001`]: pipelineDetailResponse({ name: undefined }),
    });
    const client = new GitlabPipelineClient(token, projectId, logger, runner);

    const response = await client.fetchWorkflowRunsPage(1);

    expect(response.runs[0].name).toBe('.gitlab-ci.yml');
  });

  it('should use pipeline web_url for html_url', async () => {
    const webUrl = 'https://gitlab.com/acme/widgets/-/pipelines/2001';
    const runner = createMockRunner({
      [`projects/${encodedProjectId}/pipelines`]: pipelineResponse({ web_url: webUrl }),
      [`projects/${encodedProjectId}/pipelines/2001`]: pipelineDetailResponse({ web_url: webUrl }),
    });
    const client = new GitlabPipelineClient(token, projectId, logger, runner);

    const response = await client.fetchWorkflowRunsPage(1);

    expect(response.runs[0].html_url).toBe(webUrl);
  });

  it('should create only one date filter from startDate or endDate alone', async () => {
    const runner = vi.fn().mockResolvedValue('[]');
    const client = new GitlabPipelineClient(token, projectId, logger, runner);

    await client.fetchWorkflowRunsPage(1, 100, {
      created: '2026-01-01..',
    });

    const endpoint = getEndpoint(runner);
    expect(endpoint).toContain('updated_after=2026-01-01');
    expect(endpoint).not.toContain('updated_before');
  });

  it('should set env vars when token is provided', async () => {
    const runner = vi.fn().mockResolvedValue('[]');
    const client = new GitlabPipelineClient(token, projectId, logger, runner);

    await client.fetchWorkflowRunsPage(1);

    const env = getEnv(runner)!;
    expect(env.GITLAB_TOKEN).toBe(token);
    expect(env.GLAB_TOKEN).toBe(token);
  });

  it('should pass --hostname to glab api when gitlabUrl is provided', async () => {
    const runner = vi.fn().mockResolvedValue('[]');
    const client = new GitlabPipelineClient(
      token,
      projectId,
      logger,
      runner,
      'https://gitlab.example.com'
    );

    await client.fetchWorkflowRunsPage(1);

    const args: string[] = runner.mock.lastCall![0];
    expect(args).toEqual(['api', '--hostname', 'gitlab.example.com', expect.any(String)]);
  });

  it('should not include --hostname when gitlabUrl is not provided', async () => {
    const runner = vi.fn().mockResolvedValue('[]');
    const client = new GitlabPipelineClient(token, projectId, logger, runner);

    await client.fetchWorkflowRunsPage(1);

    const args: string[] = runner.mock.lastCall![0];
    expect(args).toEqual(['api', expect.any(String)]);
    expect(args).not.toContain('--hostname');
  });
});
