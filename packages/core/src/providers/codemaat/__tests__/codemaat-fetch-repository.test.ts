import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { Configuration } from '../../../infrastructure';
import { CodemaatFetchRepository } from '../codemaat-fetch-repository';
import { MockLoggerBuilder } from '../../../test/mock-logger-builder';

describe('CodemaatFetchRepository', () => {
  const logger = new MockLoggerBuilder().build();

  it('throws when startDate is missing', () => {
    const configuration = new Configuration({ gitRepositoryLocation: '/some/path' });
    const repository = new CodemaatFetchRepository(configuration, logger);

    expect(() => repository.fetch({ startDate: '' })).toThrow(
      'startDate is required for CodeMaat fetch.'
    );
  });

  it('throws when no repository path is configured', () => {
    const configuration = new Configuration({ gitRepositoryLocation: '' });
    const repository = new CodemaatFetchRepository(configuration, logger);

    expect(() => repository.fetch({ startDate: '2026-01-01' })).toThrow(
      'Git repository path is not configured.'
    );
  });

  it('throws when the configured scriptPath does not exist', () => {
    const configuration = new Configuration({ gitRepositoryLocation: '/some/path' });
    const repository = new CodemaatFetchRepository(configuration, logger);
    const missingScriptPath = path.join(os.tmpdir(), 'smm-codemaat-missing-script.sh');

    expect(() =>
      repository.fetch({
        startDate: '2026-01-01',
        outputDirectory: fs.mkdtempSync(path.join(os.tmpdir(), 'smm-codemaat-out-')),
        scriptPath: missingScriptPath,
      })
    ).toThrow(`Configured scriptPath does not exist: ${missingScriptPath}`);
  });

  it('throws when no scriptPath is given and the default fetch-codemaat.sh cannot be located', () => {
    const configuration = new Configuration({ gitRepositoryLocation: '/some/path' });
    const repository = new CodemaatFetchRepository(configuration, logger);
    const expectedDefaultScriptPath = path.resolve(
      __dirname,
      '../../../../src/providers/apps/cli/fetch-codemaat.sh'
    );

    expect(() =>
      repository.fetch({
        startDate: '2026-01-01',
        outputDirectory: fs.mkdtempSync(path.join(os.tmpdir(), 'smm-codemaat-out-')),
      })
    ).toThrow(`Could not locate fetch-codemaat.sh at expected path: ${expectedDefaultScriptPath}`);
  });

  it('fetches successfully using a real script, creating the output directory and returning its stdout', () => {
    const configuration = new Configuration({ gitRepositoryLocation: '/some/path' });
    const repository = new CodemaatFetchRepository(configuration, logger);

    const scriptDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'smm-codemaat-script-'));
    const scriptPath = path.join(scriptDirectory, 'fetch-codemaat.sh');
    fs.writeFileSync(scriptPath, 'echo "ran: $1 $2 $3 $4 $5"');

    const outputDirectory = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'smm-codemaat-out-')),
      'nested'
    );

    const result = repository.fetch({
      repositoryPath: '/explicit/repo/path',
      outputDirectory,
      startDate: '2026-01-01',
      subfolder: 'sub',
      force: true,
      scriptPath,
    });

    expect(fs.existsSync(outputDirectory)).toBe(true);
    expect(result).toEqual({
      repository: '/explicit/repo/path',
      outputDirectory,
      stdout: `ran: /explicit/repo/path ${outputDirectory} 2026-01-01 sub true\n`,
    });
  });
});
