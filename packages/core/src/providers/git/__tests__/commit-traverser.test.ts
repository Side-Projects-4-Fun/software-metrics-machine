import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock(import('child_process'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    execSync: vi.fn(),
  };
});

import { execSync } from 'child_process';
import { CommitTraverser } from '../../..';
import { MockLoggerBuilder } from '../../../test/infrastructure/mock-logger-builder';

const mockExecSync = vi.mocked(execSync);
const logger = new MockLoggerBuilder().build();

describe('CommitTraverser', () => {
  const GIT_OUTPUT = `abc123\nAlice\nalice@b.com\n2025-01-01T00:00:00Z\nInitial commit\n\n---COMMIT-SEPARATOR---\ndef456\nBob\nbob@c.com\n2025-01-02T00:00:00Z\nAdd feature\nCo-authored-by: Alice <alice@b.com>\n---COMMIT-SEPARATOR---\n`;
  const traverser = new CommitTraverser('/fake/path', logger);

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecSync.mockReturnValue(Buffer.from(GIT_OUTPUT));
  });

  it('should convert maxBuffer from MB to bytes for execSync', async () => {
    await traverser.traverseCommits({ maxBuffer: 200 });

    expect(mockExecSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ maxBuffer: 200 * 1024 * 1024 })
    );
  });

  it('should default maxBuffer to 100MB when not provided', async () => {
    await traverser.traverseCommits();

    expect(mockExecSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ maxBuffer: 100 * 1024 * 1024 })
    );
  });

  it('should traverse commits and return result', async () => {
    const result = await traverser.traverseCommits();

    expect(result.commits).toHaveLength(2);
    expect(result.commits[0].hash).toBe('abc123');
    expect(result.commits[0].author).toBe('Alice');
    expect(result.commits[1].hash).toBe('def456');
    expect(result.commits[1].coAuthors).toContain('Alice');
    expect(result.totalAnalyzedCommits).toBe(2);
    expect(result.pairedCommits).toBe(1);
  });

  it('should throw error when execSync exceeds maxBuffer', async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('stdout maxBuffer length exceeded');
    });

    await expect(traverser.traverseCommits()).rejects.toThrow();
  });
});
