import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { commands } from '../../src';
import { GitFactory } from '@smmachine/core';

describe('cli: Code Commands', () => {
  let program: Command;
  let fetchCommits: ReturnType<typeof vi.fn>;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
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
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    vi.restoreAllMocks();
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
