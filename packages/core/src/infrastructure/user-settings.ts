import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface UserSettings {
  store_data_at?: string;
}

const SETTINGS_DIR = 'smm';
const SETTINGS_FILE = 'config.json';

export function getUserSettingsPath(env: Record<string, string | undefined>): string {
  const configHome = env.XDG_CONFIG_HOME || path.join(env.HOME || os.homedir(), '.config');
  return path.join(configHome, SETTINGS_DIR, SETTINGS_FILE);
}

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

export function saveUserSettings(
  env: Record<string, string | undefined>,
  settings: UserSettings
): string {
  const settingsPath = getUserSettingsPath(env);
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf-8');
  return settingsPath;
}

export function resolveStoreDataAt(env: Record<string, string | undefined>): string | undefined {
  const envValue = env.SMM_STORE_DATA_AT?.trim();
  if (envValue) {
    return path.resolve(envValue);
  }

  const settingsValue = loadUserSettings(env).store_data_at?.trim();
  return settingsValue ? path.resolve(settingsValue) : undefined;
}
