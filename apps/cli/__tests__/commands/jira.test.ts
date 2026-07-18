import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { commands } from '../../src';

const mocks = vi.hoisted(() => ({
  getIssues: vi.fn(),
}));

vi.mock('../../src/factories/jira-factory', () => ({
  createJiraDependencies: () => ({
    issuesRepository: {
      getIssues: mocks.getIssues,
    },
  }),
}));

describe('cli: Jira Commands', () => {
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

    mocks.getIssues.mockResolvedValue([
      { id: 'JIRA-1', key: 'JIRA-1', fields: { summary: 'Sample issue' } },
    ]);

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

  describe('jira fetch-issues', () => {
    it('forwards all filters to IssuesRepository.getIssues', async () => {
      await program.parseAsync(
        [
          'jira',
          'fetch-issues',
          '--force',
          '--update',
          '--start-date',
          '2026-01-01',
          '--end-date',
          '2026-01-31',
          '--status',
          'In Progress',
        ],
        { from: 'user' }
      );

      expect(mocks.getIssues).toHaveBeenCalledWith({
        forceRefresh: true,
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        status: 'In Progress',
        incrementalUpdate: true,
      });
    });

    it('passes through default values when no options are provided', async () => {
      await program.parseAsync(['jira', 'fetch-issues'], { from: 'user' });

      expect(mocks.getIssues).toHaveBeenCalledWith({
        forceRefresh: undefined,
        startDate: undefined,
        endDate: undefined,
        status: undefined,
        incrementalUpdate: undefined,
      });
    });

    it('prints the fetched count in text output', async () => {
      mocks.getIssues.mockResolvedValueOnce([{ id: 'JIRA-1' }, { id: 'JIRA-2' }, { id: 'JIRA-3' }]);

      await program.parseAsync(['jira', 'fetch-issues'], { from: 'user' });

      const output = getOutput();

      expect(output).toContain('🔄 Fetching issues from Jira...');
      expect(output).toContain('✅ Fetched 3 issues from Jira');
    });

    it('prints issues as JSON when --output json is provided', async () => {
      await program.parseAsync(['jira', 'fetch-issues', '--output', 'json'], { from: 'user' });

      const jsonLine = consoleSpy.mock.calls
        .map((call) => call[0])
        .find((value): value is string => typeof value === 'string' && value.startsWith('['));
      expect(jsonLine).toBeDefined();

      const parsed = JSON.parse(jsonLine!);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe('JIRA-1');
    });
  });

  describe('jira fetch-changelog', () => {
    it('exits with an error when --issue is not provided', async () => {
      await expect(
        program.parseAsync(['jira', 'fetch-changelog'], { from: 'user' })
      ).rejects.toThrow('process.exit(1)');

      const output = getOutput();

      expect(output).toContain('❌ Error: --issue parameter is required');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('prints a not-supported notice with the issue key when --issue is provided', async () => {
      exitSpy.mockImplementation(() => undefined as never);

      await program.parseAsync(['jira', 'fetch-changelog', '--issue', 'JIRA-123'], {
        from: 'user',
      });

      const output = getOutput();

      expect(output).toContain('🔄 Fetching changelog for issue JIRA-123...');
      expect(output).toContain('Changelog fetching requires direct repository access.');
      expect(output).toContain('jira fetch-changelog --issue JIRA-123');
      expect(exitSpy).not.toHaveBeenCalled();
    });
  });

  describe('jira fetch-comments', () => {
    it('exits with an error when --issue is not provided', async () => {
      await expect(
        program.parseAsync(['jira', 'fetch-comments'], { from: 'user' })
      ).rejects.toThrow('process.exit(1)');

      const output = getOutput();

      expect(output).toContain('❌ Error: --issue parameter is required');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('prints a not-supported notice with the issue key when --issue is provided', async () => {
      exitSpy.mockImplementation(() => undefined as never);

      await program.parseAsync(['jira', 'fetch-comments', '--issue', 'JIRA-456'], {
        from: 'user',
      });

      const output = getOutput();

      expect(output).toContain('🔄 Fetching comments for issue JIRA-456...');
      expect(output).toContain('Comment fetching requires direct repository access.');
      expect(output).toContain('jira fetch-comments --issue JIRA-456');
      expect(exitSpy).not.toHaveBeenCalled();
    });
  });
});
