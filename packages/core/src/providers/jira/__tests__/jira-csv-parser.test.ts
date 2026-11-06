import { describe, expect, it } from 'vitest';
import { parseCsv, parseJiraCsv, parseJiraCsvDate } from '../jira-csv-parser';

const HEADER =
  'Summary,Issue key,Issue Type,Status,Project key,Assignee,Created,Updated,Resolved,Labels,Labels,Description,Comment,Comment';

describe('Jira CSV parser', () => {
  describe('parseCsv', () => {
    it('handles quoted commas, escaped quotes and embedded newlines', () => {
      const rows = parseCsv('a,b,c\n"one, two","quote ""inside""","line one\nline two"\n');

      expect(rows).toEqual([
        ['a', 'b', 'c'],
        ['one, two', 'quote "inside"', 'line one\nline two'],
      ]);
    });

    it('strips a UTF-8 BOM from the first header', () => {
      const rows = parseCsv('\uFEFFSummary,Issue key\nFix,KAN-1\n');

      expect(rows[0]).toEqual(['Summary', 'Issue key']);
    });
  });

  describe('parseJiraCsvDate', () => {
    it('parses the Jira export date format as UTC', () => {
      expect(parseJiraCsvDate('09/Oct/26 12:15 PM')).toBe('2026-10-09T12:15:00.000Z');
      expect(parseJiraCsvDate('06/Sep/26 7:20 PM')).toBe('2026-09-06T19:20:00.000Z');
    });

    it('handles midnight and noon', () => {
      expect(parseJiraCsvDate('01/Jan/26 12:00 AM')).toBe('2026-01-01T00:00:00.000Z');
      expect(parseJiraCsvDate('01/Jan/26 12:00 PM')).toBe('2026-01-01T12:00:00.000Z');
    });

    it('returns undefined for empty or invalid values', () => {
      expect(parseJiraCsvDate('')).toBeUndefined();
      expect(parseJiraCsvDate('not a date')).toBeUndefined();
    });
  });

  describe('parseJiraCsv', () => {
    it('maps the export, including repeated Labels and Comment columns', () => {
      const content = [
        HEADER,
        '"Fix, checkout",KAN-1,Bug,Done,KAN,Alice,09/Oct/26 12:15 PM,10/Oct/26 09:00 AM,10/Oct/26 09:05 AM,smm,feature,"Line one\nLine two","10/Oct/26 09:05 AM;user-1;Looks good","11/Oct/26 10:00 AM;user-2;Done; thanks"',
      ].join('\n');

      const records = parseJiraCsv(content);

      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        key: 'KAN-1',
        id: 'KAN-1',
        title: 'Fix, checkout',
        status: 'Done',
        assignee: 'Alice',
        createdAt: '2026-10-09T12:15:00.000Z',
        updatedAt: '2026-10-10T09:00:00.000Z',
        closedAt: '2026-10-10T09:05:00.000Z',
        labels: ['smm', 'feature'],
        issueType: 'Bug',
        projectKey: 'KAN',
      });
      expect(records[0].comments).toEqual([
        { createdAt: '2026-10-10T09:05:00.000Z', author: 'user-1', body: 'Looks good' },
        { createdAt: '2026-10-11T10:00:00.000Z', author: 'user-2', body: 'Done; thanks' },
      ]);
    });

    it('defaults status and assignee when the export leaves them empty', () => {
      const content = [HEADER, 'Untitled,KAN-2,Task,,KAN,,09/Oct/26 12:15 PM,,,,,,'].join('\n');

      const records = parseJiraCsv(content);

      expect(records[0].status).toBe('UNKNOWN');
      expect(records[0].assignee).toBe('Unassigned');
    });
  });
});
