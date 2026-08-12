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
    {
      uriTemplate: 'smm://project/{project}/architecture/summary',
      name: 'Project architecture summary',
      description: 'Architecture snapshot metadata for the latest snapshot of a project.',
      mimeType: 'application/json',
    },
    {
      uriTemplate: 'smm://project/{project}/pipeline-dashboard',
      name: 'Project pipeline dashboard',
      description: 'Full pipeline dashboard for a project.',
      mimeType: 'application/json',
    },
    {
      uriTemplate: 'smm://project/{project}/evaluation/change-requests',
      name: 'Project change request evaluation',
      description: 'Change request health evaluation for a project.',
      mimeType: 'application/json',
    },
    {
      uriTemplate: 'smm://project/{project}/evaluation/pipelines',
      name: 'Project pipeline evaluation',
      description: 'Pipeline health evaluation for a project.',
      mimeType: 'application/json',
    },
    {
      uriTemplate: 'smm://project/{project}/evaluation/code',
      name: 'Project code evaluation',
      description: 'Code health evaluation for a project.',
      mimeType: 'application/json',
    },
    {
      uriTemplate: 'smm://project/{project}/evaluation/quality',
      name: 'Project quality evaluation',
      description: 'SonarQube quality evaluation for a project.',
      mimeType: 'application/json',
    },
    {
      uriTemplate: 'smm://project/{project}/evaluation/architecture',
      name: 'Project architecture evaluation',
      description: 'Architecture health evaluation for a project.',
      mimeType: 'application/json',
    },
    {
      uriTemplate: 'smm://project/{project}/big-o',
      name: 'Project Big-O files',
      description: 'Big-O complexity classification for source files in a project.',
      mimeType: 'application/json',
    },
    {
      uriTemplate: 'smm://project/{project}/health-check',
      name: 'Project health check',
      description: 'Dataset health report for a project.',
      mimeType: 'application/json',
    },
    {
      uriTemplate: 'smm://project/{project}/saved-filters',
      name: 'Project saved filters',
      description: 'Saved filters and reports for a project.',
      mimeType: 'application/json',
    },
    {
      uriTemplate: 'smm://project/{project}/sonarqube/measurements',
      name: 'Project SonarQube measurements',
      description: 'Latest SonarQube measurements for a project.',
      mimeType: 'application/json',
    },
    {
      uriTemplate: 'smm://project/{project}/sonarqube/measurements/history',
      name: 'Project SonarQube measurements history',
      description: 'Timestamped SonarQube measurement entries for a project.',
      mimeType: 'application/json',
    },
    {
      uriTemplate: 'smm://project/{project}/sonarqube/component-tree',
      name: 'Project SonarQube component tree',
      description: 'SonarQube component tree with metrics for a project.',
      mimeType: 'application/json',
    },
    {
      uriTemplate: 'smm://project/{project}/sonarqube/component-tree/history',
      name: 'Project SonarQube component tree history',
      description: 'Timestamped SonarQube component tree entries for a project.',
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
      {
        uri: `smm://project/${encodeProject(project)}/evaluation/change-requests`,
        name: `${project} change request evaluation`,
        description: 'Change request health evaluation for the project.',
        mimeType: 'application/json',
      },
      {
        uri: `smm://project/${encodeProject(project)}/evaluation/pipelines`,
        name: `${project} pipeline evaluation`,
        description: 'Pipeline health evaluation for the project.',
        mimeType: 'application/json',
      },
      {
        uri: `smm://project/${encodeProject(project)}/evaluation/code`,
        name: `${project} code evaluation`,
        description: 'Code health evaluation for the project.',
        mimeType: 'application/json',
      },
      {
        uri: `smm://project/${encodeProject(project)}/evaluation/quality`,
        name: `${project} quality evaluation`,
        description: 'SonarQube quality evaluation for the project.',
        mimeType: 'application/json',
      },
      {
        uri: `smm://project/${encodeProject(project)}/evaluation/architecture`,
        name: `${project} architecture evaluation`,
        description: 'Architecture health evaluation for the project.',
        mimeType: 'application/json',
      },
      {
        uri: `smm://project/${encodeProject(project)}/big-o`,
        name: `${project} Big-O files`,
        description: 'Big-O complexity classification for source files.',
        mimeType: 'application/json',
      },
      {
        uri: `smm://project/${encodeProject(project)}/health-check`,
        name: `${project} health check`,
        description: 'Dataset health report for the project.',
        mimeType: 'application/json',
      },
      {
        uri: `smm://project/${encodeProject(project)}/architecture/summary`,
        name: `${project} architecture summary`,
        description: 'Architecture snapshot metadata for the latest snapshot.',
        mimeType: 'application/json',
      },
      {
        uri: `smm://project/${encodeProject(project)}/pipeline-dashboard`,
        name: `${project} pipeline dashboard`,
        description: 'Full pipeline dashboard for the project.',
        mimeType: 'application/json',
      },
      {
        uri: `smm://project/${encodeProject(project)}/saved-filters`,
        name: `${project} saved filters`,
        description: 'Saved filters and reports for the project.',
        mimeType: 'application/json',
      },
      {
        uri: `smm://project/${encodeProject(project)}/sonarqube/measurements`,
        name: `${project} SonarQube measurements`,
        description: 'Latest SonarQube measurements for the project.',
        mimeType: 'application/json',
      },
      {
        uri: `smm://project/${encodeProject(project)}/sonarqube/measurements/history`,
        name: `${project} SonarQube measurements history`,
        description: 'Timestamped SonarQube measurement entries for the project.',
        mimeType: 'application/json',
      },
      {
        uri: `smm://project/${encodeProject(project)}/sonarqube/component-tree`,
        name: `${project} SonarQube component tree`,
        description: 'SonarQube component tree with metrics for the project.',
        mimeType: 'application/json',
      },
      {
        uri: `smm://project/${encodeProject(project)}/sonarqube/component-tree/history`,
        name: `${project} SonarQube component tree history`,
        description: 'Timestamped SonarQube component tree entries for the project.',
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
    /^smm:\/\/project\/([^/]+)\/(configuration|report|engineering-health|dora|architecture\/snapshots|architecture\/summary|evaluation\/(change-requests|pipelines|code|quality|architecture)|big-o|health-check|pipeline-dashboard|saved-filters|sonarqube\/(measurements|measurements\/history|component-tree|component-tree\/history))$/
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

  if (resourceType === 'evaluation/change-requests') {
    const result = jsonResource(uri, (await reader.evaluateChangeRequests()) as JsonValue);
    resourceLogger.debug(`Read resource ${uri} in ${Date.now() - resourceStartedAt}ms`);
    return result;
  }

  if (resourceType === 'evaluation/pipelines') {
    const result = jsonResource(uri, (await reader.evaluatePipelines()) as JsonValue);
    resourceLogger.debug(`Read resource ${uri} in ${Date.now() - resourceStartedAt}ms`);
    return result;
  }

  if (resourceType === 'evaluation/code') {
    const result = jsonResource(uri, (await reader.evaluateCode()) as JsonValue);
    resourceLogger.debug(`Read resource ${uri} in ${Date.now() - resourceStartedAt}ms`);
    return result;
  }

  if (resourceType === 'evaluation/quality') {
    const result = jsonResource(uri, (await reader.evaluateQuality()) as JsonValue);
    resourceLogger.debug(`Read resource ${uri} in ${Date.now() - resourceStartedAt}ms`);
    return result;
  }

  if (resourceType === 'evaluation/architecture') {
    const result = jsonResource(
      uri,
      (await reader.evaluateArchitecture({ project: projectName })) as JsonValue
    );
    resourceLogger.debug(`Read resource ${uri} in ${Date.now() - resourceStartedAt}ms`);
    return result;
  }

  if (resourceType === 'big-o') {
    const result = jsonResource(uri, (await reader.listBigOFiles()) as JsonValue);
    resourceLogger.debug(`Read resource ${uri} in ${Date.now() - resourceStartedAt}ms`);
    return result;
  }

  if (resourceType === 'health-check') {
    const result = jsonResource(uri, (await reader.healthCheck()) as JsonValue);
    resourceLogger.debug(`Read resource ${uri} in ${Date.now() - resourceStartedAt}ms`);
    return result;
  }

  if (resourceType === 'architecture/summary') {
    const result = jsonResource(uri, (await reader.getArchitectureSummary()) as JsonValue);
    resourceLogger.debug(`Read resource ${uri} in ${Date.now() - resourceStartedAt}ms`);
    return result;
  }

  if (resourceType === 'pipeline-dashboard') {
    const result = jsonResource(
      uri,
      (await reader.getPipelineDashboard({ project: projectName })) as JsonValue
    );
    resourceLogger.debug(`Read resource ${uri} in ${Date.now() - resourceStartedAt}ms`);
    return result;
  }

  if (resourceType === 'saved-filters') {
    const result = jsonResource(uri, (await reader.listSavedFilters()) as JsonValue);
    resourceLogger.debug(`Read resource ${uri} in ${Date.now() - resourceStartedAt}ms`);
    return result;
  }

  if (resourceType === 'sonarqube/measurements') {
    const result = jsonResource(uri, (await reader.getSonarqubeMeasurements()) as JsonValue);
    resourceLogger.debug(`Read resource ${uri} in ${Date.now() - resourceStartedAt}ms`);
    return result;
  }

  if (resourceType === 'sonarqube/measurements/history') {
    const result = jsonResource(uri, (await reader.getSonarqubeMeasurementsHistory()) as JsonValue);
    resourceLogger.debug(`Read resource ${uri} in ${Date.now() - resourceStartedAt}ms`);
    return result;
  }

  if (resourceType === 'sonarqube/component-tree') {
    const result = jsonResource(
      uri,
      (await reader.getSonarqubeComponentTree({ project: projectName })) as JsonValue
    );
    resourceLogger.debug(`Read resource ${uri} in ${Date.now() - resourceStartedAt}ms`);
    return result;
  }

  if (resourceType === 'sonarqube/component-tree/history') {
    const result = jsonResource(
      uri,
      (await reader.getSonarqubeComponentTreeHistory({ project: projectName })) as JsonValue
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
