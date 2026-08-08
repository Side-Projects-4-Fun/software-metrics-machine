import { describe, expect, it, vi } from 'vitest';
import { VersionController } from '../src/controllers/version.controller';

vi.mock('@smmachine/utils', () => ({
  getApplicationVersion: vi.fn(),
}));

import { getApplicationVersion } from '@smmachine/utils';

const mockedGetApplicationVersion = vi.mocked(getApplicationVersion);

describe('VersionController', () => {
  it('returns the application version from utils', () => {
    mockedGetApplicationVersion.mockReturnValue('9.9.9');
    const controller = new VersionController();

    const result = controller.version();

    expect(result).toEqual({ result: { version: '9.9.9' } });
  });

  it('propagates the fallback version when utils returns it', () => {
    mockedGetApplicationVersion.mockReturnValue('0.0.0');
    const controller = new VersionController();

    const result = controller.version();

    expect(result).toEqual({ result: { version: '0.0.0' } });
  });
});
