import { beforeEach, describe, expect, it } from 'vitest';
import { formatPullRequestMetrics } from '../../src/formatters';
import { Command } from 'commander';
import { commands } from '../../src';
import { formatPRSummary } from '../../src/commands/prs';

describe('cli: Pull Request Commands', () => {
  let program: Command;
  let prsCommand: Command;

  const getSubcommand = (name: string): Command | undefined =>
    prsCommand.commands.find((cmd) => cmd.name() === name);

  const optionNames = (command: Command): string[] =>
    command.options.map((option) => option.long).filter(Boolean);

  beforeEach(() => {
    program = commands();
    const found = program.commands.find((cmd) => cmd.name() === 'prs');
    expect(found).toBeDefined();
    prsCommand = found!;
  });

  it('registers prs command group', () => {
    expect(prsCommand.name()).toBe('prs');
    expect(prsCommand.description()).toBe('Pull request operations');
  });

  describe('prs fetch', () => {
    it('registers fetch command with expected options', () => {
      const command = getSubcommand('fetch');

      expect(command).toBeDefined();
      expect(command?.description()).toBe('Fetch pull requests from the configured Git provider');
      expect(optionNames(command!)).toEqual(
        expect.arrayContaining([
          '--force',
          '--update',
          '--start-date',
          '--end-date',
          '--raw-filters',
        ])
      );
    });
  });

  describe('prs fetch-comments', () => {
    it('registers fetch-comments command with expected options', () => {
      const command = getSubcommand('fetch-comments');

      expect(command).toBeDefined();
      expect(command?.description()).toBe(
        'Fetch pull request comments from the configured Git provider'
      );
      expect(optionNames(command!)).toEqual(
        expect.arrayContaining([
          '--force',
          '--update',
          '--start-date',
          '--end-date',
          '--raw-filters',
        ])
      );
    });
  });

  describe('prs summary', () => {
    it('registers summary command with expected options', () => {
      const command = getSubcommand('summary');

      expect(command).toBeDefined();
      expect(command?.description()).toBe('View PR summary statistics');
      expect(optionNames(command!)).toEqual(
        expect.arrayContaining([
          '--start-date',
          '--end-date',
          '--exclude-authors',
          '--exclude-commenters',
          '--authors',
          '--labels',
          '--raw-filters',
          '--output',
        ])
      );
    });
  });

  describe('prs by-month', () => {
    it('registers by-month command with expected options', () => {
      const command = getSubcommand('by-month');

      expect(command).toBeDefined();
      expect(command?.description()).toBe('View PR metrics grouped by month');
      expect(optionNames(command!)).toEqual(
        expect.arrayContaining([
          '--start-date',
          '--end-date',
          '--exclude-authors',
          '--exclude-commenters',
          '--raw-filters',
          '--output',
        ])
      );
    });
  });

  describe('prs by-week', () => {
    it('registers by-week command with expected options', () => {
      const command = getSubcommand('by-week');

      expect(command).toBeDefined();
      expect(command?.description()).toBe('View PR metrics grouped by week');
      expect(optionNames(command!)).toEqual(
        expect.arrayContaining([
          '--start-date',
          '--end-date',
          '--exclude-authors',
          '--exclude-commenters',
          '--raw-filters',
          '--output',
        ])
      );
    });
  });

  describe('prs through-time', () => {
    it('registers through-time command with expected options', () => {
      const command = getSubcommand('through-time');

      expect(command).toBeDefined();
      expect(command?.description()).toBe(
        'View PRs opened and closed through time (daily/weekly/monthly)'
      );
      expect(optionNames(command!)).toEqual(
        expect.arrayContaining([
          '--start-date',
          '--end-date',
          '--exclude-authors',
          '--exclude-commenters',
          '--authors',
          '--labels',
          '--aggregate-by',
          '--raw-filters',
          '--output',
        ])
      );
    });
  });

  describe('prs by-author', () => {
    it('registers by-author command with expected options', () => {
      const command = getSubcommand('by-author');

      expect(command).toBeDefined();
      expect(command?.description()).toBe('View PRs grouped by author');
      expect(optionNames(command!)).toEqual(
        expect.arrayContaining([
          '--start-date',
          '--end-date',
          '--exclude-authors',
          '--exclude-commenters',
          '--authors',
          '--labels',
          '--top',
          '--raw-filters',
          '--output',
        ])
      );
    });
  });

  describe('prs average-review-time', () => {
    it('registers average-review-time command with expected options', () => {
      const command = getSubcommand('average-review-time');

      expect(command).toBeDefined();
      expect(command?.description()).toBe('View average review time (days) by author');
      expect(optionNames(command!)).toEqual(
        expect.arrayContaining([
          '--start-date',
          '--end-date',
          '--exclude-authors',
          '--exclude-commenters',
          '--authors',
          '--labels',
          '--top',
          '--raw-filters',
          '--output',
          '--weekends',
          '--outlier-mode',
        ])
      );
    });
  });

  describe('prs average-open', () => {
    it('registers average-open command with expected options', () => {
      const command = getSubcommand('average-open');

      expect(command).toBeDefined();
      expect(command?.description()).toBe(
        'View average PR open time (days) aggregated by day/week/month'
      );
      expect(optionNames(command!)).toEqual(
        expect.arrayContaining([
          '--start-date',
          '--end-date',
          '--exclude-authors',
          '--exclude-commenters',
          '--authors',
          '--labels',
          '--aggregate-by',
          '--raw-filters',
          '--output',
          '--weekends',
          '--outlier-mode',
        ])
      );
    });
  });

  describe('prs average-comments', () => {
    it('registers average-comments command with expected options', () => {
      const command = getSubcommand('average-comments');

      expect(command).toBeDefined();
      expect(command?.description()).toBe('View average number of comments per PR');
      expect(optionNames(command!)).toEqual(
        expect.arrayContaining([
          '--start-date',
          '--end-date',
          '--exclude-authors',
          '--exclude-commenters',
          '--authors',
          '--labels',
          '--aggregate-by',
          '--raw-filters',
          '--output',
          '--weekends',
          '--outlier-mode',
        ])
      );
    });
  });

  describe('Output Formatters', () => {
    it('should format PR summary in the expected CLI shape', () => {
      const output = formatPRSummary({
        total_prs: 2,
        merged_prs: 1,
        closed_prs: 2,
        prs_without_conclusion: 1,
        open_prs: 0,
        unique_authors: 2,
        unique_labels: 1,
        avg_comments_per_pr: 1.5,
        labels: [{ label: 'bug', prs: 1 }],
        first_pr: {
          number: 1,
          title: 'First change',
          author: 'alice',
          created: '2025-01-01T00:00:00Z',
          closed: '2025-01-02T00:00:00Z',
        },
        last_pr: {
          number: 2,
          title: 'Last change',
          author: 'bob',
          created: '2025-01-03T00:00:00Z',
          merged: '2025-01-04T00:00:00Z',
          closed: '2025-01-04T00:00:00Z',
        },
        most_commented_pr: {
          number: 2,
          title: 'Last change',
          author: 'bob',
          comments: 2,
        },
        most_commented_prs: [],
        top_commenter: {
          login: 'reviewer',
          comments: 2,
        },
        top_themes: [{ text: 'github', value: 2 }],
        time_to_first_comment_hours: {
          average: 12.345,
          median: 12.345,
          min: 1,
          max: 24,
          prs_with_comment: 1,
          prs_without_comment: 1,
        },
      });

      expect(output).toContain('PRs Summary:');
      expect(output).toContain('PRs Without Conclusion: 1');
      expect(output).toContain('Average of comments per PR: 1.5');
      expect(output).toContain('  - bug: 1 PRs');
      expect(output).toContain('Most commented PR:');
      expect(output).toContain('Top commenter:');
      expect(output).toContain('Top themes:');
      expect(output).toContain('Time to first comment (hours):');
    });

    it('should format PR metrics in text format', () => {
      const data = {
        totalPRs: 42,
        leadTime: { average: 2.5, unit: 'days' },
        commentSummary: { total: 156 },
        labelSummary: { bug: 8, feature: 15 },
      };

      const output = formatPullRequestMetrics(data, { format: 'text' });
      expect(output).toContain('Pull Request Metrics');
      expect(output).toContain('42');
      expect(output).toContain('2.5 days');
    });

    it('should format PR metrics in JSON format', () => {
      const data = {
        totalPRs: 42,
        leadTime: { average: 2.5, unit: 'days' },
      };

      const output = formatPullRequestMetrics(data, { format: 'json' });
      const parsed = JSON.parse(output);
      expect(parsed.totalPRs).toBe(42);
      expect(parsed.leadTime.average).toBe(2.5);
    });

    it('should format PR metrics in CSV format', () => {
      const data = {
        totalPRs: 42,
        leadTime: { average: 2.5, unit: 'days' },
        commentSummary: { total: 156 },
      };

      const output = formatPullRequestMetrics(data, { format: 'csv' });
      expect(output).toContain('metric,value');
      expect(output).toContain('total_prs,42');
      expect(output).toContain('lead_time_days,2.5');
    });
  });
});
