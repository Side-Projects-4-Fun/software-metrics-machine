import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { METRIC_CATALOG, type MetricCatalogEntry } from '@smmachine/core';
import { MetricsCatalogController } from '../src/controllers/metrics-catalog.controller';

const controller = new MetricsCatalogController();

function ids(entries: MetricCatalogEntry[]): string[] {
  return entries.map((entry) => entry.id);
}

describe('MetricsCatalogController', () => {
  it('returns the whole catalog by default', () => {
    const response = controller.list();

    expect(response.result).toHaveLength(Object.keys(METRIC_CATALOG).length);
  });

  it('exposes the published target and sources consumed by the webapp', () => {
    const response = controller.list();
    const reviewTime = response.result.find((entry) => entry.id === 'cr-review-time');

    expect(reviewTime?.target?.description).toBe('< 24 hours');
    expect(reviewTime?.sources).toHaveLength(2);
    expect(reviewTime?.sources?.[0].url).toContain('accelerate');
  });

  it('exposes how each metric is computed', () => {
    const response = controller.list();
    const reviewTime = response.result.find((entry) => entry.id === 'cr-review-time');

    expect(reviewTime?.definition.computation.evidence).toContain('change requests');
    expect(reviewTime?.definition.computation.formula).toContain('days');
    expect(reviewTime?.definition.computation.notation).toContain('review_days');
  });

  it('filters by namespace', () => {
    const response = controller.list('eh');

    expect(ids(response.result)).toEqual([
      'deployment-frequency',
      'lead-time',
      'pipeline-duration',
      'failure-rate',
      'complexity',
      'duplication',
      'coverage',
      'review-time',
      'review-participation',
      'pair-programming',
      'knowledge-distribution',
      'coupling',
      'ownership',
      'components',
    ]);
  });

  it('filters by visibility', () => {
    const response = controller.list(undefined, 'internal');

    expect(ids(response.result)).toEqual([
      'cr-label-summary',
      'code-crap',
      'arch-container-count',
      'arch-dependency-concentration',
      'arch-hub-dependency',
      'arch-orphan-nodes',
      'arch-confidence-health',
      'issue-list',
    ]);
  });

  it('combines namespace and visibility filters', () => {
    const response = controller.list('arch', 'public');

    expect(ids(response.result)).toEqual([
      'arch-snapshot',
      'arch-summary',
      'arch-view',
      'arch-evaluation',
    ]);
  });

  it('treats empty filters as absent', () => {
    const response = controller.list('', '');

    expect(response.result).toHaveLength(Object.keys(METRIC_CATALOG).length);
  });

  it('rejects an unknown namespace', () => {
    expect(() => controller.list('unknown')).toThrow(BadRequestException);
  });

  it('rejects an unknown visibility', () => {
    expect(() => controller.list(undefined, 'private')).toThrow(BadRequestException);
  });
});
