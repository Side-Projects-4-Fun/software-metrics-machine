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

  function createConfiguration(storageType: 'json' | 'sqlite'): Configuration {
    tempDir = mkdtempSync(join(tmpdir(), 'smm-pairing-factory-'));

    return new Configuration({
      storeData: tempDir,
      gitProvider: 'github',
      githubRepository: 'owner/repo',
      internal: { storageType },
    });
  }

  it('creates a pairing service backed by SQLite storage even when legacy JSON storage is configured', async () => {
    const service = PairingFactory.create(createConfiguration('json'), logger, timeZoneProvider);

    await expect(service.getPairingIndex()).resolves.toMatchObject({
      pairingIndexPercentage: 0,
      totalAnalyzedCommits: 0,
      pairedCommits: 0,
    });
  });

  it('creates a pairing service backed by SQLite storage when storage type is sqlite', async () => {
    const service = PairingFactory.create(createConfiguration('sqlite'), logger, timeZoneProvider);

    await expect(service.getPairingIndex()).resolves.toMatchObject({
      pairingIndexPercentage: 0,
      totalAnalyzedCommits: 0,
      pairedCommits: 0,
    });
  });
});
