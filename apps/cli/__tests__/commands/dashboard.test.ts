import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { commands } from '../../src';

const mocks = vi.hoisted(() => ({
  spawn: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
}));

vi.mock('child_process', () => ({
  spawn: mocks.spawn,
}));

vi.mock('fs', async (importActual) => {
  const actual = await importActual<typeof import('fs')>();
  return {
    ...actual,
    existsSync: mocks.existsSync,
  };
});

describe('cli: Dashboard Commands', () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let originalSigintListeners: NodeJS.SignalsListener[];
  let originalSigtermListeners: NodeJS.SignalsListener[];

  const fakeChildProcess = () => ({
    on: vi.fn(),
    kill: vi.fn(),
    killed: false,
    pid: 12345,
  });

  const getOutput = () =>
    consoleSpy.mock.calls
      .flat()
      .filter((value: unknown): value is string => typeof value === 'string')
      .join('\n');

  beforeEach(() => {
    vi.stubEnv('SMM_STORE_DATA_AT', '/tmp');
    vi.stubEnv('OWNER_REPO_GIT_PROVIDER', 'github');
    vi.stubEnv('OWNER_REPO_GITHUB_TOKEN', 'fake-token');
    vi.stubEnv('OWNER_REPO_GIT_REPOSITORY_PATH', '/tmp/repo');

    mocks.existsSync.mockReturnValue(true);
    mocks.spawn.mockImplementation(() => fakeChildProcess() as never);

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`process.exit(${code ?? 0})`);
    });

    originalSigintListeners = process.listeners('SIGINT');
    originalSigtermListeners = process.listeners('SIGTERM');
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');

    program = commands();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    exitSpy.mockRestore();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    originalSigintListeners.forEach((listener) => process.on('SIGINT', listener));
    originalSigtermListeners.forEach((listener) => process.on('SIGTERM', listener));
  });

  describe('dashboard serve', () => {
    it('spawns both REST and webapp services with default ports and host', async () => {
      await program.parseAsync(['dashboard', 'serve'], { from: 'user' });

      expect(mocks.spawn).toHaveBeenCalledTimes(2);

      expect(mocks.spawn).toHaveBeenNthCalledWith(
        1,
        process.execPath,
        [expect.stringContaining('main.cjs')],
        expect.objectContaining({
          cwd: expect.any(String),
          stdio: 'inherit',
          env: expect.objectContaining({
            HOST: '0.0.0.0',
            PORT: '3001',
          }),
        })
      );

      expect(mocks.spawn).toHaveBeenNthCalledWith(
        2,
        process.execPath,
        [
          expect.stringMatching(/next$/),
          'start',
          expect.any(String),
          '-p',
          '3000',
          '-H',
          '0.0.0.0',
        ],
        expect.objectContaining({
          cwd: expect.any(String),
          stdio: 'inherit',
          env: expect.objectContaining({
            HOST: '0.0.0.0',
            HOSTNAME: '0.0.0.0',
            PORT: '3000',
            REST_PORT: '3001',
            SMM_REST_BASE_URL: 'http://0.0.0.0:3001',
            NODE_ENV: process.env.NODE_ENV || 'production',
          }),
        })
      );
    });

    it('forwards custom ports and host to both spawned services', async () => {
      await program.parseAsync(
        [
          'dashboard',
          'serve',
          '--webapp-port',
          '4000',
          '--rest-port',
          '4001',
          '--host',
          'localhost',
        ],
        { from: 'user' }
      );

      expect(mocks.spawn).toHaveBeenCalledTimes(2);

      expect(mocks.spawn).toHaveBeenNthCalledWith(
        1,
        process.execPath,
        [expect.stringContaining('main.cjs')],
        expect.objectContaining({
          env: expect.objectContaining({
            HOST: 'localhost',
            PORT: '4001',
          }),
        })
      );

      expect(mocks.spawn).toHaveBeenNthCalledWith(
        2,
        process.execPath,
        [
          expect.stringMatching(/next$/),
          'start',
          expect.any(String),
          '-p',
          '4000',
          '-H',
          'localhost',
        ],
        expect.objectContaining({
          env: expect.objectContaining({
            HOST: 'localhost',
            HOSTNAME: 'localhost',
            PORT: '4000',
            REST_PORT: '4001',
            SMM_REST_BASE_URL: 'http://localhost:4001',
          }),
        })
      );
    });

    it('uses the resolved REST entrypoint as the first script argument', async () => {
      await program.parseAsync(['dashboard', 'serve'], { from: 'user' });

      const restCall = mocks.spawn.mock.calls[0];
      const [, restArgs, restOptions] = restCall;

      expect(restArgs[0]).toMatch(/rest[\/\\]main\.c?js$/);
      expect(restOptions.cwd).toBe(restArgs[0].replace(/[\/\\][^/\\]+$/, ''));
    });

    it('runs the webapp with next start from the resolved package root', async () => {
      await program.parseAsync(['dashboard', 'serve'], { from: 'user' });

      const webappCall = mocks.spawn.mock.calls[1];
      const [, webappArgs] = webappCall;

      expect(webappArgs[0]).toMatch(/node_modules[\/\\]next[\/\\]dist[\/\\]bin[\/\\]next$/);
    });

    it('prints startup banner with resolved host, webapp port, and rest port', async () => {
      await program.parseAsync(
        ['dashboard', 'serve', '--host', 'localhost', '--rest-port', '4001'],
        { from: 'user' }
      );

      const output = getOutput();

      expect(output).toContain('Starting bundled dashboard services');
      expect(output).toContain('Host: localhost');
      expect(output).toContain('REST API: http://localhost:4001');
      expect(output).toContain('Webapp: http://localhost:3000');
    });

    it('exits with an error when bundled services cannot be located', async () => {
      mocks.existsSync.mockReturnValue(false);

      await expect(program.parseAsync(['dashboard', 'serve'], { from: 'user' })).rejects.toThrow(
        'process.exit(1)'
      );

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(mocks.spawn).not.toHaveBeenCalled();
    });
  });
});
