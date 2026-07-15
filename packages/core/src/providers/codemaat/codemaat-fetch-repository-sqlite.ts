import * as fs from 'fs';
import * as path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { Logger } from '@smmachine/utils';
import { Configuration } from '../../infrastructure';
import { applySqliteMigrations } from '../../infrastructure/sqlite-migrations';
import { RepositoryFactory } from '../../infrastructure/repository-factory';
import { CodemaatFetchCsvRepository } from './codemaat-fetch-repository-csv';
import type {
  CodemaatFetchOptions,
  CodemaatFetchResult,
  CodeMaatPersistenceResult,
} from './codemaat-fetch-repository';

export class CodemaatFetchSqliteRepository extends CodemaatFetchCsvRepository {
  private readonly sqliteDbPath: string;
  private readonly codeMaatRunDirectoryPattern = /^\d{4}-\d{2}-\d{2}_to_\d{4}-\d{2}-\d{2}$/;

  constructor(configuration: Configuration, logger: Logger) {
    super(configuration, logger);
    this.sqliteDbPath = RepositoryFactory.getSqliteDatabasePath(configuration);
  }

  override fetch(options: CodemaatFetchOptions): CodemaatFetchResult {
    const result = super.fetch(options);
    const persistedRecords = this.importCsvFilesToSqlite(result.outputDirectory);

    return {
      ...result,
      persistedRecords,
    };
  }

  async persistFetchedMetrics(): Promise<CodeMaatPersistenceResult> {
    return {
      persisted: true,
      records: this.importCsvFilesToSqlite(this.resolveLatestDataDirectory()),
    };
  }

  private importCsvFilesToSqlite(sourceDirectory?: string): number {
    fs.mkdirSync(path.dirname(this.sqliteDbPath), { recursive: true });
    const db = new DatabaseSync(this.sqliteDbPath);
    try {
      applySqliteMigrations(db);
      db.exec('BEGIN IMMEDIATE TRANSACTION');
      try {
        const fetchedAt = new Date().toISOString();
        const dataDirectory = sourceDirectory || this.resolveLatestDataDirectory();
        const imported =
          this.importCodeChurn(db, fetchedAt, dataDirectory) +
          this.importFileCoupling(db, fetchedAt, dataDirectory) +
          this.importLayeredCoupling(db, fetchedAt, dataDirectory) +
          this.importEntityChurn(db, fetchedAt, dataDirectory) +
          this.importEntityEffort(db, fetchedAt, dataDirectory) +
          this.importEntityOwnership(db, fetchedAt, dataDirectory);
        db.exec('COMMIT');
        return imported;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    } finally {
      db.close();
    }
  }

  private readCsvRecords(fileName: string, sourceDirectory: string): Array<Record<string, string>> {
    const csvPath = path.join(sourceDirectory, fileName);

    if (!fs.existsSync(csvPath)) {
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

      const record: Record<string, string> = {};
      for (let col = 0; col < headers.length; col += 1) {
        record[headers[col]] = values[col] ?? '';
      }

      records.push(record);
    }

    return records;
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

  private toNumber(value: string | number | undefined): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === 'string') {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : 0;
    }

    return 0;
  }

  private getNextPosition(db: DatabaseSync, tableName: string): number {
    const row = db
      .prepare(`SELECT COALESCE(MAX(position), -1) AS max_position FROM ${tableName}`)
      .get() as { max_position: number };

    return this.toNumber(row?.max_position) + 1;
  }

  private importCodeChurn(db: DatabaseSync, fetchedAt: string, sourceDirectory: string): number {
    const records = this.readCsvRecords('abs-churn.csv', sourceDirectory);
    const insert = db.prepare(
      `INSERT INTO codemaat_code_churn
        (date, added, deleted, commits, position, stored_at, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const positionStart = this.getNextPosition(db, 'codemaat_code_churn');
    let imported = 0;

    records.forEach((record, position) => {
      const date = String(record.date || record.Date || '');
      const added = this.toNumber(record.added || record.Added || record.insertions);
      const deleted = this.toNumber(record.deleted || record.Deleted || record.deletions);
      const commits = this.toNumber(record.commits || record.Commits || record.revisions || 1);

      if (!date || (!added && !deleted)) {
        return;
      }

      insert.run(
        date,
        added,
        deleted,
        commits || 1,
        positionStart + position,
        fetchedAt,
        fetchedAt
      );
      imported += 1;
    });

    return imported;
  }

  private importFileCoupling(db: DatabaseSync, fetchedAt: string, sourceDirectory: string): number {
    const records = this.readCsvRecords('coupling.csv', sourceDirectory);
    const insert = db.prepare(
      `INSERT INTO codemaat_file_coupling
        (entity, coupled, degree, average_revs, position, stored_at, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const positionStart = this.getNextPosition(db, 'codemaat_file_coupling');
    let imported = 0;

    records.forEach((record, position) => {
      const entity = String(record.entity || record.file1 || record.entity1 || '');
      const coupled = String(record.coupled || record.file2 || record.entity2 || '');
      const degree = this.toNumber(record.degree || record.coupling_strength || record.strength);
      const averageRevs = this.toNumber(record['average-revs'] || record.average_revs);

      if (!entity || !coupled) {
        return;
      }

      insert.run(
        entity,
        coupled,
        degree,
        averageRevs,
        positionStart + position,
        fetchedAt,
        fetchedAt
      );
      imported += 1;
    });

    return imported;
  }

  private importLayeredCoupling(
    db: DatabaseSync,
    fetchedAt: string,
    sourceDirectory: string
  ): number {
    const records = this.readCsvRecords('coupling-layers.csv', sourceDirectory);
    const insert = db.prepare(
      `INSERT INTO codemaat_layered_coupling
        (entity, coupled, degree, average_revs, position, stored_at, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const positionStart = this.getNextPosition(db, 'codemaat_layered_coupling');
    let imported = 0;

    records.forEach((record, position) => {
      const entity = String(record.entity || record.file1 || record.entity1 || '');
      const coupled = String(record.coupled || record.file2 || record.entity2 || '');
      const degree = this.toNumber(record.degree || record.coupling_strength || record.strength);
      const averageRevs = this.toNumber(record['average-revs'] || record.average_revs);

      if (!entity || !coupled) {
        return;
      }

      insert.run(
        entity,
        coupled,
        degree,
        averageRevs,
        positionStart + position,
        fetchedAt,
        fetchedAt
      );
      imported += 1;
    });

    return imported;
  }

  private importEntityChurn(db: DatabaseSync, fetchedAt: string, sourceDirectory: string): number {
    const records = this.readCsvRecords('entity-churn.csv', sourceDirectory);
    const insert = db.prepare(
      `INSERT INTO codemaat_entity_churn
        (entity, added, deleted, commits, position, stored_at, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const positionStart = this.getNextPosition(db, 'codemaat_entity_churn');
    let imported = 0;

    records.forEach((record, position) => {
      const entity = String(record.entity || '');
      if (!entity) {
        return;
      }

      insert.run(
        entity,
        this.toNumber(record.added),
        this.toNumber(record.deleted),
        this.toNumber(record.commits),
        positionStart + position,
        fetchedAt,
        fetchedAt
      );
      imported += 1;
    });

    return imported;
  }

  private importEntityEffort(db: DatabaseSync, fetchedAt: string, sourceDirectory: string): number {
    const records = this.readCsvRecords('entity-effort.csv', sourceDirectory);
    const insert = db.prepare(
      `INSERT INTO codemaat_entity_effort
        (entity, total_revs, position, stored_at, fetched_at)
       VALUES (?, ?, ?, ?, ?)`
    );
    const positionStart = this.getNextPosition(db, 'codemaat_entity_effort');
    let imported = 0;

    records.forEach((record, position) => {
      const entity = String(record.entity || '');
      if (!entity) {
        return;
      }

      insert.run(
        entity,
        this.toNumber(record['total-revs'] || record.total_revs || record.revs),
        positionStart + position,
        fetchedAt,
        fetchedAt
      );
      imported += 1;
    });

    return imported;
  }

  private importAge(db: DatabaseSync, fetchedAt: string, sourceDirectory: string): number {
    const records = this.readCsvRecords('age.csv', sourceDirectory);
    const insert = db.prepare(
      `INSERT INTO codemaat_age
        (entity, age_months, position, stored_at, fetched_at)
       VALUES (?, ?, ?, ?, ?)`
    );
    const positionStart = this.getNextPosition(db, 'codemaat_age');
    let imported = 0;

    records.forEach((record, position) => {
      const entity = String(record.entity || '');
      if (!entity) {
        return;
      }

      insert.run(
        entity,
        this.toNumber(record['age-months'] || record.age_months || record.ageMonths),
        positionStart + position,
        fetchedAt,
        fetchedAt
      );
      imported += 1;
    });

    return imported;
  }

  private importAuthorChurn(db: DatabaseSync, fetchedAt: string, sourceDirectory: string): number {
    const records = this.readCsvRecords('author-churn.csv', sourceDirectory);
    const insert = db.prepare(
      `INSERT INTO codemaat_author_churn
        (author, added, deleted, commits, position, stored_at, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const positionStart = this.getNextPosition(db, 'codemaat_author_churn');
    let imported = 0;

    records.forEach((record, position) => {
      const author = String(record.author || '');
      if (!author) {
        return;
      }

      insert.run(
        author,
        this.toNumber(record.added),
        this.toNumber(record.deleted),
        this.toNumber(record.commits || record.revisions),
        positionStart + position,
        fetchedAt,
        fetchedAt
      );
      imported += 1;
    });

    return imported;
  }

  private importEntityOwnership(
    db: DatabaseSync,
    fetchedAt: string,
    sourceDirectory: string
  ): number {
    const records = this.readCsvRecords('entity-ownership.csv', sourceDirectory);
    const insert = db.prepare(
      `INSERT INTO codemaat_entity_ownership
        (entity, author, added, deleted, position, stored_at, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const positionStart = this.getNextPosition(db, 'codemaat_entity_ownership');
    let imported = 0;

    records.forEach((record, position) => {
      const entity = String(record.entity || '');
      const author = String(record.author || '');
      if (!entity || !author) {
        return;
      }

      insert.run(
        entity,
        author,
        this.toNumber(record.added),
        this.toNumber(record.deleted),
        positionStart + position,
        fetchedAt,
        fetchedAt
      );
      imported += 1;
    });

    return imported;
  }

  private resolveLatestDataDirectory(): string {
    const codemaatPath = this.configuration.getCodeMaatPath();

    if (!fs.existsSync(codemaatPath)) {
      return codemaatPath;
    }

    const runDirectories = fs
      .readdirSync(codemaatPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && this.codeMaatRunDirectoryPattern.test(entry.name))
      .map((entry) => entry.name)
      .sort((a, b) => b.localeCompare(a));

    if (runDirectories.length === 0) {
      return codemaatPath;
    }

    return path.join(codemaatPath, runDirectories[0]);
  }
}
