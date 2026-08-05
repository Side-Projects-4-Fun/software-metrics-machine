import {
  getReports,
  saveReport,
  updateReport,
  removeReport,
} from '@/components/filters/saved-filters-actions';
import * as api from '@/server/api';
import { ReportEntryBuilder, SavedFilterBuilder } from '../builders/builders';

jest.mock('@/server/api');

const mockFetchAPI = api.fetchAPI as jest.Mock;
const mockFetchPutAPI = api.fetchPutAPI as jest.Mock;

describe('reports-actions', () => {
  describe('getReports', () => {
    it('returns reports from the document', async () => {
      mockFetchAPI.mockResolvedValue({
        version: 1,
        filters: [],
        reports: [
          new ReportEntryBuilder()
            .withId('r1')
            .withName('Sprint 42')
            .withSections([{ section: 'pipelines', savedFilterId: 'f1' }])
            .build(),
        ],
      });

      const reports = await getReports();
      expect(reports).toHaveLength(1);
      expect(reports[0].name).toBe('Sprint 42');
    });

    it('filters by repository when provided', async () => {
      mockFetchAPI.mockResolvedValue({
        version: 1,
        filters: [],
        reports: [
          new ReportEntryBuilder()
            .withId('r1')
            .withName('Sprint 42')
            .withRepository('owner/repo-a')
            .build(),
          new ReportEntryBuilder()
            .withId('r2')
            .withName('Sprint 43')
            .withRepository('owner/repo-b')
            .withCreatedAt('2026-01-02T00:00:00.000Z')
            .build(),
        ],
      });

      const reports = await getReports('owner/repo-a');
      expect(reports).toHaveLength(1);
      expect(reports[0].name).toBe('Sprint 42');
    });

    it('returns empty array when no reports field', async () => {
      mockFetchAPI.mockResolvedValue({ version: 1, filters: [] });

      const reports = await getReports();
      expect(reports).toHaveLength(0);
    });
  });

  describe('saveReport', () => {
    it('creates a new report and persists the document', async () => {
      const existingFilters = [
        new SavedFilterBuilder()
          .withId('f1')
          .withName('CI Main')
          .withSection('pipelines')
          .build(),
      ];
      mockFetchAPI.mockResolvedValue({
        version: 1,
        filters: existingFilters,
        reports: [],
      });
      mockFetchPutAPI.mockResolvedValue({});

      const report = await saveReport(
        'Sprint 42',
        [{ section: 'pipelines', savedFilterId: 'f1' }],
        'owner/repo',
      );

      expect(report.name).toBe('Sprint 42');
      expect(report.repository).toBe('owner/repo');
      expect(report.sections).toEqual([
        { section: 'pipelines', savedFilterId: 'f1' },
      ]);
      expect(report.id).toBeTruthy();
      expect(report.createdAt).toBeTruthy();

      const putCall = mockFetchPutAPI.mock.calls[0];
      expect(putCall[0]).toBe('/filters');
      const writtenDoc = putCall[1];
      expect(writtenDoc.filters).toEqual(existingFilters);
      expect(writtenDoc.reports).toHaveLength(1);
      expect(writtenDoc.reports[0].name).toBe('Sprint 42');
    });

    it('throws when name is empty', async () => {
      mockFetchAPI.mockResolvedValue({ version: 1, filters: [], reports: [] });

      await expect(
        saveReport('  ', [], ''),
      ).rejects.toThrow('Sprint report name is required.');
    });

    it('preserves date overrides in the saved entry', async () => {
      mockFetchAPI.mockResolvedValue({
        version: 1,
        filters: [],
        reports: [],
      });
      mockFetchPutAPI.mockResolvedValue({});

      const report = await saveReport(
        'Sprint 42',
        [{ section: 'pipelines', savedFilterId: 'f1' }],
        'owner/repo',
        '2026-06-01',
        '2026-06-30',
      );

      expect(report.startDateOverride).toBe('2026-06-01');
      expect(report.endDateOverride).toBe('2026-06-30');
    });

    it('persists dateWindows when provided', async () => {
      mockFetchAPI.mockResolvedValue({
        version: 1,
        filters: [],
        reports: [],
      });
      mockFetchPutAPI.mockResolvedValue({});

      const dateWindows = [
        { startDate: '2026-06-01', endDate: '2026-06-07', label: 'Week 1' },
        { startDate: '2026-06-08', endDate: '2026-06-14', label: 'Week 2' },
      ];

      const report = await saveReport(
        'Sprint 42',
        [{ section: 'pipelines', savedFilterId: 'f1' }],
        'owner/repo',
        undefined,
        undefined,
        dateWindows,
      );

      expect(report.dateWindows).toEqual(dateWindows);

      const putCall = mockFetchPutAPI.mock.calls[0];
      const writtenDoc = putCall[1];
      expect(writtenDoc.reports[0].dateWindows).toEqual(dateWindows);
    });
  });

  describe('updateReport', () => {
    const existingReport = new ReportEntryBuilder()
      .withId('r1')
      .withName('Sprint 42')
      .withSections([{ section: 'pipelines', savedFilterId: 'f1' }])
      .build();

    it('updates report fields and persists the document', async () => {
      mockFetchAPI.mockResolvedValue({
        version: 1,
        filters: [],
        reports: [existingReport],
      });
      mockFetchPutAPI.mockResolvedValue({});

      const updated = await updateReport(
        'r1',
        'Sprint 43',
        [{ section: 'source-code' as const, savedFilterId: 'f2' }],
        'owner/repo',
        '2026-07-01',
        '2026-07-31',
      );

      expect(updated.name).toBe('Sprint 43');
      expect(updated.sections).toEqual([{ section: 'source-code', savedFilterId: 'f2' }]);
      expect(updated.startDateOverride).toBe('2026-07-01');
      expect(updated.endDateOverride).toBe('2026-07-31');
      expect(updated.id).toBe('r1');
      expect(updated.createdAt).toBe('2026-01-01T00:00:00.000Z');

      const writtenDoc = mockFetchPutAPI.mock.calls[0][1];
      expect(writtenDoc.reports[0].name).toBe('Sprint 43');
    });

    it('throws when report is not found', async () => {
      mockFetchAPI.mockResolvedValue({
        version: 1,
        filters: [],
        reports: [],
      });

      await expect(
        updateReport('nonexistent', 'Name', [], 'owner/repo'),
      ).rejects.toThrow('Report not found.');
    });

    it('throws when name is empty', async () => {
      mockFetchAPI.mockResolvedValue({
        version: 1,
        filters: [],
        reports: [existingReport],
      });

      await expect(
        updateReport('r1', '  ', [], 'owner/repo'),
      ).rejects.toThrow('Sprint report name is required.');
    });
  });

  describe('removeReport', () => {
    it('removes a report by id', async () => {
      const reports = [
        new ReportEntryBuilder().withId('r1').withName('Sprint 42').build(),
        new ReportEntryBuilder().withId('r2').withName('Sprint 43').withCreatedAt('2026-01-02T00:00:00.000Z').build(),
      ];
      mockFetchAPI.mockResolvedValue({
        version: 1,
        filters: [],
        reports,
      });
      mockFetchPutAPI.mockResolvedValue({});

      await removeReport('r1');

      const putCall = mockFetchPutAPI.mock.calls[0];
      expect(putCall[0]).toBe('/filters');
      const writtenDoc = putCall[1];
      expect(writtenDoc.filters).toEqual([]);
      expect(writtenDoc.reports).toHaveLength(1);
      expect(writtenDoc.reports[0].id).toBe('r2');
    });
  });
});
