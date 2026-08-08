import { describe, expect, it } from 'vitest';
import { getApplicationVersion } from '@smmachine/utils';
import { handleRequest } from '../src/server';

describe('MCP server request handling', () => {
  it('responds to initialize with server capabilities', async () => {
    const response = await handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {},
    });

    expect(response).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: {
        protocolVersion: '2025-06-18',
        capabilities: {
          tools: {},
          resources: {
            list: true,
            read: true,
            listChanged: false,
          },
          prompts: {
            list: true,
            get: true,
            listChanged: false,
          },
          logging: {},
        },
        serverInfo: {
          name: 'software-metrics-machine',
          version: getApplicationVersion(),
        },
      },
    });
  });

  it('responds to ping with an empty result', async () => {
    const response = await handleRequest({
      jsonrpc: '2.0',
      id: 'ping',
      method: 'ping',
      params: {},
    });

    expect(response).toEqual({
      jsonrpc: '2.0',
      id: 'ping',
      result: {},
    });
  });

  it('lists read-only SMM tools, including engineering health, DORA, and architecture', async () => {
    const response = await handleRequest({
      jsonrpc: '2.0',
      id: 'tools',
      method: 'tools/list',
      params: {},
    });

    expect(response).toMatchObject({
      jsonrpc: '2.0',
      id: 'tools',
      result: {
        tools: expect.arrayContaining([
          expect.objectContaining({ name: 'smm_list_projects' }),
          expect.objectContaining({ name: 'smm_list_engineering_health_metrics' }),
          expect.objectContaining({ name: 'smm_get_pr_metrics' }),
          expect.objectContaining({ name: 'smm_get_engineering_health' }),
          expect.objectContaining({ name: 'smm_get_dora_metrics' }),
          expect.objectContaining({ name: 'smm_get_architecture_view' }),
          expect.objectContaining({ name: 'smm_get_full_report' }),
          expect.objectContaining({ name: 'smm_evaluate_prs' }),
          expect.objectContaining({ name: 'smm_evaluate_pipelines' }),
          expect.objectContaining({ name: 'smm_evaluate_code' }),
          expect.objectContaining({ name: 'smm_evaluate_quality' }),
          expect.objectContaining({ name: 'smm_evaluate_architecture' }),
          expect.objectContaining({ name: 'smm_list_big_o_files' }),
          expect.objectContaining({ name: 'smm_analyze_big_o_file' }),
          expect.objectContaining({ name: 'smm_health_check' }),
          expect.objectContaining({ name: 'smm_get_version' }),
          expect.objectContaining({ name: 'smm_get_configuration' }),
          expect.objectContaining({ name: 'smm_list_pr_filter_options' }),
          expect.objectContaining({ name: 'smm_list_pipeline_filter_options' }),
          expect.objectContaining({ name: 'smm_list_code_authors' }),
        ]),
      },
    });
  });

  it('rejects unknown tool calls with an invalid-params error', async () => {
    const response = await handleRequest({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'smm_missing_tool' },
    });

    expect(response).toEqual({
      jsonrpc: '2.0',
      id: 3,
      error: {
        code: -32602,
        message: 'Unknown tool: smm_missing_tool',
      },
    });
  });

  it('lists MCP prompts', async () => {
    const response = await handleRequest({
      jsonrpc: '2.0',
      id: 'prompts',
      method: 'prompts/list',
      params: {},
    });

    expect(response).toMatchObject({
      jsonrpc: '2.0',
      id: 'prompts',
      result: {
        prompts: expect.arrayContaining([
          expect.objectContaining({ name: 'smm_sprint_health_review' }),
          expect.objectContaining({ name: 'smm_compare_windows' }),
          expect.objectContaining({ name: 'smm_dora_summary' }),
          expect.objectContaining({ name: 'smm_code_hotspots' }),
        ]),
      },
    });
  });

  it('returns a prompt message for smm_dora_summary', async () => {
    const response = await handleRequest({
      jsonrpc: '2.0',
      id: 'prompt-get',
      method: 'prompts/get',
      params: {
        name: 'smm_dora_summary',
        arguments: {
          project: 'owner/repo',
          startDate: '2026-07-01',
          endDate: '2026-07-31',
        },
      },
    });

    expect(response).toMatchObject({
      jsonrpc: '2.0',
      id: 'prompt-get',
      result: {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: expect.stringContaining('smm_get_dora_metrics'),
            },
          },
        ],
      },
    });
  });

  it('returns a prompt message for smm_sprint_health_review', async () => {
    const response = await handleRequest({
      jsonrpc: '2.0',
      id: 'prompt-sprint',
      method: 'prompts/get',
      params: {
        name: 'smm_sprint_health_review',
        arguments: {
          project: 'owner/repo',
          startDate: '2026-07-01',
          endDate: '2026-07-31',
        },
      },
    });

    expect(response).toMatchObject({
      jsonrpc: '2.0',
      id: 'prompt-sprint',
      result: {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: expect.stringContaining('smm_get_engineering_health'),
            },
          },
        ],
      },
    });
  });

  it('returns a prompt message for smm_compare_windows', async () => {
    const response = await handleRequest({
      jsonrpc: '2.0',
      id: 'prompt-compare',
      method: 'prompts/get',
      params: {
        name: 'smm_compare_windows',
        arguments: {
          project: 'owner/repo',
          startDate: '2026-07-01',
          endDate: '2026-07-31',
          compareStartDate: '2026-06-01',
          compareEndDate: '2026-06-30',
        },
      },
    });

    expect(response).toMatchObject({
      jsonrpc: '2.0',
      id: 'prompt-compare',
      result: {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: expect.stringContaining('smm_get_engineering_health'),
            },
          },
        ],
      },
    });
  });

  it('returns a prompt message for smm_code_hotspots', async () => {
    const response = await handleRequest({
      jsonrpc: '2.0',
      id: 'prompt-hotspots',
      method: 'prompts/get',
      params: {
        name: 'smm_code_hotspots',
        arguments: {
          project: 'owner/repo',
          startDate: '2026-07-01',
          endDate: '2026-07-31',
        },
      },
    });

    expect(response).toMatchObject({
      jsonrpc: '2.0',
      id: 'prompt-hotspots',
      result: {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: expect.stringContaining('smm_get_code_metrics'),
            },
          },
        ],
      },
    });
  });

  it('rejects prompts/get for an unknown prompt', async () => {
    const response = await handleRequest({
      jsonrpc: '2.0',
      id: 'prompt-missing',
      method: 'prompts/get',
      params: { name: 'does_not_exist' },
    });

    expect(response).toEqual({
      jsonrpc: '2.0',
      id: 'prompt-missing',
      error: {
        code: -32602,
        message: 'Unknown prompt: does_not_exist',
      },
    });
  });

  it('lists resource templates', async () => {
    const response = await handleRequest({
      jsonrpc: '2.0',
      id: 'templates',
      method: 'resources/templates/list',
      params: {},
    });

    expect(response).toMatchObject({
      jsonrpc: '2.0',
      id: 'templates',
      result: {
        resourceTemplates: expect.arrayContaining([
          expect.objectContaining({
            uriTemplate: 'smm://project/{project}/engineering-health',
          }),
          expect.objectContaining({
            uriTemplate: 'smm://project/{project}/dora',
          }),
          expect.objectContaining({
            uriTemplate: 'smm://project/{project}/architecture/snapshots',
          }),
          expect.objectContaining({
            uriTemplate: 'smm://project/{project}/evaluation/prs',
          }),
          expect.objectContaining({
            uriTemplate: 'smm://project/{project}/evaluation/pipelines',
          }),
          expect.objectContaining({
            uriTemplate: 'smm://project/{project}/evaluation/code',
          }),
          expect.objectContaining({
            uriTemplate: 'smm://project/{project}/evaluation/quality',
          }),
          expect.objectContaining({
            uriTemplate: 'smm://project/{project}/evaluation/architecture',
          }),
          expect.objectContaining({
            uriTemplate: 'smm://project/{project}/big-o',
          }),
          expect.objectContaining({
            uriTemplate: 'smm://project/{project}/health-check',
          }),
        ]),
      },
    });
  });

  it('accepts logging/setLevel with a valid level', async () => {
    const response = await handleRequest({
      jsonrpc: '2.0',
      id: 'log-debug',
      method: 'logging/setLevel',
      params: { level: 'debug' },
    });

    expect(response).toEqual({
      jsonrpc: '2.0',
      id: 'log-debug',
      result: {},
    });
  });

  it('accepts logging/setLevel with info level', async () => {
    const response = await handleRequest({
      jsonrpc: '2.0',
      id: 'log-info',
      method: 'logging/setLevel',
      params: { level: 'info' },
    });

    expect(response).toEqual({
      jsonrpc: '2.0',
      id: 'log-info',
      result: {},
    });
  });

  it('rejects logging/setLevel with an invalid level', async () => {
    const response = await handleRequest({
      jsonrpc: '2.0',
      id: 'log-invalid',
      method: 'logging/setLevel',
      params: { level: 'verbose' },
    });

    expect(response).toEqual({
      jsonrpc: '2.0',
      id: 'log-invalid',
      error: {
        code: -32602,
        message: 'Invalid log level: verbose. Must be debug, info, or critical.',
      },
    });
  });

  it('rejects logging/setLevel without a level parameter', async () => {
    const response = await handleRequest({
      jsonrpc: '2.0',
      id: 'log-missing',
      method: 'logging/setLevel',
      params: {},
    });

    expect(response).toEqual({
      jsonrpc: '2.0',
      id: 'log-missing',
      error: {
        code: -32602,
        message: 'logging/setLevel requires a level parameter',
      },
    });
  });

  it('returns method-not-found errors for unknown methods', async () => {
    const response = await handleRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'missing/method',
      params: {},
    });

    expect(response).toEqual({
      jsonrpc: '2.0',
      id: 2,
      error: {
        code: -32601,
        message: 'Method not found: missing/method',
      },
    });
  });
});
