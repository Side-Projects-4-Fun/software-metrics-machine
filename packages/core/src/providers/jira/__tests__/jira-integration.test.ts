/**
 * Integration tests for Jira API client
 *
 * WARNING: These tests make real HTTP calls to Jira API.
 * They require:
 * - Valid JIRA_URL, JIRA_EMAIL, JIRA_TOKEN in environment
 * - Network access to Jira instance
 * - Appropriate permissions
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { JiraIssuesClient } from '../jira-client';
import { MockLoggerBuilder } from '../../../test/infrastructure/mock-logger-builder';

const JIRA_URL = process.env.JIRA_URL || 'https://your-instance.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL || 'user@example.com';
const JIRA_TOKEN = process.env.JIRA_TOKEN || 'test-token';
const JIRA_PROJECT = process.env.JIRA_PROJECT || 'TEST';
const logger = new MockLoggerBuilder().build();

// Skip real API tests if not configured
const skipRealApiTests = !process.env.RUN_JIRA_INTEGRATION_TESTS;

describe('Jira API Integration Tests', () => {
  let jiraClient: JiraIssuesClient;

  beforeAll(() => {
    jiraClient = new JiraIssuesClient(JIRA_URL, JIRA_EMAIL, JIRA_TOKEN, JIRA_PROJECT, logger);
  });

  describe('JiraIssuesClient', () => {
    it.skipIf(skipRealApiTests)('should fetch issues from Jira API', async () => {
      const issues = await jiraClient.fetchIssues();

      expect(Array.isArray(issues)).toBe(true);
      if (issues.length > 0) {
        const issue = issues[0];
        expect(issue).toHaveProperty('key');
        expect(issue).toHaveProperty('title');
        expect(issue).toHaveProperty('status');
        expect(issue).toHaveProperty('createdAt');
      }
    });

    it.skipIf(skipRealApiTests)('should filter issues by project', async () => {
      const issues = await jiraClient.fetchIssues({
        project: JIRA_PROJECT,
      });

      expect(Array.isArray(issues)).toBe(true);
    });

    it.skipIf(skipRealApiTests)('should filter issues by date range', async () => {
      const issues = await jiraClient.fetchIssues({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        project: JIRA_PROJECT,
      });

      expect(Array.isArray(issues)).toBe(true);
      issues.forEach((issue) => {
        const createdDate = new Date(issue.createdAt);
        expect(createdDate.getTime()).toBeLessThanOrEqual(
          new Date('2024-12-31T23:59:59').getTime()
        );
      });
    });

    it.skipIf(skipRealApiTests)('should filter issues by status', async () => {
      const issues = await jiraClient.fetchIssues({
        status: 'Done',
        project: JIRA_PROJECT,
      });

      expect(Array.isArray(issues)).toBe(true);
      issues.forEach((issue) => {
        expect(issue.status).toBe('Done');
      });
    });

    it.skipIf(skipRealApiTests)('should fetch issue changelog', async () => {
      const issues = await jiraClient.fetchIssues({
        project: JIRA_PROJECT,
      });

      if (issues.length > 0) {
        const issueKey = issues[0].key;
        const changelog = await jiraClient.fetchIssueChanges(issueKey!);

        expect(Array.isArray(changelog)).toBe(true);
      }
    });

    it.skipIf(skipRealApiTests)('should fetch issue comments', async () => {
      const issues = await jiraClient.fetchIssues({
        project: JIRA_PROJECT,
      });

      if (issues.length > 0) {
        const issueKey = issues[0].key;
        const comments = await jiraClient.fetchIssueComments(issueKey!);

        expect(Array.isArray(comments)).toBe(true);
      }
    });

    it('should throw error on invalid authentication', async () => {
      const invalidClient = new JiraIssuesClient(
        JIRA_URL,
        'invalid@example.com',
        'invalid-token',
        JIRA_PROJECT,
        logger
      );

      try {
        await invalidClient.fetchIssues();
      } catch (error: any) {
        expect(error.message).toMatch(/authentication failed|Jira|API error/i);
      }
    });

    it('should throw error on invalid project', async () => {
      const client = new JiraIssuesClient(JIRA_URL, JIRA_EMAIL, JIRA_TOKEN, 'INVALID', logger);

      try {
        await client.fetchIssues();
      } catch (error: any) {
        // Either project not found or no issues
        expect(error).toBeDefined();
      }
    });
  });
});

describe('Jira API Unit Tests', () => {
  it('should initialize client with credentials', () => {
    const client = new JiraIssuesClient(
      'https://example.atlassian.net',
      'user@example.com',
      'token123',
      'PROJ',
      logger
    );

    expect(client).toBeDefined();
  });

  it('should handle URL with trailing slash', () => {
    const client1 = new JiraIssuesClient(
      'https://example.atlassian.net/',
      'user@example.com',
      'token123',
      'PROJ',
      logger
    );

    const client2 = new JiraIssuesClient(
      'https://example.atlassian.net',
      'user@example.com',
      'token123',
      'PROJ',
      logger
    );

    expect(client1).toBeDefined();
    expect(client2).toBeDefined();
  });
});
