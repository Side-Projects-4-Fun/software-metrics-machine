import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { JiraCsvIssuesClient } from '../jira-csv-client';
import { MockLoggerBuilder } from '../../../test/infrastructure/mock-logger-builder';

const HEADER =
  'Summary,Issue key,Issue Type,Status,Project key,Assignee,Created,Updated,Resolved,Labels,Labels,Description,Comment';
const CSV = [
  HEADER,
  '"Fix, checkout",KAN-1,Bug,Done,KAN,Alice,09/Oct/26 12:15 PM,10/Oct/26 09:00 AM,10/Oct/26 09:05 AM,smm,feature,Checkout bug,10/Oct/26 09:05 AM;user-1;Looks good',
  'Slow cart,KAN-2,Task,To Do,KAN,Bob,11/Oct/26 08:00 AM,11/Oct/26 08:00 AM,,smm,,Cart latency,',
].join('\n');

describe('JiraCsvIssuesClient', () => {
  const logger = new MockLoggerBuilder().build();
  let tempDir: string;
  let filePath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-jira-csv-'));
    filePath = path.join(tempDir, 'Jira.csv');
    await fs.writeFile(filePath, CSV, 'utf8');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('maps issues and comments from the CSV export', async () => {
    const client = new JiraCsvIssuesClient(filePath, logger, 'https://jira.example.com');

    const issues = await client.fetchIssues();

    expect(issues).toHaveLength(2);
    expect(issues[0]).toMatchObject({
      id: 'KAN-1',
      key: 'KAN-1',
      title: 'Fix, checkout',
      status: 'Done',
      assignee: 'Alice',
      createdAt: '2026-10-09T12:15:00.000Z',
      updatedAt: '2026-10-10T09:00:00.000Z',
      closedAt: '2026-10-10T09:05:00.000Z',
      labels: ['smm', 'feature'],
      provider: 'jira-csv',
      url: 'https://jira.example.com/browse/KAN-1',
    });

    const comments = await client.fetchComments({ issueKey: 'KAN-1' });

    expect(comments).toEqual([
      {
        id: 'KAN-1-comment-1',
        issueKey: 'KAN-1',
        author: 'user-1',
        body: 'Looks good',
        createdAt: '2026-10-10T09:05:00.000Z',
        provider: 'jira-csv',
      },
    ]);
  });

  it('filters issues by created window, status, label and type', async () => {
    const client = new JiraCsvIssuesClient(filePath, logger);

    expect(await client.fetchIssues({ endDate: '2026-10-09T23:59:59.999Z' })).toHaveLength(1);
    expect(await client.fetchIssues({ status: 'done' })).toHaveLength(1);
    expect(await client.fetchIssues({ labels: ['feature'] })).toHaveLength(1);
    expect(await client.fetchIssues({ issueType: 'Task' })).toHaveLength(1);
  });

  it('includes issues updated in the incremental window even when created earlier', async () => {
    const client = new JiraCsvIssuesClient(filePath, logger);

    const issues = await client.fetchIssues({ startDate: '2026-10-10T09:00:00.000Z' });

    expect(issues.map((issue) => issue.key).sort()).toEqual(['KAN-1', 'KAN-2']);
  });

  it('filters comments across issues by creation window', async () => {
    const client = new JiraCsvIssuesClient(filePath, logger);

    const comments = await client.fetchComments({
      startDate: '2026-10-01T00:00:00.000Z',
      endDate: '2026-10-31T23:59:59.999Z',
    });

    expect(comments.map((comment) => comment.id)).toEqual(['KAN-1-comment-1']);
  });

  it('returns an actionable error when the export is missing', async () => {
    const missingPath = path.join(tempDir, 'Missing.csv');
    const client = new JiraCsvIssuesClient(missingPath, logger);

    await expect(client.fetchIssues()).rejects.toThrow(
      `Jira CSV export not found at ${missingPath}`
    );
  });
});
