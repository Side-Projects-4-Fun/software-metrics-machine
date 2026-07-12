'use server';

import { cookies } from 'next/headers';
import { getServerEnv } from '../config/server-env';

export interface ApiParams {
  start_date?: string;
  end_date?: string;
  [key: string]: string | number | undefined;
}

type WebappSettings = {
  fetchCache?: boolean;
};

function parseWebappSettings(value?: string): WebappSettings {
  if (!value) {
    return {};
  }

  try {
    return JSON.parse(decodeURIComponent(value)) as WebappSettings;
  } catch {
    return {};
  }
}

export async function fetchAPI<T>(endpoint: string, params?: ApiParams): Promise<T> {
  const { smmRestBaseUrl } = getServerEnv();
  const apiBaseUrl = `${smmRestBaseUrl}/api/v1`;
  const url = new URL(endpoint, apiBaseUrl);

  // Append active project from cookie if set
  const cookieStore = await cookies();
  const activeProject = cookieStore.get('smm_active_project')?.value;
  if (activeProject) {
    url.searchParams.append('project', decodeURIComponent(activeProject));
  }
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  const webappSettings = parseWebappSettings(cookieStore.get('smm_webapp_settings')?.value);
  const fetchCacheMode =
    webappSettings.fetchCache === true
      ? 'force-cache'
      : 'no-store';

  const response = await fetch(url.toString(), {
    headers: {
      'Content-Type': 'application/json',
    },
    cache: fetchCacheMode,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = body?.message || body?.error || response.statusText;
    throw new Error(`API error: ${message}`);
  }

  return response.json();
}
