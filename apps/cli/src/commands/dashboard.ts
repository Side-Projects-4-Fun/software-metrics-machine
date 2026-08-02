import * as fs from 'fs';
import * as path from 'path';
import type { ChildProcess } from 'child_process';
import { spawn } from 'child_process';
import type { SmmCommand } from './smm-command';
import type { Logger } from '@smmachine/utils';

type ServiceProcess = {
  name: string;
  process: ChildProcess;
};

function findDistRoot(): string {
  const candidates = [
    __dirname,
    path.resolve(__dirname, 'dist'),
    path.resolve(process.cwd(), 'dist'),
  ];

  for (const candidate of candidates) {
    if (
      fs.existsSync(path.join(candidate, 'rest')) &&
      fs.existsSync(path.join(candidate, 'webapp'))
    ) {
      return candidate;
    }
  }

  throw new Error(
    `Could not locate bundled services. Expected rest and webapp folders under one of: ${candidates.join(', ')}`
  );
}

function findPackageRoot(distRoot: string): string {
  const candidates = [path.resolve(distRoot, '..'), process.cwd()];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'package.json'))) {
      return candidate;
    }
  }

  throw new Error(`Could not locate package root from dist root ${distRoot}`);
}

function resolveWebappAppDir(packageRoot: string): string {
  const candidates = [path.join(packageRoot, 'apps', 'webapp')];

  for (const appDir of candidates) {
    if (fs.existsSync(path.join(appDir, '.next'))) {
      return appDir;
    }
  }

  throw new Error(
    `Could not find packaged webapp build. Expected one of: ${candidates.join(', ')}`
  );
}

function resolveNextBin(packageRoot: string): string {
  return require.resolve('next/dist/bin/next', {
    paths: [packageRoot],
  });
}

function resolveRestEntry(distRoot: string): string {
  const candidates = [
    path.join(distRoot, 'rest', 'main.cjs'),
    path.join(distRoot, 'rest', 'main.js'),
  ];

  for (const entry of candidates) {
    if (fs.existsSync(entry)) {
      return entry;
    }
  }

  throw new Error(`Could not find REST entrypoint. Expected one of: ${candidates.join(', ')}`);
}

function spawnService(
  name: string,
  scriptPath: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  logger: Logger
): ChildProcess {
  const child = spawn(process.execPath, [scriptPath, ...args], {
    cwd,
    env,
    stdio: 'inherit',
  });

  child.on('error', (error) => {
    logger.error(`Failed to start ${name}`, error);
  });

  return child;
}

function terminateServices(services: ServiceProcess[]): void {
  for (const service of services) {
    if (!service.process.killed) {
      service.process.kill('SIGTERM');
    }
  }
}

/**
 * Dashboard Command Group
 *
 * Provides CLI commands for dashboard operations matching Python CLI functionality.
 *
 * Commands:
 *   smm dashboard serve    Start the dashboard server
 */
export function createDashboardCommands(program: SmmCommand): void {
  const dashboardGroup = program.subcommand('dashboard').description('Dashboard operations');
  const screen = program.getScreen();

  /**
   * smm dashboard serve [options]
   * Start the dashboard server
   */
  dashboardGroup
    .subcommand('serve')
    .description('Start bundled REST API and dashboard webapp servers')
    .option('--webapp-port <number>', 'Port to run the webapp server on', '3000')
    .option('--rest-port <number>', 'Port to run the REST API server on', '3001')
    .option('--host <host>', 'Host to bind the server to', '0.0.0.0')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('DashboardCommand');
      try {
        const webPort = String(options.webappPort);
        const restPort = String(options.restPort);
        const host = String(options.host);

        const distRoot = findDistRoot();
        const packageRoot = findPackageRoot(distRoot);
        const restEntry = resolveRestEntry(distRoot);
        const webappAppDir = resolveWebappAppDir(packageRoot);
        const nextBin = resolveNextBin(packageRoot);

        screen.printLine('🚀 Starting bundled dashboard services...');
        screen.printLine(`   Host: ${options.host}`);
        screen.printLine(`   REST API: http://${host}:${restPort}`);
        screen.printLine(`   Webapp: http://${host}:${webPort}`);

        const services: ServiceProcess[] = [];
        const commonEnv = { ...process.env };

        const restProcess = spawnService(
          'rest',
          restEntry,
          [],
          path.dirname(restEntry),
          {
            ...commonEnv,
            HOST: host,
            PORT: restPort,
          },
          logger
        );
        services.push({ name: 'rest', process: restProcess });

        const webappProcess = spawnService(
          'webapp',
          nextBin,
          ['start', webappAppDir, '-p', webPort, '-H', host],
          packageRoot,
          {
            ...commonEnv,
            HOST: host,
            HOSTNAME: host,
            PORT: webPort,
            REST_PORT: restPort,
            SMM_REST_BASE_URL: `http://${host}:${restPort}`,
            NODE_ENV: process.env.NODE_ENV || 'production',
          },
          logger
        );
        services.push({ name: 'webapp', process: webappProcess });

        for (const service of services) {
          service.process.on('exit', (code, signal) => {
            logger.info(
              `${service.name} exited with code=${code ?? 'null'} signal=${signal ?? 'null'}`
            );
            terminateServices(services);
          });
        }

        const shutdown = (): void => {
          logger.info('Stopping dashboard services...');
          terminateServices(services);
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
      } catch (error) {
        logger.error('Failed to start dashboard', error);
        process.exit(1);
      }
    });
}
