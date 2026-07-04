import { Configuration } from '../../infrastructure';
import { CodeMaatMetricsCsvRepository } from '../../aggregates/codemaat-metrics-repository-csv';
import type { Logger } from '@smmachine/utils';

/**
 * Thin wrapper around CodeMaatMetricsCsvRepository that accepts a plain
 * data-directory path instead of a full Configuration object.
 */
export class CodemaatAnalyzer extends CodeMaatMetricsCsvRepository {
  constructor(dataDir: string, logger: Logger) {
    super({ getCodeMaatPath: () => dataDir } as unknown as Configuration, logger);
  }
}
