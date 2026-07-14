import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@smmachine/utils';
import { Configuration } from '../../infrastructure';
import type {
  CodemaatFetchOptions,
  CodemaatFetchResult,
  CodeMaatPersistenceResult,
  ICodeMaatFetchRepository,
} from './codemaat-fetch-repository';

export class CodemaatFetchCsvRepository implements ICodeMaatFetchRepository {
  constructor(
    protected readonly configuration: Configuration,
    private readonly logger: Logger
  ) {}

  fetch(options: CodemaatFetchOptions): CodemaatFetchResult {
    if (!options.startDate) {
      throw new Error('startDate is required for CodeMaat fetch.');
    }

    const repositoryPath = options.repositoryPath || this.configuration.gitRepositoryLocation;
    if (!repositoryPath) {
      throw new Error('Git repository path is not configured.');
    }

    const outputDirectory = this.resolveOutputDirectory(options);
    fs.mkdirSync(outputDirectory, { recursive: true });

    const scriptPath = this.resolveScriptPath(options.scriptPath);
    const scriptDirectory = path.dirname(scriptPath);

    this.logger.info(`Running CodeMaat fetch script at ${scriptPath}`);

    const stdout = execFileSync(
      'sh',
      [
        scriptPath,
        repositoryPath,
        outputDirectory,
        options.startDate,
        options.endDate || this.toDateOnly(new Date().toISOString()),
        options.subfolder || '',
        options.force ? 'true' : 'false',
      ],
      {
        cwd: scriptDirectory,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    return {
      repository: repositoryPath,
      outputDirectory,
      stdout,
    };
  }

  async persistFetchedMetrics(): Promise<CodeMaatPersistenceResult> {
    return { persisted: false, records: 0 };
  }

  protected resolveOutputDirectory(options: CodemaatFetchOptions): string {
    const outputBaseDirectory = options.outputDirectory || this.configuration.getCodeMaatPath();
    const startDate = this.toDateOnly(options.startDate);
    const endDate = this.toDateOnly(options.endDate || new Date().toISOString());

    return path.join(outputBaseDirectory, `${startDate}_to_${endDate}`);
  }

  private toDateOnly(value: string): string {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }

    return value.split('T')[0];
  }

  private resolveScriptPath(explicitScriptPath?: string): string {
    if (explicitScriptPath && fs.existsSync(explicitScriptPath)) {
      return explicitScriptPath;
    }

    const scriptPath = path.resolve(__dirname, '../apps/cli/fetch-codemaat.sh');
    if (fs.existsSync(scriptPath)) {
      return scriptPath;
    }

    if (explicitScriptPath) {
      throw new Error(`Configured scriptPath does not exist: ${explicitScriptPath}`);
    }

    throw new Error(`Could not locate fetch-codemaat.sh at expected path: ${scriptPath}`);
  }
}
