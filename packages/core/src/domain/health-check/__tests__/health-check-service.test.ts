import { describe, it, expect } from 'vitest';
import { HealthCheckService, type DatasetCheck } from '../health-check-service';

describe('HealthCheckService.getDatasetLevel', () => {
  it('returns error when the dataset does not exist', () => {
    const dataset: DatasetCheck = {
      id: 'github.change-requests',
      source: 'SQLite table: change_requests',
      exists: false,
      itemCount: 0,
      invalidDateCount: 0,
      potentialGapDays: 0,
      potentialGapRanges: [],
      missingRequiredFields: {},
      notes: [],
    };

    expect(HealthCheckService.getDatasetLevel(dataset)).toBe('error');
  });

  it('returns error when the dataset exists but has zero items', () => {
    const dataset: DatasetCheck = {
      id: 'github.change-requests',
      source: 'SQLite table: change_requests',
      exists: true,
      itemCount: 0,
      invalidDateCount: 0,
      potentialGapDays: 0,
      potentialGapRanges: [],
      missingRequiredFields: {},
      notes: [],
    };

    expect(HealthCheckService.getDatasetLevel(dataset)).toBe('error');
  });

  it('returns warning when staleDays is greater than 7', () => {
    const dataset: DatasetCheck = {
      id: 'github.change-requests',
      source: 'SQLite table: change_requests',
      exists: true,
      itemCount: 10,
      staleDays: 14,
      invalidDateCount: 0,
      potentialGapDays: 0,
      potentialGapRanges: [],
      missingRequiredFields: {},
      notes: [],
    };

    expect(HealthCheckService.getDatasetLevel(dataset)).toBe('warning');
  });

  it('returns healthy when staleDays is exactly 7', () => {
    const dataset: DatasetCheck = {
      id: 'github.change-requests',
      source: 'SQLite table: change_requests',
      exists: true,
      itemCount: 10,
      staleDays: 7,
      invalidDateCount: 0,
      potentialGapDays: 0,
      potentialGapRanges: [],
      missingRequiredFields: {},
      notes: [],
    };

    expect(HealthCheckService.getDatasetLevel(dataset)).toBe('healthy');
  });

  it('returns warning when there are invalid date records', () => {
    const dataset: DatasetCheck = {
      id: 'github.change-requests',
      source: 'SQLite table: change_requests',
      exists: true,
      itemCount: 10,
      invalidDateCount: 3,
      potentialGapDays: 0,
      potentialGapRanges: [],
      missingRequiredFields: {},
      notes: [],
    };

    expect(HealthCheckService.getDatasetLevel(dataset)).toBe('warning');
  });

  it('returns warning when there are potential coverage gaps', () => {
    const dataset: DatasetCheck = {
      id: 'github.change-requests',
      source: 'SQLite table: change_requests',
      exists: true,
      itemCount: 10,
      invalidDateCount: 0,
      potentialGapDays: 5,
      potentialGapRanges: [{ start: '2025-01-02', end: '2025-01-06', days: 5 }],
      missingRequiredFields: {},
      notes: [],
    };

    expect(HealthCheckService.getDatasetLevel(dataset)).toBe('warning');
  });

  it('returns warning when a required field has missing values', () => {
    const dataset: DatasetCheck = {
      id: 'github.change-requests',
      source: 'SQLite table: change_requests',
      exists: true,
      itemCount: 10,
      invalidDateCount: 0,
      potentialGapDays: 0,
      potentialGapRanges: [],
      missingRequiredFields: { state: 2 },
      notes: [],
    };

    expect(HealthCheckService.getDatasetLevel(dataset)).toBe('warning');
  });

  it('returns warning when notes are present', () => {
    const dataset: DatasetCheck = {
      id: 'github.change-requests',
      source: 'SQLite table: change_requests',
      exists: true,
      itemCount: 10,
      invalidDateCount: 0,
      potentialGapDays: 0,
      potentialGapRanges: [],
      missingRequiredFields: {},
      notes: ['Dataset not found in SQLite cache.'],
    };

    expect(HealthCheckService.getDatasetLevel(dataset)).toBe('warning');
  });

  it('returns healthy for a clean dataset with no issues', () => {
    const dataset: DatasetCheck = {
      id: 'github.change-requests',
      source: 'SQLite table: change_requests',
      exists: true,
      itemCount: 42,
      staleDays: 1,
      invalidDateCount: 0,
      potentialGapDays: 0,
      potentialGapRanges: [],
      missingRequiredFields: { id: 0, created_at: 0, updated_at: 0, state: 0 },
      notes: [],
    };

    expect(HealthCheckService.getDatasetLevel(dataset)).toBe('healthy');
  });
});
