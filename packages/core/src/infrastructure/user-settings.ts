import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * User-level settings persisted outside the project data directory.
 *
 * The settings file lives at $XDG_CONFIG_HOME/smm/config.json (falling back to
 * ~/.config/smm/config.json) and currently only carries the default data
 * directory (store_data_at). It allows the CLI to run without setting
 * SMM_STORE_DATA_AT for every shell session.
 */
export interface UserSettings {
  store_data_at?: string;
}

const SETTINGS_DIR = 'smm';
const SETTINGS_FILE = 'config.json';

/**
 * Returns the absolute path of the user settings file.
 */
export function getUserSettingsPath(env: Record<string, string | undefined>): string {
  const configHome = env.XDG_CONFIG_HOME || path.join(env.HOME || os.homedir(), '.config');
  return path.join(configHome, SETTINGS_DIR, SETTINGS_FILE);
}

/**
 * Loads the user settings file. Missing files, invalid JSON, and non-object
 * payloads all resolve to an empty settings object.
 */
export function loadUserSettings(env: Record<string, string | undefined>): UserSettings {
  const settingsPath = getUserSettingsPath(env);

  if (!fs.existsSync(settingsPath)) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return parsed as UserSettings;
  } catch {
    return {};
  }
}

/**
 * Persists the given settings, creating the settings directory as needed.
 * Returns the path of the written settings file.
 */
export function saveUserSettings(
  env: Record<string, string | undefined>,
  settings: UserSettings
): string {
  const settingsPath = getUserSettingsPath(env);
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf-8');
  return settingsPath;
}

/**
 * Resolves the SMM data directory using the environment first and falling back
 * to the user settings file.
 *
 * Resolution order:
 * 1. SMM_STORE_DATA_AT environment variable
 * 2. store_data_at in the user settings file
 *
 * Returns undefined when neither source provides a data directory.
 */
export function resolveStoreDataAt(env: Record<string, string | undefined>): string | undefined {
  const envValue = env.SMM_STORE_DATA_AT?.trim();
  if (envValue) {
    return path.resolve(envValue);
  }

  const settingsValue = loadUserSettings(env).store_data_at?.trim();
  return settingsValue ? path.resolve(settingsValue) : undefined;
}
