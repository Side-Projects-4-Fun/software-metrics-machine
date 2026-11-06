import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Command } from 'commander';
import { commands } from '../../src';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  getIssues: vi.fn(),
  getComments: vi.fn(),
}));

vi.mock('@smmachine/core/domain/issues/factories/issues-factory', () => ({
  IssuesFactory: {
    create: mocks.create,
  },
}));

describe('cli: Issues Commands', () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  const getOutput = () =>
    consoleSpy.mock.calls
      .flat()
      .filter((value: unknown): value is string => typeof value === 'string')
      .join('\n');

  beforeEach(() => {
    vi.stubEnv('SMM_STORE_DATA_AT', '/tmp');
    vi.stubEnv('OWNER_REPO_GIT_PROVIDER', 'github');
    vi.stubEnv('OWNER_REPO_GITHUB_TOKEN', 'fake-token');
    vi.stubEnv('OWNER_REPO_GIT_REPOSITORY_PATH', '/tmp/repo');

    mocks.getIssues.mockResolvedValue([{ id: 'ISSUE-1' }]);
    mocks.getComments.mockResolvedValue([{ id: 'comment-1' }]);
    mocks.create.mockReturnValue({
      provider: 'jira',
      issuesRepository: {
        provider: 'jira',
        getIssues: mocks.getIssues,
        getComments: mocks.getComments,
      },
    });

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`process.exit(${code ?? 0})`);
    });

    program = commands();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    exitSpy.mockRestore();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe('command registration', () => {
    it('registers the issues group and removes the jira group', () => {
      const names = program.commands.map((command) => command.name());

      expect(names).toContain('issues');
      expect(names).not.toContain('jira');
    });

    it('does not register fetch-changelog', () => {
      const issues = program.commands.find((command) => command.name() === 'issues');
      const subcommands = (issues?.commands ?? []).map((command) => command.name());

      expect(subcommands).toContain('fetch');
      expect(subcommands).toContain('fetch-comments');
      expect(subcommands).not.toContain('fetch-changelog');
    });
  });

  describe('issues fetch', () => {
    it('forwards all filters to IssuesRepository.getIssues', async () => {
      await program.parseAsync(
        [
          'issues',
          'fetch',
          '--force',
          '--update',
          '--start-date',
          '2026-01-01',
          '--end-date',
          '2026-01-31',
          '--status',
          'In Progress',
          '--label',
          'bug,backend',
        ],
        { from: 'user' }
      );

      expect(mocks.getIssues).toHaveBeenCalledWith({
        forceRefresh: true,
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        status: 'In Progress',
        labels: ['bug', 'backend'],
        incrementalUpdate: true,
      });
    });

    it('passes through default values when no options are provided', async () => {
      await program.parseAsync(['issues', 'fetch'], { from: 'user' });

      expect(mocks.getIssues).toHaveBeenCalledWith({
        forceRefresh: undefined,
        startDate: undefined,
        endDate: undefined,
        status: undefined,
        labels: undefined,
        incrementalUpdate: undefined,
      });
    });

    it('prints the fetched count and provider in text output', async () => {
      mocks.getIssues.mockResolvedValueOnce([
        { id: 'ISSUE-1' },
        { id: 'ISSUE-2' },
        { id: 'ISSUE-3' },
      ]);

      await program.parseAsync(['issues', 'fetch'], { from: 'user' });

      const output = getOutput();

      expect(output).toContain('🔄 Fetching issues from Jira...');
      expect(output).toContain('✅ Fetched 3 issues from Jira');
    });

    it('labels the provider as GitHub when configured', async () => {
      mocks.create.mockReturnValue({
        provider: 'github',
        issuesRepository: {
          provider: 'github',
          getIssues: mocks.getIssues,
          getComments: mocks.getComments,
        },
      });

      await program.parseAsync(['issues', 'fetch'], { from: 'user' });

      expect(getOutput()).toContain('✅ Fetched 1 issues from GitHub');
    });

    it('labels the file-backed provider as Jira CSV', async () => {
      mocks.create.mockReturnValue({
        provider: 'jira-csv',
        issuesRepository: {
          provider: 'jira-csv',
          getIssues: mocks.getIssues,
          getComments: mocks.getComments,
        },
      });

      await program.parseAsync(['issues', 'fetch'], { from: 'user' });

      expect(getOutput()).toContain('✅ Fetched 1 issues from Jira CSV');
    });

    it('prints issues as JSON when --output json is provided', async () => {
      await program.parseAsync(['issues', 'fetch', '--output', 'json'], { from: 'user' });

      const jsonLine = consoleSpy.mock.calls
        .map((call) => call[0])
        .find((value): value is string => typeof value === 'string' && value.startsWith('['));
      expect(jsonLine).toBeDefined();

      const parsed = JSON.parse(jsonLine!);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe('ISSUE-1');
    });
  });

  describe('issues fetch-comments', () => {
    it('forwards --issue when provided', async () => {
      await program.parseAsync(['issues', 'fetch-comments', '--issue', 'PROJ-1'], {
        from: 'user',
      });

      expect(mocks.getComments).toHaveBeenCalledWith({
        issueKey: 'PROJ-1',
        startDate: undefined,
        endDate: undefined,
        forceRefresh: undefined,
        incrementalUpdate: undefined,
      });
    });

    it('warns and fetches all comments when neither --issue nor a window is given', async () => {
      await program.parseAsync(['issues', 'fetch-comments'], { from: 'user' });

      expect(mocks.getComments).toHaveBeenCalledWith({
        issueKey: undefined,
        startDate: undefined,
        endDate: undefined,
        forceRefresh: undefined,
        incrementalUpdate: undefined,
      });
      expect(getOutput()).toContain('fetching all comments can be slow on Jira');
    });

    it('does not warn when a date window is provided', async () => {
      await program.parseAsync(
        ['issues', 'fetch-comments', '--start-date', '2026-05-01', '--end-date', '2026-05-31'],
        { from: 'user' }
      );

      expect(getOutput()).not.toContain('fetching all comments can be slow on Jira');
    });

    it('prints the fetched comment count', async () => {
      mocks.getComments.mockResolvedValueOnce([{ id: 'comment-1' }, { id: 'comment-2' }]);

      await program.parseAsync(['issues', 'fetch-comments', '--issue', 'PROJ-1'], {
        from: 'user',
      });

      expect(getOutput()).toContain('✅ Fetched 2 comments from Jira');
    });
  });
});
