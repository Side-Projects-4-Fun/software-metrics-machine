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

  describe('sanitizeApiEndpoint (SSRF prevention)', () => {
    it('allows a valid absolute-path endpoint', async () => {
      await expect(fetchAPI('/projects')).resolves.toBeDefined();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/projects'),
        expect.anything()
      );
    });

    it('rejects an absolute-path endpoint that is not allow-listed', async () => {
      await expect(fetchAPI('/users')).rejects.toThrow('Invalid API endpoint');
    });

    it('rejects an empty endpoint', async () => {
      await expect(fetchAPI('')).rejects.toThrow('Invalid API endpoint');
    });

    it('rejects an endpoint with a protocol (http://)', async () => {
      await expect(fetchAPI('http://evil.com/path')).rejects.toThrow('Invalid API endpoint');
    });

    it('rejects an endpoint with a protocol (https://)', async () => {
      await expect(fetchAPI('https://evil.com/path')).rejects.toThrow('Invalid API endpoint');
    });

    it('rejects a protocol-relative URL (//evil.com)', async () => {
      await expect(fetchAPI('//evil.com/path')).rejects.toThrow('Invalid API endpoint');
    });

    it('rejects an endpoint without a leading slash', async () => {
      await expect(fetchAPI('relative/path')).rejects.toThrow('Invalid API endpoint');
    });

    it('rejects an endpoint containing a dot segment (/./)', async () => {
      await expect(fetchAPI('/./foo')).rejects.toThrow('Invalid API endpoint');
    });

    it('rejects an endpoint containing a dot segment in the middle (/foo/./bar)', async () => {
      await expect(fetchAPI('/foo/./bar')).rejects.toThrow('Invalid API endpoint');
    });

    it('rejects an endpoint containing a double-dot segment (/../)', async () => {
      await expect(fetchAPI('/../foo')).rejects.toThrow('Invalid API endpoint');
    });

    it('rejects an endpoint containing a double-dot segment in the middle (/foo/../bar)', async () => {
      await expect(fetchAPI('/foo/../bar')).rejects.toThrow('Invalid API endpoint');
    });

    it('rejects a whitespace-only endpoint', async () => {
      await expect(fetchAPI('   ')).rejects.toThrow('Invalid API endpoint');
    });
  });
});
