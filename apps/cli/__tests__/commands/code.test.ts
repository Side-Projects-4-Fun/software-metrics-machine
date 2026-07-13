import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { commands } from '../../src';
import { GitFactory } from '@smmachine/core';

describe('cli: Code Commands', () => {
  let program: Command;
  let codeCommand: Command;
  let fetchCommits: ReturnType<typeof vi.fn>;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  const getSubcommand = (name: string): Command | undefined =>
    codeCommand.commands.find((cmd) => cmd.name() === name);

  const optionNames = (command: Command): string[] =>
    command.options.map((option) => option.long).filter((value): value is string => Boolean(value));

  beforeEach(() => {
    vi.stubEnv('SMM_STORE_DATA_AT', '/tmp');
    vi.stubEnv('OWNER_REPO_GIT_PROVIDER', 'github');
    vi.stubEnv('OWNER_REPO_GITHUB_TOKEN', 'fake-token');
    vi.stubEnv('OWNER_REPO_GIT_REPOSITORY_PATH', '/tmp/repo');

    fetchCommits = vi.fn().mockResolvedValue([
      {
        hash: 'abc123',
        author: 'Alice',
        email: 'alice@example.com',
        subject: 'Add feature',
        msg: 'Add feature',
        timestamp: '2025-01-01T00:00:00Z',
      },
    ]);

    vi.spyOn(GitFactory, 'create').mockReturnValue({
      fetchCommits,
    } as unknown as ReturnType<typeof GitFactory.create>);

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    program = commands();

    const found = program.commands.find((cmd) => cmd.name() === 'code');
    expect(found).toBeDefined();
    codeCommand = found!;
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('registers code command group', () => {
    expect(codeCommand.name()).toBe('code');
    expect(codeCommand.description()).toBe('Code analysis operations');
  });

  describe('code big-o', () => {
    it('registers big-o command with expected options', () => {
      const command = getSubcommand('big-o');

      expect(command).toBeDefined();
      expect(command?.description()).toBe('Analyze Big O complexity risk for source files');
      expect(optionNames(command!)).toEqual(
        expect.arrayContaining([
          '--search',
          '--ignore-files',
          '--include-only',
          '--file',
          '--limit',
          '--output',
        ])
      );
    });
  });

  describe('code summary', () => {
    it('registers summary command with expected options', () => {
      const command = getSubcommand('summary');

      expect(command).toBeDefined();
      expect(command?.description()).toBe('View code summary with pairing insights');
      expect(optionNames(command!)).toEqual(
        expect.arrayContaining(['--start-date', '--end-date', '--output'])
      );
    });
  });

  describe('code fetch-commits', () => {
    it('registers fetch-commits command with expected options', () => {
      const command = getSubcommand('fetch-commits');

      expect(command).toBeDefined();
      expect(command?.description()).toBe('Analyze change sets from git repository');
      expect(optionNames(command!)).toEqual(
        expect.arrayContaining([
          '--start-date',
          '--end-date',
          '--authors',
          '--force',
          '--buffer',
          '--output',
        ])
      );
    });

    it('passes fetch-commits filters to the git fetch repository', async () => {
      await program.parseAsync(
        [
          'code',
          'fetch-commits',
          '--start-date',
          '2025-01-01',
          '--end-date',
          '2025-01-31',
          '--authors',
          'Alice, Bob',
          '--force',
          '--buffer',
          '200',
        ],
        { from: 'user' }
      );

      expect(fetchCommits).toHaveBeenCalledWith({
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        selectedAuthors: ['Alice', 'Bob'],
        forceRefresh: true,
        maxBuffer: 200,
      });
    });
  });

  describe('code codemaat-fetch', () => {
    it('registers codemaat-fetch command with expected options', () => {
      const command = getSubcommand('codemaat-fetch');

      expect(command).toBeDefined();
      expect(command?.description()).toBe('Fetch CodeMaat CSV data from the git repository');
      expect(optionNames(command!)).toEqual(
        expect.arrayContaining(['--start-date', '--end-date', '--subfolder', '--force', '--output'])
      );
    });
  });

  describe('code churn', () => {
    it('registers churn command with expected options', () => {
      const command = getSubcommand('churn');

      expect(command).toBeDefined();
      expect(command?.description()).toBe('Calculate code churn metrics');
      expect(optionNames(command!)).toEqual(
        expect.arrayContaining(['--start-date', '--end-date', '--authors', '--output'])
      );
    });
  });

  describe('code coupling', () => {
    it('registers coupling command with expected options', () => {
      const command = getSubcommand('coupling');

      expect(command).toBeDefined();
      expect(command?.description()).toBe('Analyze code coupling between modules');
      expect(optionNames(command!)).toEqual(
        expect.arrayContaining(['--start-date', '--end-date', '--min-coupling', '--output'])
      );
    });
  });

  describe('code entity-churn', () => {
    it('registers entity-churn command with expected options', () => {
      const command = getSubcommand('entity-churn');

      expect(command).toBeDefined();
      expect(command?.description()).toBe('Calculate entity-level churn metrics');
      expect(optionNames(command!)).toEqual(
        expect.arrayContaining(['--start-date', '--end-date', '--top', '--output'])
      );
    });
  });

  describe('code entity-effort', () => {
    it('registers entity-effort command with expected options', () => {
      const command = getSubcommand('entity-effort');

      expect(command).toBeDefined();
      expect(command?.description()).toBe('Calculate entity effort metrics');
      expect(optionNames(command!)).toEqual(
        expect.arrayContaining(['--start-date', '--end-date', '--top', '--output'])
      );
    });
  });

  describe('code entity-ownership', () => {
    it('registers entity-ownership command with expected options', () => {
      const command = getSubcommand('entity-ownership');

      expect(command).toBeDefined();
      expect(command?.description()).toBe('Analyze entity ownership by developers');
      expect(optionNames(command!)).toEqual(
        expect.arrayContaining(['--start-date', '--end-date', '--entity', '--output'])
      );
    });
  });

  describe('code pairing-index', () => {
    it('registers pairing-index command with expected options', () => {
      const command = getSubcommand('pairing-index');

      expect(command).toBeDefined();
      expect(command?.description()).toBe('Calculate developer pairing index');
      expect(optionNames(command!)).toEqual(
        expect.arrayContaining(['--start-date', '--end-date', '--min-shared', '--output'])
      );
    });
  });
});
