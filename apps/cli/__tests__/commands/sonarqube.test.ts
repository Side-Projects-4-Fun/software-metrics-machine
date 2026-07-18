import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Command } from 'commander';
import { commands } from '../../src';

// Mock at the deepest importable level to prevent any real HTTP calls.
import { SonarqubeMeasuresClient } from '@smmachine/core/providers/sonarqube/sonarqube-client';
import { SonarqubeLocalAnalysis } from '@smmachine/core/providers/sonarqube/sonarqube-local-analysis';

// Mock node:fs writeFileSync globally so the source code's writeFileSync
// calls (e.g. --save flag) do not write to disk. Tests that need to write
// config files must use vi.importActual to bypass.
const mocks = vi.hoisted(() => ({
  writeFileSync: vi.fn(),
}));

vi.mock('node:fs', async (importActual) => {
  const actual = await importActual<typeof import('node:fs')>();
  return {
    ...actual,
    writeFileSync: mocks.writeFileSync,
  };
});

describe('cli: SonarQube Commands', () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let uniqueDataDir: string;

  // Mock functions for SonarqubeMeasuresClient methods
  let fetchComponentMeasuresMock: ReturnType<typeof vi.fn>;
  let fetchComponentTreeMock: ReturnType<typeof vi.fn>;
  let fetchHistoricalMeasuresMock: ReturnType<typeof vi.fn>;
  let runAnalysisMock: ReturnType<typeof vi.fn>;

  // Used so fetch-commands resolve sonar token / url / project from environment.
  // analysis run additionally needs a config file with sonar_local_runner_token.
  const projectArgs = ['--project', 'owner/repo'];

  const dummyQualityMetrics = {
    id: '1',
    key: 'sonar-project',
    name: 'Sonar Project',
    measures: [{ metric: 'coverage', value: '85.5', bestValue: false }],
  };

  const dummyComponentTree = [
    { key: 'src/App.tsx', name: 'App.tsx', measures: [{ metric: 'ncloc', value: '100' }] },
  ];

  const dummyHistoricalMeasures = [
    {
      key: 'coverage',
      name: 'Coverage',
      metric: 'coverage',
      value: '85',
      formatter: 'PERCENT',
      timestamp: '2026-01-01T00:00:00Z',
    },
  ];

  const dummyAnalysisResult = {
    containerUrls: { internalUrl: 'http://sonarqube:9000', hostUrl: 'http://localhost:9000' },
    projectKey: 'test-project',
  };

  const getOutput = () =>
    consoleSpy.mock.calls
      .flat()
      .filter((value: unknown): value is string => typeof value === 'string')
      .join('\n');

  beforeEach(() => {
    // Use a unique temp directory per test to prevent SQLite data leakage between tests
    uniqueDataDir = mkdtempSync(join(tmpdir(), 'smm-sonarqube-'));
    vi.stubEnv('SMM_STORE_DATA_AT', uniqueDataDir);
    vi.stubEnv('OWNER_REPO_GIT_PROVIDER', 'github');
    vi.stubEnv('OWNER_REPO_GITHUB_TOKEN', 'fake-token');
    vi.stubEnv('OWNER_REPO_GIT_REPOSITORY_PATH', '/tmp/repo');
    vi.stubEnv('OWNER_REPO_SONAR_URL', 'https://sonar.example.com');
    vi.stubEnv('OWNER_REPO_SONAR_TOKEN', 'sonar-token');
    vi.stubEnv('OWNER_REPO_SONAR_PROJECT', 'sonar-project');

    fetchComponentMeasuresMock = vi.fn().mockResolvedValue(dummyQualityMetrics);
    fetchComponentTreeMock = vi.fn().mockResolvedValue(dummyComponentTree);
    fetchHistoricalMeasuresMock = vi.fn().mockResolvedValue(dummyHistoricalMeasures);
    runAnalysisMock = vi.fn().mockResolvedValue(dummyAnalysisResult);

    // Mock at the deepest client layer to prevent real HTTP calls
    vi.spyOn(SonarqubeMeasuresClient.prototype, 'fetchComponentMeasures').mockImplementation(
      fetchComponentMeasuresMock
    );
    vi.spyOn(SonarqubeMeasuresClient.prototype, 'fetchComponentTree').mockImplementation(
      fetchComponentTreeMock
    );
    vi.spyOn(SonarqubeMeasuresClient.prototype, 'fetchHistoricalMeasures').mockImplementation(
      fetchHistoricalMeasuresMock
    );

    // Also mock SonarqubeLocalAnalysis.prototype.run
    vi.spyOn(SonarqubeLocalAnalysis.prototype, 'run').mockImplementation(runAnalysisMock);

    mocks.writeFileSync.mockImplementation(() => undefined);

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    consoleErrSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`process.exit(${code ?? 0})`);
    });

    program = commands();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrSpy.mockRestore();
    exitSpy.mockRestore();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    try {
      rmSync(uniqueDataDir, { recursive: true, force: true });
    } catch {
      /* ok */
    }
  });

  describe('command registration', () => {
    it('registers the sonarqube command group', () => {
      const sonarqubeCommand = program.commands.find((cmd) => cmd.name() === 'sonarqube');
      expect(sonarqubeCommand).toBeDefined();
      expect(sonarqubeCommand!.description()).toBe('SonarQube integration operations');
    });

    it('registers every SonarQube subcommand', () => {
      const sonarqubeCommand = program.commands.find((cmd) => cmd.name() === 'sonarqube');
      const names = sonarqubeCommand!.commands.map((cmd) => cmd.name());
      expect(names).toEqual(
        expect.arrayContaining([
          'analysis',
          'fetch-measures',
          'fetch-component-tree',
          'fetch-historical-measures',
        ])
      );
    });
  });

  describe('sonarqube fetch-measures', () => {
    it('forwards --metrics as a parsed array to fetchQualityMetrics', async () => {
      await program.parseAsync(
        [
          ...projectArgs,
          'sonarqube',
          'fetch-measures',
          '--metrics',
          'coverage,complexity,sqale_rating',
        ],
        { from: 'user' }
      );

      expect(fetchComponentMeasuresMock).toHaveBeenCalledWith({
        metrics: ['coverage', 'complexity', 'sqale_rating'],
      });
    });

    it('passes undefined metrics when --metrics is not given', async () => {
      await program.parseAsync([...projectArgs, 'sonarqube', 'fetch-measures'], { from: 'user' });

      // The repository method passes through to the client with an options object
      expect(fetchComponentMeasuresMock).toHaveBeenCalledWith({
        metrics: undefined,
      });
    });

    it('prints the quality-measures summary in text output by default', async () => {
      await program.parseAsync([...projectArgs, 'sonarqube', 'fetch-measures'], { from: 'user' });

      const output = getOutput();
      expect(output).toContain('=== SonarQube Quality Measures ===');
      expect(output).toContain('Measures Fetched: 1');
      expect(output).toContain('Project Key: sonar-project');
      expect(output).toContain('Project Name: Sonar Project');
      expect(output).toContain('coverage: 85.5');
    });

    it('prints the quality measures as JSON when --output json is provided', async () => {
      await program.parseAsync(
        [...projectArgs, 'sonarqube', 'fetch-measures', '--output', 'json'],
        { from: 'user' }
      );

      const output = getOutput();
      expect(output).toContain('"key": "sonar-project"');
      expect(output).toContain('"metric": "coverage"');
    });

    it('exits with an error when --local is used without a configured sonar_local_runner_token', async () => {
      // Override log level so the error gets logged to console.error
      vi.stubEnv('OWNER_REPO_LOGGING_LEVEL', 'ERROR');

      await expect(
        program.parseAsync([...projectArgs, 'sonarqube', 'fetch-measures', '--local'], {
          from: 'user',
        })
      ).rejects.toThrow('process.exit(1)');

      expect(exitSpy).toHaveBeenCalledWith(1);

      // The error is logged via logger.error which writes to console.error
      // The second argument is an Error object, so we stringify each call's args
      const errOutput = consoleErrSpy.mock.calls
        .map((call) => call.map((a) => String(a)).join(' '))
        .join('\n');
      expect(errOutput).toContain(
        'sonarLocalRunnerToken is required to fetch local SonarQube analysis metrics.'
      );
    });
  });

  describe('sonarqube fetch-component-tree', () => {
    it('forwards component, depth, and metrics to fetchComponentTree', async () => {
      await program.parseAsync(
        [
          ...projectArgs,
          'sonarqube',
          'fetch-component-tree',
          '--component',
          'my-project',
          '--depth',
          '5',
          '--metrics',
          'complexity,ncloc',
        ],
        { from: 'user' }
      );

      expect(fetchComponentTreeMock).toHaveBeenCalledWith({
        component: 'my-project',
        depth: 5,
        metrics: ['complexity', 'ncloc'],
      });
    });

    it('defaults depth to -1 and passes undefined metrics when options are omitted', async () => {
      await program.parseAsync([...projectArgs, 'sonarqube', 'fetch-component-tree'], {
        from: 'user',
      });

      expect(fetchComponentTreeMock).toHaveBeenCalledWith({
        component: undefined,
        depth: -1,
        metrics: undefined,
      });
    });

    it('exits with an error when --depth is not a valid integer', async () => {
      await expect(
        program.parseAsync(
          [...projectArgs, 'sonarqube', 'fetch-component-tree', '--depth', 'abc'],
          { from: 'user' }
        )
      ).rejects.toThrow('process.exit(1)');

      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('prints the component tree summary in text output', async () => {
      await program.parseAsync([...projectArgs, 'sonarqube', 'fetch-component-tree'], {
        from: 'user',
      });

      const output = getOutput();
      expect(output).toContain('=== SonarQube Component Tree ===');
      expect(output).toContain('Components Fetched: 1');
      expect(output).toContain('Root Component: src/App.tsx');
      expect(output).toContain('Root Name: App.tsx');
      expect(output).toContain('src/App.tsx - measures: 1');
    });

    it('prints JSON when --output json is provided', async () => {
      await program.parseAsync(
        [...projectArgs, 'sonarqube', 'fetch-component-tree', '--output', 'json'],
        { from: 'user' }
      );

      const output = getOutput();
      expect(output).toContain('"key": "src/App.tsx"');
    });
  });

  describe('sonarqube fetch-historical-measures', () => {
    it('forwards metrics, startDate, endDate, and incrementalUpdate to fetchHistoricalMeasures', async () => {
      await program.parseAsync(
        [
          ...projectArgs,
          'sonarqube',
          'fetch-historical-measures',
          '--metrics',
          'coverage,sqale_rating',
          '--start-date',
          '2026-01-01',
          '--end-date',
          '2026-01-31',
          '--update',
        ],
        { from: 'user' }
      );

      expect(fetchHistoricalMeasuresMock).toHaveBeenCalledWith({
        metrics: ['coverage', 'sqale_rating'],
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        incrementalUpdate: true,
      });
    });

    it('passes undefined metrics/dates when none are given', async () => {
      await program.parseAsync([...projectArgs, 'sonarqube', 'fetch-historical-measures'], {
        from: 'user',
      });

      expect(fetchHistoricalMeasuresMock).toHaveBeenCalledWith({
        metrics: undefined,
        startDate: undefined,
        endDate: undefined,
        incrementalUpdate: undefined,
      });
    });

    it('writes the result to disk when --save is provided', async () => {
      await program.parseAsync(
        [...projectArgs, 'sonarqube', 'fetch-historical-measures', '--save', '/tmp/out.json'],
        { from: 'user' }
      );

      expect(mocks.writeFileSync).toHaveBeenCalledWith(
        '/tmp/out.json',
        expect.stringContaining('coverage'),
        'utf-8'
      );

      const output = getOutput();
      expect(output).toContain('💾 Results saved to /tmp/out.json');
    });

    it('prints the historical-measures summary in text output', async () => {
      await program.parseAsync([...projectArgs, 'sonarqube', 'fetch-historical-measures'], {
        from: 'user',
      });

      const output = getOutput();
      expect(output).toContain('=== SonarQube Historical Measures ===');
      expect(output).toContain('Measurements Fetched: 1');
    });

    it('prints JSON when --output json is provided', async () => {
      await program.parseAsync(
        [...projectArgs, 'sonarqube', 'fetch-historical-measures', '--output', 'json'],
        { from: 'user' }
      );

      const output = getOutput();
      expect(output).toContain('"key": "coverage"');
    });
  });

  describe('sonarqube analysis run', () => {
    // Imports must be at module scope per vitest rules
    // so we define the class reference at the top and use it inside tests.

    it('forwards container and scanner options to SonarqubeLocalAnalysis.run', async () => {
      // Short-circuit: make run throw so we never hit the 120s wait.
      runAnalysisMock.mockRejectedValueOnce(new Error('analysis aborted'));

      await expect(
        program.parseAsync([...projectArgs, 'sonarqube', 'analysis', 'run'], { from: 'user' })
      ).rejects.toThrow('process.exit(1)');

      expect(exitSpy).toHaveBeenCalledWith(1);

      expect(runAnalysisMock).toHaveBeenCalledWith({
        containerName: 'sonarqube',
        scannerContainerName: 'sonarqube-scanner',
        containerImage: 'sonarqube:community',
        scannerImage: 'sonarsource/sonar-scanner-cli',
        dataDirectory: expect.stringContaining('sonarqube_data'),
        sourceDirectory: expect.any(String),
        hostPort: '9000',
        scannerOptions: '',
        adminUser: 'admin',
        adminPassword: 'admin',
        scannerHostUrl: undefined,
        scannerToken: undefined,
      });
    });

    it('forwards non-default options to SonarqubeLocalAnalysis.run', async () => {
      runAnalysisMock.mockRejectedValueOnce(new Error('abort'));

      await expect(
        program.parseAsync(
          [
            ...projectArgs,
            'sonarqube',
            'analysis',
            'run',
            '--container-server-name',
            'my-sonar',
            '--scanner-container-name',
            'my-scanner',
            '--container-server-image',
            'sonarqube:enterprise',
            '--scanner-image',
            'my-scanner-image',
            '--data-dir',
            '/custom/data',
            '--server-port',
            '9999',
            '--properties',
            '-Xsonar.test=1',
            '--admin-user',
            'customAdmin',
            '--admin-password',
            'customPass',
            '--scanner-host-url',
            'http://custom:9000',
            '--scanner-token',
            'custom-token',
          ],
          { from: 'user' }
        )
      ).rejects.toThrow('process.exit(1)');

      expect(runAnalysisMock).toHaveBeenCalledWith({
        containerName: 'my-sonar',
        scannerContainerName: 'my-scanner',
        containerImage: 'sonarqube:enterprise',
        scannerImage: 'my-scanner-image',
        dataDirectory: expect.stringContaining('custom/data'),
        sourceDirectory: expect.any(String),
        hostPort: '9999',
        scannerOptions: '-Xsonar.test=1',
        adminUser: 'customAdmin',
        adminPassword: 'customPass',
        scannerHostUrl: 'http://custom:9000',
        scannerToken: 'custom-token',
      });
    });

    it('prints a failure message and exits when analysis.run rejects', async () => {
      runAnalysisMock.mockRejectedValueOnce(new Error('Docker not available'));

      await expect(
        program.parseAsync([...projectArgs, 'sonarqube', 'analysis', 'run'], { from: 'user' })
      ).rejects.toThrow('process.exit(1)');

      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    describe('full flow (analysis + fetch)', () => {
      // These tests need a config fixture with sonar_local_runner_token
      // and fake timers to skip the 120s post-analysis sleep.

      let configDir: string;

      beforeEach(async () => {
        configDir = mkdtempSync(join(tmpdir(), 'smm-sonarqube-flow-'));
        // Bypass the global writeFileSync mock to write the real config file
        const realFs = await vi.importActual<typeof import('node:fs')>('node:fs');
        realFs.writeFileSync(
          join(configDir, 'smm_config.json'),
          JSON.stringify({
            projects: [
              {
                github_repository: 'owner/repo',
                git_provider: 'github',
                sonar_local_runner_token: 'local-token',
              },
            ],
          }),
          'utf-8'
        );
        vi.stubEnv('SMM_STORE_DATA_AT', configDir);
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
        rmSync(configDir, { recursive: true, force: true });
      });

      it('calls fetchComponentMeasures, fetchComponentTree, and fetchHistoricalMeasures after analysis', async () => {
        runAnalysisMock.mockResolvedValueOnce(dummyAnalysisResult);

        const promise = program.parseAsync([...projectArgs, 'sonarqube', 'analysis', 'run'], {
          from: 'user',
        });

        // Advance past the 120s setTimeout.
        await vi.advanceTimersByTimeAsync(120_000);

        await promise;

        expect(runAnalysisMock).toHaveBeenCalledTimes(1);
        expect(fetchComponentMeasuresMock).toHaveBeenCalledTimes(1);
        expect(fetchComponentTreeMock).toHaveBeenCalledWith({
          component: 'test-project',
          depth: -1,
        });
        expect(fetchHistoricalMeasuresMock).toHaveBeenCalledTimes(1);
      });

      it('prints status messages during the full flow', async () => {
        runAnalysisMock.mockResolvedValueOnce(dummyAnalysisResult);

        const promise = program.parseAsync([...projectArgs, 'sonarqube', 'analysis', 'run'], {
          from: 'user',
        });

        await vi.advanceTimersByTimeAsync(120_000);
        await promise;

        const output = getOutput();
        expect(output).toContain('Waiting for SonarQube to process analysis results...');
        expect(output).toContain('🔄 Fetching SonarQube metrics from local analysis...');
        expect(output).toContain('✅ Local SonarQube metrics have been fetched');
      });
    });
  });
});
