const mockCookieValues = new Map<string, string>();

jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({
    get: jest.fn((name: string) => {
      const value = mockCookieValues.get(name);
      return value ? { value } : undefined;
    }),
  })),
}));

jest.mock('@/server/config/server-env', () => ({
  getServerEnv: jest.fn(() => ({ smmRestBaseUrl: 'http://rest.test' })),
}));

import { fetchAPI } from '@/server/api/client';

describe('fetchAPI', () => {
  beforeEach(() => {
    mockCookieValues.clear();
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ result: true }),
    })) as jest.Mock;
  });

  it('uses force-cache when the webapp settings cookie enables fetch caching', async () => {
    mockCookieValues.set(
      'smm_webapp_settings',
      encodeURIComponent(JSON.stringify({ fetchCache: true }))
    );

    await fetchAPI('/pipelines/summary');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://rest.test/pipelines/summary',
      expect.objectContaining({ cache: 'force-cache' })
    );
  });

  it('uses no-store when the webapp settings cookie is missing or malformed', async () => {
    mockCookieValues.set('smm_webapp_settings', '%7Bnot-json');

    await fetchAPI('/pipelines/summary');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://rest.test/pipelines/summary',
      expect.objectContaining({ cache: 'no-store' })
    );
  });
});
