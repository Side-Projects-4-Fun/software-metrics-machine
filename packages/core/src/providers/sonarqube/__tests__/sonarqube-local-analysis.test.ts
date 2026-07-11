import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SonarqubeLocalAnalysis } from '../../..';
import { MockLoggerBuilder } from '../../../test/infrastructure/mock-logger-builder';

type GetProjectKeyAccessor = {
  getProjectKey(scannerOptions: string): string;
};

function buildAnalysis(
  configOverrides: Record<string, unknown> = {},
  sonarqubePath = '/tmp/unused-sonarqube-path',
  configurationRepository: { save: () => void } = { save: () => {} }
): SonarqubeLocalAnalysis {
  const configuration = {
    getSonarqubePath: () => sonarqubePath,
    ...configOverrides,
  };
  const logger = new MockLoggerBuilder().build();

  return new SonarqubeLocalAnalysis(
    configuration as never,
    configurationRepository as never,
    logger
  );
}

describe('SonarqubeLocalAnalysis', () => {
  describe('getProjectKey', () => {
    it('extracts a double-quoted -Dsonar.projectKey value', () => {
      const analysis = buildAnalysis();

      const projectKey = (analysis as unknown as GetProjectKeyAccessor).getProjectKey(
        '-Dsonar.projectKey="my-quoted-project"'
      );

      expect(projectKey).toBe('my-quoted-project');
    });

    it('extracts a single-quoted -Dsonar.projectKey value', () => {
      const analysis = buildAnalysis();

      const projectKey = (analysis as unknown as GetProjectKeyAccessor).getProjectKey(
        "-Dsonar.projectKey='my-single-quoted-project'"
      );

      expect(projectKey).toBe('my-single-quoted-project');
    });

    it('extracts a bare -Dsonar.projectKey value', () => {
      const analysis = buildAnalysis();

      const projectKey = (analysis as unknown as GetProjectKeyAccessor).getProjectKey(
        '-Dsonar.projectKey=my-bare-project'
      );

      expect(projectKey).toBe('my-bare-project');
    });

    it('falls back to config.sonarProject when no match is found', () => {
      const analysis = buildAnalysis({ sonarProject: 'fallback-project' });

      const projectKey = (analysis as unknown as GetProjectKeyAccessor).getProjectKey('');

      expect(projectKey).toBe('fallback-project');
    });

    it('falls back to a transformed config.githubRepository when sonarProject is absent', () => {
      const analysis = buildAnalysis({ githubRepository: 'owner/my.repo' });

      const projectKey = (analysis as unknown as GetProjectKeyAccessor).getProjectKey('');

      expect(projectKey).toBe('owner_my_repo');
    });

    it('falls back to an empty string when nothing is configured', () => {
      const analysis = buildAnalysis();

      const projectKey = (analysis as unknown as GetProjectKeyAccessor).getProjectKey('');

      expect(projectKey).toBe('');
    });
  });

  describe('readLocalServerUrl', () => {
    it('returns undefined when the local data file does not exist', async () => {
      const sonarqubePath = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-sq-local-'));
      const analysis = buildAnalysis({}, sonarqubePath);

      expect(analysis.readLocalServerUrl()).toBeUndefined();
    });

    it('returns the serverUrl when the local data file holds valid JSON', async () => {
      const sonarqubePath = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-sq-local-'));
      await fs.writeFile(
        path.join(sonarqubePath, 'local_sonarqube_data.json'),
        JSON.stringify({ serverUrl: 'http://localhost:9000' })
      );
      const analysis = buildAnalysis({}, sonarqubePath);

      expect(analysis.readLocalServerUrl()).toBe('http://localhost:9000');
    });

    it('returns undefined when the local data file holds invalid JSON', async () => {
      const sonarqubePath = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-sq-local-'));
      await fs.writeFile(path.join(sonarqubePath, 'local_sonarqube_data.json'), '{ not valid json');
      const analysis = buildAnalysis({}, sonarqubePath);

      expect(analysis.readLocalServerUrl()).toBeUndefined();
    });
  });

  describe('getToken', () => {
    it('returns the configured sonarLocalRunnerToken without making an HTTP request', async () => {
      const analysis = buildAnalysis({ sonarLocalRunnerToken: 'reused-token' });

      const token = await analysis.getToken('http://localhost:9000', 'admin', 'password');

      expect(token).toBe('reused-token');
    });
  });

  describe('HTTP-backed operations', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    describe('changePassword', () => {
      it('updates the password and persists it to local data on success', async () => {
        const sonarqubePath = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-sq-local-'));
        const fetchMock = vi.fn().mockResolvedValue({ ok: true });
        vi.stubGlobal('fetch', fetchMock);
        const analysis = buildAnalysis({}, sonarqubePath);

        const newPassword = await analysis.changePassword(
          'http://localhost:9000',
          'admin',
          'old-password',
          'new-password'
        );

        expect(newPassword).toBe('new-password');
        expect(fetchMock).toHaveBeenCalledWith(
          'http://localhost:9000/api/users/change_password',
          expect.objectContaining({ method: 'POST' })
        );

        const stored = JSON.parse(
          await fs.readFile(path.join(sonarqubePath, 'local_sonarqube_data.json'), 'utf-8')
        );
        expect(stored.username).toBe('admin');
        expect(stored.password).toBe('new-password');
        expect(stored.serverUrl).toBe('http://localhost:9000');
      });

      it('throws when the change password request fails', async () => {
        const sonarqubePath = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-sq-local-'));
        const fetchMock = vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          text: () => Promise.resolve('bad credentials'),
        });
        vi.stubGlobal('fetch', fetchMock);
        const analysis = buildAnalysis({}, sonarqubePath);

        await expect(
          analysis.changePassword('http://localhost:9000', 'admin', 'old-password', 'new-password')
        ).rejects.toThrow(
          'Failed to update SonarQube admin password. 401 Unauthorized - bad credentials'
        );
      });
    });

    describe('ensurePassword', () => {
      it('returns the stored password without calling fetch when one is already on disk', async () => {
        const sonarqubePath = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-sq-local-'));
        await fs.writeFile(
          path.join(sonarqubePath, 'local_sonarqube_data.json'),
          JSON.stringify({ serverUrl: 'http://localhost:9000', password: 'stored-password' })
        );
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        const analysis = buildAnalysis({}, sonarqubePath);

        const password = await analysis.ensurePassword('http://localhost:9000', 'admin', 'default');

        expect(password).toBe('stored-password');
        expect(fetchMock).not.toHaveBeenCalled();
      });

      it('generates and persists a new password when none is stored', async () => {
        const sonarqubePath = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-sq-local-'));
        const fetchMock = vi.fn().mockResolvedValue({ ok: true });
        vi.stubGlobal('fetch', fetchMock);
        const analysis = buildAnalysis({}, sonarqubePath);

        const password = await analysis.ensurePassword('http://localhost:9000', 'admin', 'default');

        expect(password).toMatch(/^smm-/);
        expect(fetchMock).toHaveBeenCalledWith(
          'http://localhost:9000/api/users/change_password',
          expect.objectContaining({ method: 'POST' })
        );

        const stored = JSON.parse(
          await fs.readFile(path.join(sonarqubePath, 'local_sonarqube_data.json'), 'utf-8')
        );
        expect(stored.password).toBe(password);
      });
    });

    describe('generateToken', () => {
      it('stores the generated token and persists configuration on success', async () => {
        const sonarqubePath = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-sq-local-'));
        const fetchMock = vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ token: 'generated-token', login: 'admin' }),
        });
        vi.stubGlobal('fetch', fetchMock);
        const save = vi.fn();
        const config: Record<string, unknown> = {};
        const analysis = buildAnalysis(config, sonarqubePath, { save });

        const token = await analysis.generateToken('http://localhost:9000', 'admin', 'password');

        expect(token).toBe('generated-token');
        expect(save).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith(
          'http://localhost:9000/api/user_tokens/generate',
          expect.objectContaining({ method: 'POST' })
        );

        const stored = JSON.parse(
          await fs.readFile(path.join(sonarqubePath, 'local_sonarqube_data.json'), 'utf-8')
        );
        expect(stored.tokenName).toBe('smm-sonarqube-local-token');
        expect(stored.login).toBe('admin');
      });

      it('throws when the generate token request fails', async () => {
        const sonarqubePath = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-sq-local-'));
        const fetchMock = vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: () => Promise.resolve(''),
        });
        vi.stubGlobal('fetch', fetchMock);
        const analysis = buildAnalysis({}, sonarqubePath);

        await expect(
          analysis.generateToken('http://localhost:9000', 'admin', 'password')
        ).rejects.toThrow('Failed to generate SonarQube token. 500 Internal Server Error');
      });

      it('throws when the response payload has no token', async () => {
        const sonarqubePath = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-sq-local-'));
        const fetchMock = vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({}),
        });
        vi.stubGlobal('fetch', fetchMock);
        const analysis = buildAnalysis({}, sonarqubePath);

        await expect(
          analysis.generateToken('http://localhost:9000', 'admin', 'password')
        ).rejects.toThrow('SonarQube token generation response did not include a token.');
      });
    });
  });
});
