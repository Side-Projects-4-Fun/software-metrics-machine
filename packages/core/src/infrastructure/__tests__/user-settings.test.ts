import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  getUserSettingsPath,
  loadUserSettings,
  resolveStoreDataAt,
  saveUserSettings,
} from '../user-settings';

describe('user-settings', () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  describe('getUserSettingsPath', () => {
    it('prefers XDG_CONFIG_HOME over HOME', () => {
      const env = { XDG_CONFIG_HOME: '/xdg', HOME: '/home' };
      expect(getUserSettingsPath(env)).toBe(join('/xdg', 'smm', 'config.json'));
    });

    it('falls back to HOME/.config when XDG_CONFIG_HOME is not set', () => {
      const env = { HOME: '/home' };
      expect(getUserSettingsPath(env)).toBe(join('/home', '.config', 'smm', 'config.json'));
    });
  });

  describe('loadUserSettings', () => {
    it('returns an empty object when the settings file does not exist', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-user-settings-'));
      const env = { HOME: join(tempDir, 'home') };
      expect(loadUserSettings(env)).toEqual({});
    });

    it('returns an empty object when the settings file is not valid JSON', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-user-settings-'));
      const configHome = join(tempDir, 'config');
      mkdirSync(join(configHome, 'smm'), { recursive: true });
      writeFileSync(join(configHome, 'smm', 'config.json'), '{invalid', 'utf-8');
      const env = { XDG_CONFIG_HOME: configHome };
      expect(loadUserSettings(env)).toEqual({});
    });

    it('reads store_data_at from the settings file', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-user-settings-'));
      const configHome = join(tempDir, 'config');
      mkdirSync(join(configHome, 'smm'), { recursive: true });
      writeFileSync(
        join(configHome, 'smm', 'config.json'),
        JSON.stringify({ store_data_at: '/data/dir' }),
        'utf-8'
      );
      const env = { XDG_CONFIG_HOME: configHome };
      expect(loadUserSettings(env)).toEqual({ store_data_at: '/data/dir' });
    });
  });

  describe('saveUserSettings', () => {
    it('creates the settings directory and writes the settings file', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-user-settings-'));
      const configHome = join(tempDir, 'config');
      const settingsPath = saveUserSettings(
        { XDG_CONFIG_HOME: configHome },
        { store_data_at: '/data/dir' }
      );

      expect(settingsPath).toBe(join(configHome, 'smm', 'config.json'));
      const saved = JSON.parse(readFileSync(settingsPath, 'utf-8')) as {
        store_data_at: string;
      };
      expect(saved.store_data_at).toBe('/data/dir');
    });
  });

  describe('resolveStoreDataAt', () => {
    it('returns the SMM_STORE_DATA_AT env var when set', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-user-settings-'));
      const env = { SMM_STORE_DATA_AT: join(tempDir, 'data'), HOME: join(tempDir, 'home') };
      expect(resolveStoreDataAt(env)).toBe(join(tempDir, 'data'));
    });

    it('returns the env var even when user settings store a different path', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-user-settings-'));
      const configHome = join(tempDir, 'config');
      mkdirSync(join(configHome, 'smm'), { recursive: true });
      writeFileSync(
        join(configHome, 'smm', 'config.json'),
        JSON.stringify({ store_data_at: '/from/settings' }),
        'utf-8'
      );
      const env = {
        SMM_STORE_DATA_AT: join(tempDir, 'data'),
        XDG_CONFIG_HOME: configHome,
      };
      expect(resolveStoreDataAt(env)).toBe(join(tempDir, 'data'));
    });

    it('falls back to store_data_at in user settings when the env var is not set', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-user-settings-'));
      const configHome = join(tempDir, 'config');
      mkdirSync(join(configHome, 'smm'), { recursive: true });
      writeFileSync(
        join(configHome, 'smm', 'config.json'),
        JSON.stringify({ store_data_at: '/from/settings' }),
        'utf-8'
      );
      const env = { XDG_CONFIG_HOME: configHome };
      expect(resolveStoreDataAt(env)).toBe('/from/settings');
    });

    it('returns undefined when neither the env var nor user settings are present', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-user-settings-'));
      const env = { HOME: join(tempDir, 'home') };
      expect(resolveStoreDataAt(env)).toBeUndefined();
    });
  });
});
