import { describe, expect, it } from 'vitest';
import { METRIC_CATALOG } from '@smmachine/core';
import { tools, type RegisteredTool } from '../src/tools';

/**
 * Tools that are deliberately not metric surfaces. Every other tool must be
 * catalogued; adding a new tool forces a decision here.
 */
const NON_METRIC_MCP_TOOLS = new Set<string>([
  // Infrastructure and configuration.
  'smm_get_configuration',
  'smm_get_version',
  'smm_health_check',
  // Catalog discovery.
  'smm_list_engineering_health_metrics',
  'smm_list_metrics',
  // Filter-option endpoints.
  'smm_list_change_request_filter_options',
  'smm_list_code_authors',
  'smm_list_pipeline_filter_options',
  // Saved-filter management.
  'smm_get_saved_filter',
  'smm_list_saved_filters',
  // Project discovery.
  'smm_list_projects',
  // Composite report aggregator.
  'smm_get_full_report',
]);

interface ListMetricsPayload {
  metrics: Array<{ id: string }>;
}

function catalogMcpTools(): string[] {
  return Object.values(METRIC_CATALOG).flatMap((definition) => definition.surfaces.mcp ?? []);
}

function toolNames(): string[] {
  return tools.map((tool) => tool.name);
}

function missingMcpTools(): string[] {
  const available = new Set(toolNames());

  return catalogMcpTools().filter((tool) => !available.has(tool));
}

function uncataloguedMcpTools(): string[] {
  const catalogued = new Set(catalogMcpTools());

  return toolNames().filter((tool) => !catalogued.has(tool) && !NON_METRIC_MCP_TOOLS.has(tool));
}

function staleAllowlistEntries(): string[] {
  return catalogMcpTools().filter((tool) => NON_METRIC_MCP_TOOLS.has(tool));
}

function findListMetricsTool(): RegisteredTool {
  const tool = tools.find((candidate) => candidate.name === 'smm_list_metrics');

  if (!tool) {
    throw new Error('smm_list_metrics is not registered');
  }

  return tool;
}

async function listMetrics(args?: unknown): Promise<ListMetricsPayload> {
  const result = await findListMetricsTool().handler(args);

  return result.structuredContent as ListMetricsPayload;
}

describe('metric catalog MCP coverage', () => {
  it('exposes every catalogued MCP tool', () => {
    expect(missingMcpTools()).toEqual([]);
  });

  it('classifies every tool as metric or explicitly non-metric', () => {
    expect(uncataloguedMcpTools()).toEqual([]);
  });

  it('does not allowlist a tool that is actually catalogued', () => {
    expect(staleAllowlistEntries()).toEqual([]);
  });

  it('registers smm_list_metrics', () => {
    expect(toolNames()).toContain('smm_list_metrics');
  });

  it('returns every metric by default', async () => {
    const payload = await listMetrics();

    expect(payload.metrics).toHaveLength(Object.keys(METRIC_CATALOG).length);
  });

  it('filters by namespace', async () => {
    const payload = await listMetrics({ namespace: 'eh' });

    expect(payload.metrics).toHaveLength(14);
  });

  it('filters by visibility', async () => {
    const payload = await listMetrics({ visibility: 'internal' });

    expect(payload.metrics).toHaveLength(8);
  });

  it('rejects an unknown namespace', async () => {
    await expect(listMetrics({ namespace: 'unknown' })).rejects.toThrow('Invalid namespace');
  });

  it('rejects an unknown visibility', async () => {
    await expect(listMetrics({ visibility: 'private' })).rejects.toThrow('Invalid visibility');
  });
});
