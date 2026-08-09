import {
  getSavedFilters,
  getSavedFiltersBySection,
} from '@/components/filters/saved-filters-actions';
import * as api from '@/server/api';
import { SavedFilterBuilder } from '../builders/builders';

jest.mock('@/server/api');

const mockFetchAPI = api.fetchAPI as jest.Mock;

describe('saved-filters-actions', () => {
  describe('getSavedFilters', () => {
    it('fetches saved views without the active project so the home page shows all projects', async () => {
      mockFetchAPI.mockResolvedValue({
        version: 1,
        filters: [
          new SavedFilterBuilder()
            .withId('f-a')
            .withName('Repo A View')
            .withSection('pipelines')
            .withRepository('owner/repo-a')
            .build(),
          new SavedFilterBuilder()
            .withId('f-b')
            .withName('Repo B View')
            .withSection('source-code')
            .withRepository('owner/repo-b')
            .build(),
        ],
        reports: [],
      });

      const filters = await getSavedFilters();

      expect(mockFetchAPI).toHaveBeenCalledWith('/filters', undefined, {
        skipProjectParam: true,
      });
      expect(filters).toHaveLength(2);
    });
  });

  describe('getSavedFiltersBySection', () => {
    it('keeps the project-scoped read for section pages', async () => {
      mockFetchAPI.mockResolvedValue({
        version: 1,
        filters: [
          new SavedFilterBuilder()
            .withId('f-a')
            .withName('Repo A Pipeline View')
            .withSection('pipelines')
            .withRepository('owner/repo-a')
            .build(),
          new SavedFilterBuilder()
            .withId('f-b')
            .withName('Repo B Pipeline View')
            .withSection('pipelines')
            .withRepository('owner/repo-b')
            .build(),
        ],
        reports: [],
      });

      const filters = await getSavedFiltersBySection('pipelines', 'owner/repo-a');

      expect(mockFetchAPI).toHaveBeenCalledWith('/filters', undefined, undefined);
      expect(filters).toHaveLength(1);
      expect(filters[0].id).toBe('f-a');
    });
  });
});
