import { DatabaseSync } from 'node:sqlite';
import { Logger } from '@smmachine/utils';
import { Configuration } from '../../../../infrastructure/configuration';
import type { CodeChurnResult, FileCoupling } from '../../../../providers/codemaat/types';
import { RepositoryFactory } from '../../../../infrastructure/repository-factory';
import { normalizePatternList } from '../../../../domain/code/pattern-filters';
import { CodeMaatMetricsCsvRepository } from './codemaat-metrics-repository-csv';
import type {
  CodeChurnValueResult,
  CodeMaatChurnOptions,
  CodeMaatEntityFilterOptions,
} from '../../../../domain/code/codemaat/repositories/codemaat-metrics-repository';

export class CodeMaatMetricsSqliteRepository extends CodeMaatMetricsCsvRepository {
  private readonly sqliteDbPath: string;

  constructor(configuration: Configuration, logger: Logger) {
    super(configuration, logger);
    this.sqliteDbPath =
      typeof configuration.getBaseDirectory === 'function'
        ? RepositoryFactory.getSqliteDatabasePath(configuration)
        : '';
  }

  override async getCodeChurn(
    options: CodeMaatChurnOptions & { typeChurn: string }
  ): Promise<CodeChurnValueResult>;
  override async getCodeChurn(options?: CodeMaatChurnOptions): Promise<CodeChurnResult>;
  override async getCodeChurn(
    options?: CodeMaatChurnOptions
  ): Promise<CodeChurnResult | CodeChurnValueResult> {
    const db = this.openSqlite();
    try {
      if (!this.tableExists(db, 'codemaat_code_churn')) {
        return {
          data: [],
          startDate: options?.startDate,
          endDate: options?.endDate,
        };
      }

      const startDate = options?.startDate ? this.toDateOnly(options.startDate) : undefined;
      const endDate = options?.endDate ? this.toDateOnly(options.endDate) : undefined;
      const rows = db
        .prepare(
          `SELECT date, added, deleted, commits
           FROM codemaat_code_churn
           WHERE (? IS NULL OR date >= ?)
             AND (? IS NULL OR date <= ?)
           ORDER BY date ASC, position ASC`
        )
        .all(startDate ?? null, startDate ?? null, endDate ?? null, endDate ?? null) as Array<{
        date: string;
        added: number;
        deleted: number;
        commits: number;
      }>;

      const data = rows.map((row) => ({
        date: row.date,
        added: this.toNumber(row.added),
        deleted: this.toNumber(row.deleted),
        commits: this.toNumber(row.commits),
      }));
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
    } finally {
      db.close();
    }
  }

  override async getFileCoupling(options?: CodeMaatEntityFilterOptions): Promise<FileCoupling[]> {
    const db = this.openSqlite();
    try {
      if (!this.tableExists(db, 'codemaat_file_coupling')) {
        return [];
      }

      const rows = db
        .prepare(
          `SELECT entity, coupled, degree, average_revs AS averageRevs
           FROM codemaat_file_coupling
           ORDER BY position ASC`
        )
        .all() as unknown as FileCoupling[];

      const filtered = rows
        .map((row) => ({
          entity: row.entity,
          coupled: row.coupled,
          degree: this.toNumber(row.degree),
          averageRevs: this.toNumber(row.averageRevs),
        }))
        .filter((row) => this.matchesCouplingFilters(row.entity, row.coupled, options));

      const sorted =
        options?.sortBy === 'degree' ? filtered.sort((a, b) => b.degree - a.degree) : filtered;
      return this.limitRows(sorted, options?.top);
    } finally {
      db.close();
    }
  }

  override async getEntityChurn(
    options?: CodeMaatEntityFilterOptions
  ): Promise<Array<{ entity: string; added: number; deleted: number; commits: number }>> {
    const db = this.openSqlite();
    try {
      if (!this.tableExists(db, 'codemaat_entity_churn')) {
        return [];
      }

      const rows = db
        .prepare(
          `SELECT entity, added, deleted, commits
           FROM codemaat_entity_churn
           ORDER BY position ASC`
        )
        .all() as Array<{ entity: string; added: number; deleted: number; commits: number }>;

      return rows
        .map((row) => ({
          entity: row.entity,
          added: this.toNumber(row.added),
          deleted: this.toNumber(row.deleted),
          commits: this.toNumber(row.commits),
        }))
        .filter((row) => row.entity.length > 0)
        .filter((row) => this.matchesEntityFilters(row.entity, options))
        .sort((a, b) => b.added + b.deleted - (a.added + a.deleted))
        .slice(0, this.resolveLimit(options?.top, Number.POSITIVE_INFINITY));
    } finally {
      db.close();
    }
  }

  override async getEntityEffort(
    options?: CodeMaatEntityFilterOptions
  ): Promise<Array<{ entity: string; 'total-revs': number }>> {
    const db = this.openSqlite();
    try {
      if (!this.tableExists(db, 'codemaat_entity_effort')) {
        return [];
      }

      const rows = db
        .prepare(
          `SELECT entity, total_revs
           FROM codemaat_entity_effort
           ORDER BY position ASC`
        )
        .all() as Array<{ entity: string; total_revs: number }>;

      const effortByEntity = new Map<string, number>();
      rows
        .map((row) => ({
          entity: row.entity,
          'total-revs': this.toNumber(row.total_revs),
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
    } finally {
      db.close();
    }
  }

  override async getEntityOwnership(
    options: CodeMaatEntityFilterOptions & { select: 'authors' }
  ): Promise<string[]>;
  override async getEntityOwnership(
    options?: CodeMaatEntityFilterOptions
  ): Promise<Array<{ entity: string; author: string; added: number; deleted: number }>>;
  override async getEntityOwnership(
    options?: CodeMaatEntityFilterOptions
  ): Promise<Array<{ entity: string; author: string; added: number; deleted: number }> | string[]> {
    const db = this.openSqlite();
    try {
      if (!this.tableExists(db, 'codemaat_entity_ownership')) {
        return options?.select === 'authors' ? [] : [];
      }

      const rows = db
        .prepare(
          `SELECT entity, author, added, deleted
           FROM codemaat_entity_ownership
           ORDER BY position ASC`
        )
        .all() as Array<{ entity: string; author: string; added: number; deleted: number }>;

      const authors = normalizePatternList(options?.authors).map((author) => author.toLowerCase());
      const filtered = rows
        .map((row) => ({
          entity: row.entity,
          author: row.author,
          added: this.toNumber(row.added),
          deleted: this.toNumber(row.deleted),
        }))
        .filter((row) => row.entity.length > 0 && row.author.length > 0)
        .filter((row) => this.matchesEntityFilters(row.entity, options))
        .filter((row) => authors.length === 0 || authors.includes(row.author.toLowerCase()))
        .sort((a, b) => b.added + b.deleted - (a.added + a.deleted));

      if (options?.select === 'authors') {
        return Array.from(
          new Set(filtered.map((row) => row.author).filter((author) => author.length > 0))
        ).sort();
      }

      return filtered.slice(0, this.resolveLimit(options?.top, Number.POSITIVE_INFINITY));
    } finally {
      db.close();
    }
  }

  private openSqlite(): DatabaseSync {
    return new DatabaseSync(this.sqliteDbPath);
  }

  private tableExists(db: DatabaseSync, tableName: string): boolean {
    return Boolean(
      db
        .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
        .get(tableName)
    );
  }
}
