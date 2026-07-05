import * as fs from 'fs';
import { Logger } from '@smmachine/utils';
import type {
  CodeChurn,
  CodeChurnResult,
  CodemaatAnalysisResult,
  FileCoupling,
} from '../../../../providers/codemaat/types';
import { Configuration } from '../../../../infrastructure/configuration';
import path from 'path';
import { matchesPathPattern, normalizePatternList } from '../../../../domain/code/pattern-filters';
import type {
  CodeChurnValueResult,
  CodeMaatChurnOptions,
  CodeMaatEntityFilterOptions,
  ICodeMetricsRepository,
} from '../../../../domain/code/codemaat/repositories/codemaat-metrics-repository';

/**
 * Combines Git and CodeMaat providers with code metrics domain logic
 * Handles:
 * - Analyzing commits from git repository
 * - Calculating pairing index
 * - Loading code churn metrics
 * - Analyzing file coupling
 */
export class CodeMaatMetricsCsvRepository implements ICodeMetricsRepository {
  protected logger: Logger;
  protected dataDir: string;

  constructor(configuration: Configuration, logger: Logger) {
    this.dataDir = configuration.getCodeMaatPath();
    this.logger = logger;
  }

  async getCodeChurn(
    options: CodeMaatChurnOptions & { typeChurn: string }
  ): Promise<CodeChurnValueResult>;
  async getCodeChurn(options?: CodeMaatChurnOptions): Promise<CodeChurnResult>;
  async getCodeChurn(
    options?: CodeMaatChurnOptions
  ): Promise<CodeChurnResult | CodeChurnValueResult> {
    try {
      const csvPath = path.join(this.dataDir, 'abs-churn.csv');

      this.logger.info(
        `Reading code churn from ${csvPath}` +
          (options?.startDate ? ` from ${options.startDate}` : '') +
          (options?.endDate ? ` to ${options.endDate}` : '')
      );

      // Check if file exists
      if (!fs.existsSync(csvPath)) {
        this.logger.warn(`Code churn file not found: ${csvPath}`);
        return {
          data: [],
          startDate: options?.startDate,
          endDate: options?.endDate,
        };
      }

      const content = fs.readFileSync(csvPath, 'utf-8');
      const lines = content.trim().split('\n');

      if (lines.length < 2) {
        return {
          data: [],
          startDate: options?.startDate,
          endDate: options?.endDate,
        };
      }

      // Parse header
      const header = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));

      // Find column indices
      const dateIdx = header.indexOf('date') >= 0 ? header.indexOf('date') : header.indexOf('Date');
      const addedIdx = header.findIndex(
        (h) => h.toLowerCase().includes('added') || h.toLowerCase().includes('insertions')
      );
      const deletedIdx = header.findIndex(
        (h) => h.toLowerCase().includes('deleted') || h.toLowerCase().includes('deletions')
      );
      const commitsIdx = header.findIndex((h) => h.toLowerCase().includes('commit'));

      if (dateIdx < 0 || addedIdx < 0 || deletedIdx < 0) {
        this.logger.warn('Invalid code churn CSV format. Missing required columns.');
        return {
          data: [],
          startDate: options?.startDate,
          endDate: options?.endDate,
        };
      }

      // Parse data rows
      const data: CodeChurn[] = [];

      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));

        if (row.length <= Math.max(dateIdx, addedIdx, deletedIdx)) {
          continue; // Skip malformed rows
        }

        const date = row[dateIdx];
        const added = parseInt(row[addedIdx], 10);
        const deleted = parseInt(row[deletedIdx], 10);

        if (isNaN(added) || isNaN(deleted)) {
          continue; // Skip rows with non-numeric values
        }
        const commits = commitsIdx >= 0 ? parseInt(row[commitsIdx], 10) || 0 : 1;

        const startDate = options?.startDate ? this.toDateOnly(options.startDate) : undefined;
        const endDate = options?.endDate ? this.toDateOnly(options.endDate) : undefined;

        // CodeMaat churn rows are daily, so datetime filters are applied at day precision.
        if (startDate && date < startDate) {
          continue;
        }
        if (endDate && date > endDate) {
          continue;
        }

        data.push({ date, added, deleted, commits });
      }

      this.logger.info(`Parsed ${data.length} code churn records`);

      const result = {
        data,
        startDate: options?.startDate,
        endDate: options?.endDate,
      };

      if (!options || !Object.prototype.hasOwnProperty.call(options, 'typeChurn')) {
        return result;
      }

      const churnType = (options.typeChurn || 'total').toLowerCase();
      return {
        ...result,
        data: data.map((row) => ({
          date: row.date,
          type: churnType,
          value: this.getChurnValue(row, churnType),
        })),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to read code churn: ${errorMsg}`);
      throw error;
    }
  }

  async getFileCoupling(options?: CodeMaatEntityFilterOptions): Promise<FileCoupling[]> {
    try {
      const csvPath = path.join(this.dataDir, 'coupling.csv');

      this.logger.info(`Reading file coupling from ${csvPath}`);

      // Check if file exists
      if (!fs.existsSync(csvPath)) {
        this.logger.warn(`File coupling CSV not found: ${csvPath}`);
        return [];
      }

      const content = fs.readFileSync(csvPath, 'utf-8');
      const lines = content.trim().split('\n');

      if (lines.length < 2) {
        return [];
      }

      const delimiter = this.detectCsvDelimiter(lines[0]);

      // Parse header
      const header = this.parseCsvLine(lines[0], delimiter).map((h) =>
        h.trim().replace(/^"|"$/g, '')
      );

      // Find column indices — support multiple header conventions
      const file1Idx = header.findIndex(
        (h) =>
          h.toLowerCase() === 'entity' ||
          h.toLowerCase() === 'file1' ||
          h.toLowerCase() === 'entity1'
      );
      const file2Idx = header.findIndex(
        (h) =>
          h.toLowerCase() === 'coupled' ||
          h.toLowerCase() === 'file2' ||
          h.toLowerCase() === 'entity2'
      );
      const couplingIdx = header.findIndex(
        (h) =>
          h.toLowerCase() === 'degree' ||
          h.toLowerCase() === 'coupling_strength' ||
          h.toLowerCase() === 'strength'
      );

      const averageRevsIdx = header.findIndex((h) => h.toLowerCase().includes('average-revs'));

      if (file1Idx < 0 || file2Idx < 0 || couplingIdx < 0) {
        this.logger.warn('Invalid file coupling CSV format. Missing required columns.');
        return [];
      }

      // Parse data rows
      const coupleData: FileCoupling[] = [];

      for (let i = 1; i < lines.length; i++) {
        const row = this.parseCsvLine(lines[i], delimiter).map((v) =>
          v.trim().replace(/^"|"$/g, '')
        );

        if (row.length <= Math.max(file1Idx, file2Idx, couplingIdx)) {
          continue; // Skip malformed rows
        }

        const entity = row[file1Idx];
        const coupled = row[file2Idx];
        const degree = parseInt(row[couplingIdx], 10) || 0;
        const averageRevs = averageRevsIdx >= 0 ? parseInt(row[averageRevsIdx], 10) || 0 : 0;

        if (!this.matchesCouplingFilters(entity, coupled, options)) {
          continue;
        }

        coupleData.push({
          entity,
          coupled,
          degree,
          averageRevs,
        });
      }

      this.logger.info(`Parsed ${coupleData.length} file coupling relationships`);

      const sorted =
        options?.sortBy === 'degree' ? coupleData.sort((a, b) => b.degree - a.degree) : coupleData;
      return this.limitRows(sorted, options?.top);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to read file coupling: ${errorMsg}`);
      throw error;
    }
  }

  private detectCsvDelimiter(headerLine: string): string {
    const semicolons = (headerLine.match(/;/g) || []).length;
    const commas = (headerLine.match(/,/g) || []).length;
    return semicolons > commas ? ';' : ',';
  }

  private parseCsvLine(line: string, delimiter: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        // Handle escaped quote
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
          continue;
        }

        inQuotes = !inQuotes;
        continue;
      }

      if (!inQuotes && char === delimiter) {
        values.push(current);
        current = '';
        continue;
      }

      current += char;
    }

    values.push(current);
    return values;
  }

  async analyze(options?: {
    startDate?: string;
    endDate?: string;
    ignorePatterns?: string[];
  }): Promise<CodemaatAnalysisResult> {
    try {
      this.logger.info('Running CodeMaat analysis');

      const [churn, coupling] = await Promise.all([
        this.getCodeChurn({
          startDate: options?.startDate,
          endDate: options?.endDate,
        }),
        this.getFileCoupling({ ignorePatterns: options?.ignorePatterns }),
      ]);

      const result: CodemaatAnalysisResult = {
        churn,
        coupling,
      };

      this.logger.info('CodeMaat analysis completed');

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`CodeMaat analysis failed: ${errorMsg}`);
      throw error;
    }
  }

  async getEntityChurn(
    options?: CodeMaatEntityFilterOptions
  ): Promise<Array<{ entity: string; added: number; deleted: number; commits: number }>> {
    try {
      const records = this.readCsvRecords('entity-churn.csv');

      return records
        .map((record) => ({
          entity: String(record.entity || ''),
          added: this.toNumber(record.added),
          deleted: this.toNumber(record.deleted),
          commits: this.toNumber(record.commits),
        }))
        .filter((row) => row.entity.length > 0)
        .filter((row) => this.matchesEntityFilters(row.entity, options))
        .sort((a, b) => b.added + b.deleted - (a.added + a.deleted))
        .slice(0, this.resolveLimit(options?.top, Number.POSITIVE_INFINITY));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to read entity churn: ${errorMsg}`);
      throw error;
    }
  }

  async getEntityEffort(
    options?: CodeMaatEntityFilterOptions
  ): Promise<Array<{ entity: string; 'total-revs': number }>> {
    try {
      const records = this.readCsvRecords('entity-effort.csv');

      const effortByEntity = new Map<string, number>();

      records
        .map((record) => ({
          entity: String(record.entity || ''),
          'total-revs': this.toNumber(record['total-revs'] || record.total_revs || record.revs),
        }))
        .filter((row) => row.entity.length > 0)
        .filter((row) => this.matchesEntityFilters(row.entity, options))
        .forEach((row) => {
          effortByEntity.set(
            row.entity,
            Math.max(effortByEntity.get(row.entity) ?? 0, row['total-revs'])
          );
        });

      return Array.from(effortByEntity, ([entity, totalRevs]) => ({
        entity,
        'total-revs': totalRevs,
      }))
        .sort((a, b) => b['total-revs'] - a['total-revs'])
        .slice(0, this.resolveLimit(options?.top, Number.POSITIVE_INFINITY));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to read entity effort: ${errorMsg}`);
      throw error;
    }
  }

  async getEntityOwnership(
    options: CodeMaatEntityFilterOptions & { select: 'authors' }
  ): Promise<string[]>;
  async getEntityOwnership(
    options?: CodeMaatEntityFilterOptions
  ): Promise<Array<{ entity: string; author: string; added: number; deleted: number }>>;
  async getEntityOwnership(
    options?: CodeMaatEntityFilterOptions
  ): Promise<Array<{ entity: string; author: string; added: number; deleted: number }> | string[]> {
    try {
      const records = this.readCsvRecords('entity-ownership.csv');

      const rows = records
        .map((record) => ({
          entity: String(record.entity || ''),
          author: String(record.author || ''),
          added: this.toNumber(record.added),
          deleted: this.toNumber(record.deleted),
        }))
        .filter((row) => row.entity.length > 0 && row.author.length > 0)
        .filter((row) => this.matchesEntityFilters(row.entity, options))
        .filter((row) => {
          const authors = normalizePatternList(options?.authors).map((author) =>
            author.toLowerCase()
          );
          return authors.length === 0 || authors.includes(row.author.toLowerCase());
        })
        .sort((a, b) => b.added + b.deleted - (a.added + a.deleted));

      if (options?.select === 'authors') {
        return Array.from(
          new Set(rows.map((row) => row.author).filter((author) => author.length > 0))
        ).sort();
      }

      return rows.slice(0, this.resolveLimit(options?.top, Number.POSITIVE_INFINITY));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to read entity ownership: ${errorMsg}`);
      throw error;
    }
  }

  protected readCsvRecords(fileName: string): Array<Record<string, string>> {
    const csvPath = path.join(this.dataDir, fileName);

    if (!fs.existsSync(csvPath)) {
      this.logger.warn(`CSV file not found: ${csvPath}`);
      return [];
    }

    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) {
      return [];
    }

    const delimiter = this.detectCsvDelimiter(lines[0]);
    const headers = this.parseCsvLine(lines[0], delimiter).map((header) =>
      header.trim().replace(/^"|"$/g, '')
    );

    const records: Array<Record<string, string>> = [];
    for (let index = 1; index < lines.length; index += 1) {
      const values = this.parseCsvLine(lines[index], delimiter).map((value) =>
        value.trim().replace(/^"|"$/g, '')
      );

      if (values.length === 0) {
        continue;
      }

      const record: Record<string, string> = {};
      for (let col = 0; col < headers.length; col += 1) {
        record[headers[col]] = values[col] ?? '';
      }

      records.push(record);
    }

    return records;
  }

  protected toNumber(value: string | number | undefined): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === 'string') {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : 0;
    }

    return 0;
  }

  protected getChurnValue(row: CodeChurn, churnType: string): number {
    if (churnType === 'added') {
      return row.added;
    }
    if (churnType === 'deleted') {
      return row.deleted;
    }
    if (churnType === 'commits') {
      return row.commits;
    }
    return row.added + row.deleted;
  }

  protected toDateOnly(value: string): string {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }

    return value.split('T')[0];
  }

  protected limitRows<T>(rows: T[], top?: string | number): T[] {
    const limit = this.resolveLimit(top, Number.POSITIVE_INFINITY);
    return rows.slice(0, limit);
  }

  protected resolveLimit(top: string | number | undefined, fallback: number): number {
    if (top === undefined || top === null || top === '') {
      return fallback;
    }

    const parsed = Number(top);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  protected matchesEntityFilters(entity: string, options?: CodeMaatEntityFilterOptions): boolean {
    if (!entity) {
      return false;
    }

    const ignorePatterns = normalizePatternList(options?.ignorePatterns);
    const includePatterns = normalizePatternList(options?.includePatterns);

    if (ignorePatterns.some((pattern) => this.matchesPattern(entity, pattern))) {
      return false;
    }

    if (
      includePatterns.length > 0 &&
      !includePatterns.some((pattern) => this.matchesPattern(entity, pattern))
    ) {
      return false;
    }

    return true;
  }

  protected matchesCouplingFilters(
    entity: string,
    coupled: string,
    options?: CodeMaatEntityFilterOptions
  ): boolean {
    const ignorePatterns = normalizePatternList(options?.ignorePatterns);
    const includePatterns = normalizePatternList(options?.includePatterns);

    if (
      ignorePatterns.some(
        (pattern) => this.matchesPattern(entity, pattern) || this.matchesPattern(coupled, pattern)
      )
    ) {
      return false;
    }

    if (includePatterns.length === 0) {
      return true;
    }

    return includePatterns.some(
      (pattern) => this.matchesPattern(entity, pattern) || this.matchesPattern(coupled, pattern)
    );
  }

  private matchesPattern(entity: string, pattern: string): boolean {
    return matchesPathPattern(entity, pattern);
  }
}
