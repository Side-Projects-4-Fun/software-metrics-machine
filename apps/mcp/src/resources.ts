import { ConfigurationRepository } from '@smmachine/core';
import { Logger } from '@smmachine/utils';
import { resourceLogger } from './mcp-logger';
import { createMcpMetricsReader } from './metrics-reader';
import type { JsonValue, McpResourceDefinition, McpResourceTemplateDefinition } from './mcp-types';
import { redactSecrets } from './redaction';
import { listEngineeringHealthMetricCatalog } from './validation';

export type ResourceReadResult = {
  contents: Array<{
    uri: string;
    mimeType: string;
    text: string;
  }>;
};

function getConfigurationRepository(): ConfigurationRepository {
  return new ConfigurationRepository(
    process.env,
    undefined,
    new Logger('SmmMcpServer', 'CRITICAL')
  );
}

function encodeProject(project: string): string {
  return encodeURIComponent(project);
}

function decodeProject(project: string): string {
  return decodeURIComponent(project);
}

function jsonResource(uri: string, value: JsonValue): ResourceReadResult {
  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

export function listResourceTemplates(): McpResourceTemplateDefinition[] {
  return [
    {
      uriTemplate: 'smm://project/{project}/engineering-health',
      name: 'Project engineering health',
      description:
        'Full engineering health evaluation (delivery, quality, collaboration, architecture) for a project.',
      mimeType: 'application/json',
    },
    {
      uriTemplate: 'smm://project/{project}/dora',
      name: 'Project DORA metrics',
      description: 'DORA and pipeline metrics for a project.',
      mimeType: 'application/json',
    },
    {
      uriTemplate: 'smm://project/{project}/architecture/snapshots',
      name: 'Project architecture snapshots',
      description: 'List of architecture snapshots stored for a project.',
      mimeType: 'application/json',
    },
  ];
}

export function listResources(): McpResourceDefinition[] {
  const repository = getConfigurationRepository();
  const projects = repository.getAllProjectNames();

  return [
    {
      uri: 'smm://projects',
      name: 'SMM projects',
      description: 'Configured Software Metrics Machine projects.',
      mimeType: 'application/json',
    },
    {
      uri: 'smm://engineering-health/metrics',
      name: 'Engineering health metric catalog',
      description:
        'Metric ids, categories, and labels available for engineering health evaluations.',
      mimeType: 'application/json',
    },
    ...projects.flatMap((project) => [
      {
        uri: `smm://project/${encodeProject(project)}/configuration`,
        name: `${project} configuration`,
        description: 'Redacted project configuration.',
        mimeType: 'application/json',
      },
      {
        uri: `smm://project/${encodeProject(project)}/report`,
        name: `${project} report`,
        description: 'Complete metrics report for the project.',
        mimeType: 'application/json',
      },
      {
        uri: `smm://project/${encodeProject(project)}/engineering-health`,
        name: `${project} engineering health`,
        description: 'Engineering health evaluation for the project.',
        mimeType: 'application/json',
      },
      {
        uri: `smm://project/${encodeProject(project)}/dora`,
        name: `${project} DORA metrics`,
        description: 'DORA and pipeline metrics for the project.',
        mimeType: 'application/json',
      },
      {
        uri: `smm://project/${encodeProject(project)}/architecture/snapshots`,
        name: `${project} architecture snapshots`,
        description: 'Architecture snapshots stored for the project.',
        mimeType: 'application/json',
      },
    ]),
  ];
}

export async function readResource(uri: string): Promise<ResourceReadResult> {
  const resourceStartedAt = Date.now();
  resourceLogger.debug(`Reading resource ${uri}`);
  const repository = getConfigurationRepository();

  if (uri === 'smm://projects') {
    resourceLogger.debug('Listing projects for resource smm://projects');
    const result = jsonResource(uri, {
      projects: repository.getAllProjects().map((project) => ({
        github_repository: project.github_repository,
        git_provider: project.git_provider,
      })),
    });
    resourceLogger.debug(`Read resource ${uri} in ${Date.now() - resourceStartedAt}ms`);
    return result;
  }

  if (uri === 'smm://engineering-health/metrics') {
    resourceLogger.debug('Returning engineering health metric catalog');
    const result = jsonResource(uri, {
      categories: ['delivery', 'quality', 'collaboration', 'architecture'],
      metrics: listEngineeringHealthMetricCatalog(),
    } as unknown as JsonValue);
    resourceLogger.debug(`Read resource ${uri} in ${Date.now() - resourceStartedAt}ms`);
    return result;
  }

  const match = uri.match(
    /^smm:\/\/project\/([^/]+)\/(configuration|report|engineering-health|dora|architecture\/snapshots)$/
  );
  if (!match) {
    resourceLogger.warn(`Unknown MCP resource requested: ${uri}`);
    throw new Error(`Unknown MCP resource: ${uri}`);
  }

  const projectName = decodeProject(match[1]);
  const resourceType = match[2];
  resourceLogger.debug(`Resolved resource ${uri}`, { projectName, resourceType });

  const project = repository.getProjectByName(projectName);
  if (!project) {
    resourceLogger.warn(`Unknown project for resource ${uri}: ${projectName}`);
    throw new Error(`Unknown project: ${projectName}`);
  }

  if (resourceType === 'configuration') {
    resourceLogger.debug(`Returning redacted configuration for ${projectName}`);
    const result = jsonResource(uri, redactSecrets(project as JsonValue));
    resourceLogger.debug(`Read resource ${uri} in ${Date.now() - resourceStartedAt}ms`);
    return result;
  }

  const reader = createMcpMetricsReader({ project: projectName });

  if (resourceType === 'report') {
    const result = jsonResource(uri, (await reader.getFullReport()) as JsonValue);
    resourceLogger.debug(`Read resource ${uri} in ${Date.now() - resourceStartedAt}ms`);
    return result;
  }

  if (resourceType === 'engineering-health') {
    const result = jsonResource(
      uri,
      (await reader.getEngineeringHealthEvaluation({ project: projectName })) as JsonValue
    );
    resourceLogger.debug(`Read resource ${uri} in ${Date.now() - resourceStartedAt}ms`);
    return result;
  }

  if (resourceType === 'dora') {
    const result = jsonResource(
      uri,
      (await reader.getDoraMetrics({ project: projectName })) as JsonValue
    );
    resourceLogger.debug(`Read resource ${uri} in ${Date.now() - resourceStartedAt}ms`);
    return result;
  }

  const snapshotsResult = jsonResource(
    uri,
    (await reader.listArchitectureSnapshots()) as JsonValue
  );
  resourceLogger.debug(`Read resource ${uri} in ${Date.now() - resourceStartedAt}ms`);
  return snapshotsResult;
}
