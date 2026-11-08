import { Logger } from '@smmachine/utils';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Configuration } from '../../../../infrastructure';
import { TimeZoneProvider } from '../../../../infrastructure/timezone-provider';
import { PairingFactory } from '../../..';

describe('PairingFactory', () => {
  const logger = new Logger('PairingFactoryTest', 'CRITICAL');
  const timeZoneProvider = new TimeZoneProvider('UTC');
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  function createConfiguration(): Configuration {
    tempDir = mkdtempSync(join(tmpdir(), 'smm-pairing-factory-'));

    return new Configuration({
      storeData: tempDir,
      gitProvider: 'github',
      githubRepository: 'owner/repo',
    });
  }

  it('creates a pairing service backed by SQLite storage', async () => {
    const service = PairingFactory.create(createConfiguration(), logger, timeZoneProvider);

    await expect(service.getPairingIndex()).resolves.toMatchObject({
      pairingIndexPercentage: 0,
      totalAnalyzedCommits: 0,
      pairedCommits: 0,
    });
  });
});
