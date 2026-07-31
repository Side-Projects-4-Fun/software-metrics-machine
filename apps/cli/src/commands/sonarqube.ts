import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SmmCommand } from './smm-command';
import { SonarqubeMeasuresClient } from '@smmachine/core/providers/sonarqube/sonarqube-client';
import { SonarqubeFetchMetricsRepository } from '@smmachine/core/providers/sonarqube/repositories/sonarqube-fetch-metrics-repository-json';
import {
  SonarqubeLocalAnalysis,
  type SonarqubeLocalAnalysisResult,
} from '@smmachine/core/providers/sonarqube/sonarqube-local-analysis';

type SonarqubeOrchestratorOptions = {
  sonarUrl?: string;
  sonarToken?: string;
  sonarProject?: string;
  useLocalAnalysisToken?: boolean;
};

function createSonarqubeOrchestrator(
  options: SonarqubeOrchestratorOptions = {},
  command: SmmCommand
) {
  const config = command.getConfiguration();
  const logger = command.getLogger('SonarQubeCommand');
  const token = options.useLocalAnalysisToken
    ? config.sonarLocalRunnerToken
    : (options.sonarToken ?? config.sonarToken);
  if (options.useLocalAnalysisToken && !token) {
    throw new Error('sonarLocalRunnerToken is required to fetch local SonarQube analysis metrics.');
  }

  let sonarUrl = options.sonarUrl ?? config.sonarUrl ?? '';
  if (options.useLocalAnalysisToken) {
    const localAnalysis = new SonarqubeLocalAnalysis(config, undefined, logger);
    const localServerUrl = localAnalysis.readLocalServerUrl();
    if (localServerUrl) {
      sonarUrl = localServerUrl;
    }
  }

  const sonarqubeClient = new SonarqubeMeasuresClient(
    sonarUrl,
    token || '',
    options.sonarProject ?? config.sonarProject ?? '',
    logger
  );

  return new SonarqubeFetchMetricsRepository(sonarqubeClient, config, logger);
}

async function fetchLocalAnalysisMetrics(
  result: SonarqubeLocalAnalysisResult,
  command: SmmCommand
): Promise<void> {
  const screen = command.getScreen();
  const orchestrator = createSonarqubeOrchestrator(
    {
      sonarUrl: result.containerUrls.hostUrl,
      sonarProject: result.projectKey,
      useLocalAnalysisToken: true,
    },
    command
  );

  screen.printLine('🔄 Fetching SonarQube metrics from local analysis...');
  await orchestrator.fetchQualityMetrics();
  await orchestrator.fetchComponentTree({
    component: result.projectKey,
    depth: -1,
  });
  await orchestrator.fetchHistoricalMeasures();
  screen.printLine('✅ Local SonarQube metrics have been fetched');
}

/**
 * SonarQube Command Group
 *
 * Provides CLI commands for SonarQube integration matching Python CLI functionality.
 *
 * Commands:
 *   smm sonarqube fetch-measures   Fetch quality measures from SonarQube
 *   smm sonarqube fetch-component-tree   Fetch component tree from SonarQube
 */
export function createSonarQubeCommands(program: SmmCommand): void {
  const screen = program.getScreen();
  const sonarqubeGroup = program
    .subcommand('sonarqube')
    .description('SonarQube integration operations');

  const sonarqubeAnalysisGroup = sonarqubeGroup
    .subcommand('analysis')
    .description('Run local SonarQube analysis through Docker');

  sonarqubeAnalysisGroup
    .subcommand('run')
    .description('Start local SonarQube (if needed) and execute sonar-scanner in Docker')
    .option('--container-server-name <name>', 'SonarQube container name', 'sonarqube')
    .option(
      '--scanner-container-name <name>',
      'SonarQube scanner container name',
      'sonarqube-scanner'
    )
    .option('--container-server-image <image>', 'SonarQube Docker image', 'sonarqube:community')
    .option(
      '--scanner-image <image>',
      'Sonar scanner Docker image',
      'sonarsource/sonar-scanner-cli'
    )
    .option('--data-dir <path>', 'Host path mounted to /opt/sonarqube/data', './sonarqube_data')
    .option('--server-port <number>', 'Host port mapped to SonarQube container port 9000', '9000')
    .option(
      '--scanner-host-url <url>',
      'SONAR_HOST_URL passed to scanner (overrides container-derived URL)'
    )
    .option('--scanner-token <token>', 'SONAR_TOKEN passed to scanner')
    .option('--properties <value>', 'Raw SONAR_SCANNER_OPTS value passed directly to scanner')
    .option('--admin-user <user>', 'Predefined local SonarQube admin username', 'admin')
    .option('--admin-password <password>', 'Predefined local SonarQube admin password', 'admin')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('SonarQubeCommand');
      try {
        const configRepo = command.getConfigurationRepository();
        const config = command.getConfiguration();
        const analysis = new SonarqubeLocalAnalysis(config, configRepo, logger);
        const result = await analysis.run({
          containerName: String(options.containerServerName),
          scannerContainerName: String(options.scannerContainerName),
          containerImage: String(options.containerServerImage),
          scannerImage: String(options.scannerImage),
          dataDirectory: resolve(String(options.dataDir)),
          sourceDirectory: resolve(String(config.gitRepositoryLocation)),
          hostPort: String(options.serverPort),
          scannerOptions: String(options.properties || '').trim(),
          adminUser: String(options.adminUser),
          adminPassword: String(options.adminPassword),
          scannerHostUrl: options.scannerHostUrl
            ? String(options.scannerHostUrl).trim()
            : undefined,
          scannerToken: options.scannerToken,
        });
        // wait to give sonarqube time to process the changes and make metrics available before fetching
        screen.printLine('Waiting for SonarQube to process analysis results...');
        await new Promise((resolve) => setTimeout(resolve, 120_000));
        await fetchLocalAnalysisMetrics(result, command);
      } catch (error) {
        logger.error('Failed to run SonarQube analysis', error);
        process.exit(1);
      }
    });

  /**
   * smm sonarqube fetch-measures [options]
   * Fetch quality measures from SonarQube
   */
  sonarqubeGroup
    .subcommand('fetch-measures')
    .description('Fetch quality measures from SonarQube')
    .option(
      '--metrics <list>',
      'Comma-separated list of metrics to fetch (default: coverage,sqale_rating,complexity,duplicated_lines_density)'
    )
    .option('--output <format>', 'Output format (text|json)', 'text')
    .option('--local', 'Use sonar_local_runner_token for API calls', false)
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('SonarQubeCommand');
      try {
        screen.printLine('🔄 Fetching quality measures from SonarQube...');
        const orchestrator = createSonarqubeOrchestrator(
          {
            useLocalAnalysisToken: options.local,
          },
          command
        );

        const metricsParam = options.metrics
          ? { metrics: options.metrics.split(',').map((m: string) => m.trim()) }
          : undefined;

        const measures = await orchestrator.fetchQualityMetrics(metricsParam);

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(measures, null, 2));
        } else {
          screen.printLine('\n=== SonarQube Quality Measures ===\n');
          const measureList = Array.isArray(measures.measures) ? measures.measures : [];
          screen.printLine(`Measures Fetched: ${measureList.length}`);
          screen.printLine(`Project Key: ${measures.key || 'N/A'}`);
          screen.printLine(`Project Name: ${measures.name || 'N/A'}`);

          if (measureList.length > 0) {
            screen.printLine('\nMeasures:');
            for (const measure of measureList) {
              screen.printLine(`  ${measure.metric}: ${measure.value ?? 'N/A'}`);
            }
          }
        }

        screen.printLine('\n✅ Fetch measures has been completed');
      } catch (error) {
        logger.error('Failed to fetch SonarQube measures', error);
        process.exit(1);
      }
    });

  /**
   * smm sonarqube fetch-component-tree [options]
   * Fetch component tree with metrics from SonarQube
   */
  sonarqubeGroup
    .subcommand('fetch-component-tree')
    .description('Fetch component tree with metrics from SonarQube')
    .option('--component <key>', 'Component key (default: configured SONAR_PROJECT)')
    .option('--depth <number>', 'Depth of tree traversal (-1 for all depths)', '-1')
    .option(
      '--metrics <list>',
      'Comma-separated list of metrics to fetch (default: complexity,cognitive_complexity,ncloc,sqale_rating,coverage)'
    )
    .option('--output <format>', 'Output format (text|json)', 'text')
    .option('--local', 'Use sonar_local_runner_token for API calls', false)
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('SonarQubeCommand');
      try {
        screen.printLine('🔄 Fetching component tree from SonarQube...');
        const orchestrator = createSonarqubeOrchestrator(
          {
            useLocalAnalysisToken: options.local,
          },
          command
        );

        const parsedDepth = Number.parseInt(options.depth, 10);
        if (Number.isNaN(parsedDepth)) {
          throw new Error('--depth must be a valid integer');
        }

        const treeOptions = {
          component: options.component,
          depth: parsedDepth,
          metrics: options.metrics
            ? options.metrics.split(',').map((m: string) => m.trim())
            : undefined,
        };

        const components = await orchestrator.fetchComponentTree(treeOptions);

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(components, null, 2));
        } else {
          screen.printLine('\n=== SonarQube Component Tree ===\n');
          screen.printLine(`Components Fetched: ${components.length}`);

          if (components.length > 0) {
            const root = components[0];
            screen.printLine(`Root Component: ${root.key || 'N/A'}`);
            screen.printLine(`Root Name: ${root.name || 'N/A'}`);
          }

          if (components.length > 0) {
            screen.printLine('\nComponents:');
            for (const component of components) {
              const measureCount = Array.isArray(component.measures)
                ? component.measures.length
                : 0;
              screen.printLine(`  ${component.key || 'unknown'} - measures: ${measureCount}`);
            }
          }
        }

        screen.printLine('\n✅ Fetch component tree has been completed');
      } catch (error) {
        logger.error('Failed to fetch SonarQube component tree', error);
        process.exit(1);
      }
    });

  /**
   * smm sonarqube fetch-historical-measures [options]
   * Fetch historical measures from SonarQube and optionally store as JSON
   */
  sonarqubeGroup
    .subcommand('fetch-historical-measures')
    .description('Fetch historical measures from SonarQube')
    .option(
      '--metrics <list>',
      'Comma-separated list of metrics to fetch (default: sqale_rating,coverage,duplicated_lines_density)'
    )
    .option('--start-date <date>', 'Start date in YYYY-MM-DD format')
    .option('--end-date <date>', 'End date in YYYY-MM-DD format')
    .option(
      '--update',
      'Incrementally update measures — fetch only newer items since last sync and merge with existing cache'
    )
    .option('--output <format>', 'Output format (text|json)', 'text')
    .option('--save <file>', 'Save results to a JSON file at the given path')
    .option('--local', 'Use sonar_local_runner_token for API calls', false)
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('SonarQubeCommand');
      try {
        screen.printLine('🔄 Fetching historical measures from SonarQube...');
        const orchestrator = createSonarqubeOrchestrator(
          {
            useLocalAnalysisToken: options.local,
          },
          command
        );

        const fetchOptions = {
          metrics: options.metrics
            ? options.metrics.split(',').map((m: string) => m.trim())
            : undefined,
          startDate: options.startDate,
          endDate: options.endDate,
          incrementalUpdate: options.update,
        };

        const measures = await orchestrator.fetchHistoricalMeasures(fetchOptions);

        if (options.save) {
          writeFileSync(options.save, JSON.stringify(measures, null, 2), 'utf-8');
          screen.printLine(`\n💾 Results saved to ${options.save}`);
        }

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(measures, null, 2));
        } else {
          screen.printLine('\n=== SonarQube Historical Measures ===\n');
          screen.printLine(`Measurements Fetched: ${measures.length}`);
        }

        screen.printLine('\n✅ Fetch historical measures has been completed');
      } catch (error) {
        logger.error('Failed to fetch SonarQube historical measures', error);
        process.exit(1);
      }
    });
}
