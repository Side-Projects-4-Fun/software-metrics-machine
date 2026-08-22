import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { getApplicationVersion } from '@smmachine/utils';
import { createMcpServer } from '../src/server';

/**
 * Integration tests for the SDK-based MCP server.
 *
 * These tests create a `McpServer` via `createMcpServer()`, connect it to an
 * in-memory transport, and drive it with a real `Client` instance. This
 * exercises the full SDK request/response cycle (initialize, tools/list,
 * tools/call, resources/list, resources/templates/list, prompts/list,
 * prompts/get, logging/setLevel, ping) end-to-end.
 */

async function createConnectedClient(): Promise<{
  client: Client;
  cleanup: () => Promise<void>;
}> {
  const server = createMcpServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const client = new Client({
    name: 'test-client',
    version: '1.0.0',
  });
  await client.connect(clientTransport);

  return {
    client,
    cleanup: async () => {
      await client.close();
      await server.close();
    },
  };
}

describe('MCP server (SDK-based)', () => {
  let client: Client;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const connected = await createConnectedClient();
    client = connected.client;
    cleanup = connected.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  it('responds to initialize with server capabilities', async () => {
    // The Client already sent initialize during connect. We can inspect the
    // server info via the client's getServerVersion() helper.
    const serverVersion = client.getServerVersion();
    expect(serverVersion).toEqual({
      name: 'software-metrics-machine',
      version: getApplicationVersion(),
    });

    const capabilities = client.getServerCapabilities();
    expect(capabilities).toMatchObject({
      tools: expect.any(Object),
      resources: expect.any(Object),
      prompts: expect.any(Object),
      logging: expect.any(Object),
    });
  });

  it('responds to ping', async () => {
    const result = await client.ping();
    expect(result).toEqual({});
  });

  it('lists read-only SMM tools, including engineering health, DORA, and architecture', async () => {
    const response = await client.listTools();

    expect(response.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'smm_list_projects' }),
        expect.objectContaining({ name: 'smm_list_engineering_health_metrics' }),
        expect.objectContaining({ name: 'smm_get_change_request_metrics' }),
        expect.objectContaining({ name: 'smm_get_engineering_health' }),
        expect.objectContaining({ name: 'smm_get_dora_metrics' }),
        expect.objectContaining({ name: 'smm_get_architecture_view' }),
        expect.objectContaining({ name: 'smm_get_full_report' }),
        expect.objectContaining({ name: 'smm_evaluate_change_requests' }),
        expect.objectContaining({ name: 'smm_evaluate_pipelines' }),
        expect.objectContaining({ name: 'smm_evaluate_code' }),
        expect.objectContaining({ name: 'smm_evaluate_quality' }),
        expect.objectContaining({ name: 'smm_evaluate_architecture' }),
        expect.objectContaining({ name: 'smm_list_big_o_files' }),
        expect.objectContaining({ name: 'smm_analyze_big_o_file' }),
        expect.objectContaining({ name: 'smm_health_check' }),
        expect.objectContaining({ name: 'smm_get_version' }),
        expect.objectContaining({ name: 'smm_get_configuration' }),
        expect.objectContaining({ name: 'smm_list_change_request_filter_options' }),
        expect.objectContaining({ name: 'smm_list_pipeline_filter_options' }),
        expect.objectContaining({ name: 'smm_list_code_authors' }),
        expect.objectContaining({ name: 'smm_get_change_request_summary' }),
        expect.objectContaining({ name: 'smm_get_change_request_through_time' }),
        expect.objectContaining({ name: 'smm_get_change_request_by_author' }),
        expect.objectContaining({ name: 'smm_get_change_request_review_time' }),
        expect.objectContaining({ name: 'smm_get_change_request_open_time' }),
        expect.objectContaining({ name: 'smm_get_change_request_comments' }),
        expect.objectContaining({ name: 'smm_get_change_request_comments_by_author' }),
        expect.objectContaining({ name: 'smm_get_change_request_first_comment_time' }),
        expect.objectContaining({ name: 'smm_get_change_request_metrics_by_month' }),
        expect.objectContaining({ name: 'smm_get_change_request_metrics_by_week' }),
        expect.objectContaining({ name: 'smm_get_pipeline_dashboard' }),
        expect.objectContaining({ name: 'smm_get_code_pairing_index' }),
        expect.objectContaining({ name: 'smm_get_code_churn' }),
        expect.objectContaining({ name: 'smm_get_code_churn_history' }),
        expect.objectContaining({ name: 'smm_get_code_coupling' }),
        expect.objectContaining({ name: 'smm_get_code_coupling_history' }),
        expect.objectContaining({ name: 'smm_get_code_layered_coupling' }),
        expect.objectContaining({ name: 'smm_get_code_layered_coupling_history' }),
        expect.objectContaining({ name: 'smm_get_code_entity_churn' }),
        expect.objectContaining({ name: 'smm_get_code_entity_churn_history' }),
        expect.objectContaining({ name: 'smm_get_code_entity_effort' }),
        expect.objectContaining({ name: 'smm_get_code_entity_effort_history' }),
        expect.objectContaining({ name: 'smm_get_code_entity_ownership' }),
        expect.objectContaining({ name: 'smm_get_code_entity_ownership_history' }),
        expect.objectContaining({ name: 'smm_get_sonarqube_component_tree' }),
        expect.objectContaining({ name: 'smm_get_sonarqube_component_tree_history' }),
        expect.objectContaining({ name: 'smm_get_sonarqube_measurements' }),
        expect.objectContaining({ name: 'smm_get_sonarqube_measurements_history' }),
        expect.objectContaining({ name: 'smm_get_architecture_summary' }),
        expect.objectContaining({ name: 'smm_export_architecture_view' }),
        expect.objectContaining({ name: 'smm_list_saved_filters' }),
        expect.objectContaining({ name: 'smm_get_saved_filter' }),
      ])
    );
  });

  it('returns an error result for unknown tool calls', async () => {
    const result = await client.callTool({
      name: 'smm_missing_tool',
      arguments: {},
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'text',
          text: expect.stringContaining('smm_missing_tool'),
        }),
      ])
    );
  });

  it('lists MCP prompts', async () => {
    const response = await client.listPrompts();

    expect(response.prompts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'smm_sprint_health_review' }),
        expect.objectContaining({ name: 'smm_compare_windows' }),
        expect.objectContaining({ name: 'smm_dora_summary' }),
        expect.objectContaining({ name: 'smm_code_hotspots' }),
      ])
    );
  });

  it('returns a prompt message for smm_dora_summary', async () => {
    const response = await client.getPrompt({
      name: 'smm_dora_summary',
      arguments: {
        project: 'owner/repo',
        startDate: '2026-07-01',
        endDate: '2026-07-31',
      },
    });

    expect(response.messages).toEqual([
      {
        role: 'user',
        content: {
          type: 'text',
          text: expect.stringContaining('smm_get_dora_metrics'),
        },
      },
    ]);
  });

  it('returns a prompt message for smm_sprint_health_review', async () => {
    const response = await client.getPrompt({
      name: 'smm_sprint_health_review',
      arguments: {
        project: 'owner/repo',
        startDate: '2026-07-01',
        endDate: '2026-07-31',
      },
    });

    expect(response.messages).toEqual([
      {
        role: 'user',
        content: {
          type: 'text',
          text: expect.stringContaining('smm_get_engineering_health'),
        },
      },
    ]);
  });

  it('returns a prompt message for smm_compare_windows', async () => {
    const response = await client.getPrompt({
      name: 'smm_compare_windows',
      arguments: {
        project: 'owner/repo',
        startDate: '2026-07-01',
        endDate: '2026-07-31',
        compareStartDate: '2026-06-01',
        compareEndDate: '2026-06-30',
      },
    });

    expect(response.messages).toEqual([
      {
        role: 'user',
        content: {
          type: 'text',
          text: expect.stringContaining('smm_get_engineering_health'),
        },
      },
    ]);
  });

  it('returns a prompt message for smm_code_hotspots', async () => {
    const response = await client.getPrompt({
      name: 'smm_code_hotspots',
      arguments: {
        project: 'owner/repo',
        startDate: '2026-07-01',
        endDate: '2026-07-31',
      },
    });

    expect(response.messages).toEqual([
      {
        role: 'user',
        content: {
          type: 'text',
          text: expect.stringContaining('smm_get_code_metrics'),
        },
      },
    ]);
  });

  it('rejects prompts/get for an unknown prompt', async () => {
    await expect(
      client.getPrompt({
        name: 'does_not_exist',
        arguments: {},
      })
    ).rejects.toThrow();
  });

  it('lists resource templates', async () => {
    const response = await client.listResourceTemplates();

    expect(response.resourceTemplates).toEqual(
      expect.arrayContaining([
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
          uriTemplate: 'smm://project/{project}/evaluation/change-requests',
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
        expect.objectContaining({
          uriTemplate: 'smm://project/{project}/architecture/summary',
        }),
        expect.objectContaining({
          uriTemplate: 'smm://project/{project}/pipeline-dashboard',
        }),
        expect.objectContaining({
          uriTemplate: 'smm://project/{project}/saved-filters',
        }),
        expect.objectContaining({
          uriTemplate: 'smm://project/{project}/sonarqube/measurements',
        }),
        expect.objectContaining({
          uriTemplate: 'smm://project/{project}/sonarqube/measurements/history',
        }),
        expect.objectContaining({
          uriTemplate: 'smm://project/{project}/sonarqube/component-tree',
        }),
        expect.objectContaining({
          uriTemplate: 'smm://project/{project}/sonarqube/component-tree/history',
        }),
      ])
    );
  });

  it('accepts logging/setLevel with a valid level', async () => {
    // The SDK handles logging/setLevel internally. Calling setLoggingLevel via
    // the client should not throw.
    await expect(client.setLoggingLevel('debug')).resolves.toBeDefined();
  });

  it('accepts logging/setLevel with info level', async () => {
    await expect(client.setLoggingLevel('info')).resolves.toBeDefined();
  });

  it('rejects logging/setLevel with an invalid level', async () => {
    await expect(client.setLoggingLevel('verbose' as never)).rejects.toThrow();
  });

  it('returns method-not-found errors for unknown methods', async () => {
    // The SDK's Protocol.request method rejects unknown methods at the client
    // side before they reach the server. We verify this by sending a raw
    // request via the protected request method.
    await expect(
      (client as never as { request: (req: unknown, schema: unknown) => Promise<unknown> }).request(
        { method: 'missing/method' },
        {}
      )
    ).rejects.toThrow();
  });
});
