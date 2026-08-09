import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Logger } from '@smmachine/utils';
import { ConfigurationRepository } from '@smmachine/core';
import type { DashboardFilters, SavedFiltersDocument } from '@smmachine/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FiltersController } from '../src/controllers/filters.controller';

const logger = new Logger('FiltersControllerTest', 'CRITICAL');

const minimalDashboardFilters: DashboardFilters = {
  startDate: '',
  endDate: '',
  workflowStatus: [],
  workflowConclusions: [],
  jobSelector: [],
  branch: [],
  event: [],
  authorSelect: [],
  excludeAuthorSelect: [],
  excludeCommenterSelect: [],
  labelSelector: [],
  weekends: 'include',
  outlierMode: 'include',
  compareStartDate: '',
  compareEndDate: '',
  rawFilters: '',
  period: 'week',
  ignorePatternFiles: '',
  includePatternFiles: '',
  authorSelectSourceCode: [],
  topEntries: 20,
  aggregateMetric: 'avg',
  sonarqubeRemoveFolders: true,
};

describe('FiltersController', () => {
  let tempDir: string;

  function createController(): FiltersController {
    const configRepository = new ConfigurationRepository(
      { SMM_STORE_DATA_AT: tempDir },
      undefined,
      logger
    );
    return new FiltersController(configRepository.getActiveConfiguration(), configRepository);
  }

  function writeSavedFilters(project: string, document: SavedFiltersDocument): void {
    const baseDir = join(tempDir, `github_${project.replace('/', '_')}`);
    mkdirSync(baseDir, { recursive: true });
    writeFileSync(join(baseDir, 'saved-filters.json'), JSON.stringify(document), 'utf-8');
  }

  function repoAEntry(): SavedFiltersDocument['filters'][number] {
    return {
      id: 'filter-a',
      name: 'Repo A Pipeline View',
      section: 'pipelines',
      filters: minimalDashboardFilters,
      repository: 'org/repo-a',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
  }

  function repoBEntry(): SavedFiltersDocument['filters'][number] {
    return {
      id: 'filter-b',
      name: 'Repo B Source Code View',
      section: 'source-code',
      filters: minimalDashboardFilters,
      repository: 'org/repo-b',
      createdAt: '2026-01-02T00:00:00.000Z',
    };
  }

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'smm-filters-controller-'));
    writeFileSync(
      join(tempDir, 'smm_config.json'),
      JSON.stringify({
        projects: [
          { github_repository: 'org/repo-a', git_repository_location: '/tmp/repo-a' },
          { github_repository: 'org/repo-b', git_repository_location: '/tmp/repo-b' },
        ],
      }),
      'utf-8'
    );
  });

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  it('returns only the saved views of the given project when a project is requested', async () => {
    writeSavedFilters('org/repo-a', {
      version: 1,
      filters: [repoAEntry()],
      reports: [
        {
          id: 'report-a',
          name: 'Sprint 42',
          repository: 'org/repo-a',
          sections: [{ section: 'pipelines', savedFilterId: 'filter-a' }],
          createdAt: '2026-01-03T00:00:00.000Z',
        },
      ],
    });
    writeSavedFilters('org/repo-b', {
      version: 1,
      filters: [repoBEntry()],
    });

    const controller = createController();
    const result = await controller.getAllFilters('org/repo-b');

    expect(result.version).toBe(1);
    expect(result.filters).toHaveLength(1);
    expect(result.filters[0].name).toBe('Repo B Source Code View');
    expect(result.reports).toHaveLength(0);
  });

  it('aggregates saved views from every project when no project is given', async () => {
    writeSavedFilters('org/repo-a', {
      version: 1,
      filters: [repoAEntry()],
      reports: [
        {
          id: 'report-a',
          name: 'Sprint 42',
          repository: 'org/repo-a',
          sections: [{ section: 'pipelines', savedFilterId: 'filter-a' }],
          createdAt: '2026-01-03T00:00:00.000Z',
        },
      ],
    });
    writeSavedFilters('org/repo-b', {
      version: 1,
      filters: [repoBEntry()],
      reports: [
        {
          id: 'report-b',
          name: 'Sprint 43',
          repository: 'org/repo-b',
          sections: [{ section: 'source-code', savedFilterId: 'filter-b' }],
          createdAt: '2026-01-04T00:00:00.000Z',
        },
      ],
    });

    const controller = createController();
    const result = await controller.getAllFilters(undefined);

    expect(result.version).toBe(1);
    expect(result.filters).toHaveLength(2);
    expect(result.filters.map((entry) => entry.name)).toEqual([
      'Repo A Pipeline View',
      'Repo B Source Code View',
    ]);
    expect(result.reports).toHaveLength(2);
    expect(result.reports?.map((report) => report.name)).toEqual(['Sprint 42', 'Sprint 43']);
  });

  it('returns an empty document when no project has saved views', async () => {
    const controller = createController();
    const result = await controller.getAllFilters(undefined);

    expect(result).toEqual({ version: 1, filters: [], reports: [] });
  });

  it('falls back to the active configuration when an unknown project is requested', async () => {
    writeSavedFilters('org/repo-a', {
      version: 1,
      filters: [repoAEntry()],
    });
    writeSavedFilters('org/repo-b', {
      version: 1,
      filters: [repoBEntry()],
    });

    const controller = createController();
    const result = await controller.getAllFilters('org/unknown');

    expect(result.filters).toHaveLength(1);
    expect(result.filters[0].repository).toBe('org/repo-a');
  });
});
