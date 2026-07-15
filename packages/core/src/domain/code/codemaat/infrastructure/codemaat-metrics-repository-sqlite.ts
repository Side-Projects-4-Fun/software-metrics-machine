import { DatabaseSync } from 'node:sqlite';
import { Logger } from '@smmachine/utils';
import { Configuration } from '../../../../infrastructure/configuration';
import type {
  CodeChurnResult,
  CodeMaatCodeChurnEntry,
  CodeMaatEntityChurnEntry,
  CodeMaatEntityEffortEntry,
  CodeMaatEntityOwnershipEntry,
  CodeMaatFileCouplingEntry,
  CodeMaatLayeredCouplingEntry,
  LayeredCoupling,
  FileCoupling,
} from '../../../../providers/codemaat/types';
import { RepositoryFactory } from '../../../../infrastructure/repository-factory';
import { applySqliteMigrations } from '../../../../infrastructure/sqlite-migrations';
import { normalizePatternList } from '../../../../domain/code/pattern-filters';
import { CodeMaatMetricsCsvRepository } from './codemaat-metrics-repository-csv';
import type {
  CodeChurnValueResult,
  CodeMaatChurnOptions,
  CodeMaatEntityFilterOptions,
  EntityChurnRecord,
  EntityEffortRecord,
  EntityOwnershipRecord,
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
      const latestFetchedAt = this.getLatestFetchedAt(db, 'codemaat_code_churn');
      const rows = db
        .prepare(
          `SELECT date, added, deleted, commits
           FROM codemaat_code_churn
           WHERE (? IS NULL OR date >= ?)
             AND (? IS NULL OR date <= ?)
             AND (? IS NULL OR COALESCE(fetched_at, stored_at) = ?)
           ORDER BY date ASC, position ASC`
        )
        .all(
          startDate ?? null,
          startDate ?? null,
          endDate ?? null,
          endDate ?? null,
          latestFetchedAt,
          latestFetchedAt
        ) as Array<{
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

  override async getCodeChurnHistory(
    options?: CodeMaatChurnOptions
  ): Promise<CodeMaatCodeChurnEntry[]> {
    const db = this.openSqlite();
    try {
      if (!this.tableExists(db, 'codemaat_code_churn')) {
        return [];
      }

      const startDate = options?.startDate ? this.toDateOnly(options.startDate) : undefined;
      const endDate = options?.endDate ? this.toDateOnly(options.endDate) : undefined;
      const rows = db
        .prepare(
          `SELECT date, added, deleted, commits, COALESCE(fetched_at, stored_at) AS fetchedAt
           FROM codemaat_code_churn
           WHERE (? IS NULL OR date >= ?)
             AND (? IS NULL OR date <= ?)
           ORDER BY fetchedAt ASC, date ASC, position ASC`
        )
        .all(startDate ?? null, startDate ?? null, endDate ?? null, endDate ?? null) as Array<{
        date: string;
        added: number;
        deleted: number;
        commits: number;
        fetchedAt: string;
      }>;

      const entries = new Map<string, CodeChurnResult>();
      for (const row of rows) {
        const fetchedAt = row.fetchedAt || new Date(0).toISOString();
        const existing = entries.get(fetchedAt) ?? {
          data: [],
          startDate: options?.startDate,
          endDate: options?.endDate,
        };

        existing.data.push({
          date: row.date,
          added: this.toNumber(row.added),
          deleted: this.toNumber(row.deleted),
          commits: this.toNumber(row.commits),
        });

        entries.set(fetchedAt, existing);
      }

      return Array.from(entries.entries()).map(([fetchedAt, data]) => ({ fetchedAt, data }));
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
           WHERE (? IS NULL OR COALESCE(fetched_at, stored_at) = ?)
           ORDER BY position ASC`
        )
        .all(
          this.getLatestFetchedAt(db, 'codemaat_file_coupling'),
          this.getLatestFetchedAt(db, 'codemaat_file_coupling')
        ) as unknown as FileCoupling[];

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

  override async getFileCouplingHistory(
    options?: CodeMaatEntityFilterOptions
  ): Promise<CodeMaatFileCouplingEntry[]> {
    const db = this.openSqlite();
    try {
      if (!this.tableExists(db, 'codemaat_file_coupling')) {
        return [];
      }

      const rows = db
        .prepare(
          `SELECT entity, coupled, degree, average_revs AS averageRevs,
                  COALESCE(fetched_at, stored_at) AS fetchedAt
           FROM codemaat_file_coupling
           ORDER BY fetchedAt ASC, position ASC`
        )
        .all() as Array<{
        entity: string;
        coupled: string;
        degree: number;
        averageRevs: number;
        fetchedAt: string;
      }>;

      const grouped = new Map<string, FileCoupling[]>();
      for (const row of rows) {
        const fetchedAt = row.fetchedAt || new Date(0).toISOString();
        const current = grouped.get(fetchedAt) ?? [];
        const normalized = {
          entity: row.entity,
          coupled: row.coupled,
          degree: this.toNumber(row.degree),
          averageRevs: this.toNumber(row.averageRevs),
        };

        if (this.matchesCouplingFilters(normalized.entity, normalized.coupled, options)) {
          current.push(normalized);
          grouped.set(fetchedAt, current);
        }
      }

      return Array.from(grouped.entries()).map(([fetchedAt, data]) => ({
        fetchedAt,
        data:
          options?.sortBy === 'degree'
            ? this.limitRows(
                [...data].sort((a, b) => b.degree - a.degree),
                options?.top
              )
            : this.limitRows(data, options?.top),
      }));
    } finally {
      db.close();
    }
  }

  override async getLayeredCoupling(
    options?: CodeMaatEntityFilterOptions
  ): Promise<LayeredCoupling[]> {
    const db = this.openSqlite();
    try {
      if (!this.tableExists(db, 'codemaat_layered_coupling')) {
        return [];
      }

      const rows = db
        .prepare(
          `SELECT entity, coupled, degree, average_revs AS averageRevs
           FROM codemaat_layered_coupling
           WHERE (? IS NULL OR COALESCE(fetched_at, stored_at) = ?)
           ORDER BY position ASC`
        )
        .all(
          this.getLatestFetchedAt(db, 'codemaat_layered_coupling'),
          this.getLatestFetchedAt(db, 'codemaat_layered_coupling')
        ) as unknown as LayeredCoupling[];

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

  override async getLayeredCouplingHistory(
    options?: CodeMaatEntityFilterOptions
  ): Promise<CodeMaatLayeredCouplingEntry[]> {
    const db = this.openSqlite();
    try {
      if (!this.tableExists(db, 'codemaat_layered_coupling')) {
        return [];
      }

      const rows = db
        .prepare(
          `SELECT entity, coupled, degree, average_revs AS averageRevs,
                  COALESCE(fetched_at, stored_at) AS fetchedAt
           FROM codemaat_layered_coupling
           ORDER BY fetchedAt ASC, position ASC`
        )
        .all() as Array<{
        entity: string;
        coupled: string;
        degree: number;
        averageRevs: number;
        fetchedAt: string;
      }>;

      const grouped = new Map<string, LayeredCoupling[]>();
      for (const row of rows) {
        const fetchedAt = row.fetchedAt || new Date(0).toISOString();
        const current = grouped.get(fetchedAt) ?? [];
        const normalized = {
          entity: row.entity,
          coupled: row.coupled,
          degree: this.toNumber(row.degree),
          averageRevs: this.toNumber(row.averageRevs),
        };

        if (this.matchesCouplingFilters(normalized.entity, normalized.coupled, options)) {
          current.push(normalized);
          grouped.set(fetchedAt, current);
        }
      }

      return Array.from(grouped.entries()).map(([fetchedAt, data]) => ({
        fetchedAt,
        data:
          options?.sortBy === 'degree'
            ? this.limitRows(
                [...data].sort((a, b) => b.degree - a.degree),
                options?.top
              )
            : this.limitRows(data, options?.top),
      }));
    } finally {
      db.close();
    }
  }

  override async getEntityChurn(
    options?: CodeMaatEntityFilterOptions
  ): Promise<EntityChurnRecord[]> {
    const db = this.openSqlite();
    try {
      if (!this.tableExists(db, 'codemaat_entity_churn')) {
        return [];
      }

      const rows = db
        .prepare(
          `SELECT entity, added, deleted, commits
           FROM codemaat_entity_churn
           WHERE (? IS NULL OR COALESCE(fetched_at, stored_at) = ?)
           ORDER BY position ASC`
        )
        .all(
          this.getLatestFetchedAt(db, 'codemaat_entity_churn'),
          this.getLatestFetchedAt(db, 'codemaat_entity_churn')
        ) as Array<{ entity: string; added: number; deleted: number; commits: number }>;

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

  override async getEntityChurnHistory(
    options?: CodeMaatEntityFilterOptions
  ): Promise<CodeMaatEntityChurnEntry[]> {
    const db = this.openSqlite();
    try {
      if (!this.tableExists(db, 'codemaat_entity_churn')) {
        return [];
      }

      const rows = db
        .prepare(
          `SELECT entity, added, deleted, commits, COALESCE(fetched_at, stored_at) AS fetchedAt
           FROM codemaat_entity_churn
           ORDER BY fetchedAt ASC, position ASC`
        )
        .all() as Array<{
        entity: string;
        added: number;
        deleted: number;
        commits: number;
        fetchedAt: string;
      }>;

      const grouped = new Map<string, EntityChurnRecord[]>();
      for (const row of rows) {
        const fetchedAt = row.fetchedAt || new Date(0).toISOString();
        const current = grouped.get(fetchedAt) ?? [];
        const normalized = {
          entity: row.entity,
          added: this.toNumber(row.added),
          deleted: this.toNumber(row.deleted),
          commits: this.toNumber(row.commits),
        };

        if (normalized.entity.length > 0 && this.matchesEntityFilters(normalized.entity, options)) {
          current.push(normalized);
          grouped.set(fetchedAt, current);
        }
      }

      return Array.from(grouped.entries()).map(([fetchedAt, data]) => ({
        fetchedAt,
        data: data
          .sort((a, b) => b.added + b.deleted - (a.added + a.deleted))
          .slice(0, this.resolveLimit(options?.top, Number.POSITIVE_INFINITY)),
      }));
    } finally {
      db.close();
    }
  }

  override async getEntityEffort(
    options?: CodeMaatEntityFilterOptions
  ): Promise<EntityEffortRecord[]> {
    const db = this.openSqlite();
    try {
      if (!this.tableExists(db, 'codemaat_entity_effort')) {
        return [];
      }

      const rows = db
        .prepare(
          `SELECT entity, total_revs
           FROM codemaat_entity_effort
           WHERE (? IS NULL OR COALESCE(fetched_at, stored_at) = ?)
           ORDER BY position ASC`
        )
        .all(
          this.getLatestFetchedAt(db, 'codemaat_entity_effort'),
          this.getLatestFetchedAt(db, 'codemaat_entity_effort')
        ) as Array<{ entity: string; total_revs: number }>;

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

  override async getEntityEffortHistory(
    options?: CodeMaatEntityFilterOptions
  ): Promise<CodeMaatEntityEffortEntry[]> {
    const db = this.openSqlite();
    try {
      if (!this.tableExists(db, 'codemaat_entity_effort')) {
        return [];
      }

      const rows = db
        .prepare(
          `SELECT entity, total_revs, COALESCE(fetched_at, stored_at) AS fetchedAt
           FROM codemaat_entity_effort
           ORDER BY fetchedAt ASC, position ASC`
        )
        .all() as Array<{ entity: string; total_revs: number; fetchedAt: string }>;

      const grouped = new Map<string, Map<string, number>>();
      for (const row of rows) {
        if (!row.entity || !this.matchesEntityFilters(row.entity, options)) {
          continue;
        }

        const fetchedAt = row.fetchedAt || new Date(0).toISOString();
        const entityMap = grouped.get(fetchedAt) ?? new Map<string, number>();
        const totalRevs = this.toNumber(row.total_revs);
        entityMap.set(row.entity, Math.max(entityMap.get(row.entity) ?? 0, totalRevs));
        grouped.set(fetchedAt, entityMap);
      }

      return Array.from(grouped.entries()).map(([fetchedAt, data]) => ({
        fetchedAt,
        data: Array.from(data, ([entity, totalRevs]) => ({ entity, 'total-revs': totalRevs }))
          .sort((a, b) => b['total-revs'] - a['total-revs'])
          .slice(0, this.resolveLimit(options?.top, Number.POSITIVE_INFINITY)),
      }));
    } finally {
      db.close();
    }
  }

  override async getEntityOwnership(
    options: CodeMaatEntityFilterOptions & { select: 'authors' }
  ): Promise<string[]>;
  override async getEntityOwnership(
    options?: CodeMaatEntityFilterOptions
  ): Promise<EntityOwnershipRecord[]>;
  override async getEntityOwnership(
    options?: CodeMaatEntityFilterOptions
  ): Promise<EntityOwnershipRecord[] | string[]> {
    const db = this.openSqlite();
    try {
      if (!this.tableExists(db, 'codemaat_entity_ownership')) {
        return options?.select === 'authors' ? [] : [];
      }

      const rows = db
        .prepare(
          `SELECT entity, author, added, deleted
           FROM codemaat_entity_ownership
           WHERE (? IS NULL OR COALESCE(fetched_at, stored_at) = ?)
           ORDER BY position ASC`
        )
        .all(
          this.getLatestFetchedAt(db, 'codemaat_entity_ownership'),
          this.getLatestFetchedAt(db, 'codemaat_entity_ownership')
        ) as Array<{ entity: string; author: string; added: number; deleted: number }>;

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

  override async getEntityOwnershipHistory(
    options?: CodeMaatEntityFilterOptions
  ): Promise<CodeMaatEntityOwnershipEntry[]> {
    if (options?.select === 'authors') {
      return [];
    }

    const db = this.openSqlite();
    try {
      if (!this.tableExists(db, 'codemaat_entity_ownership')) {
        return [];
      }

      const rows = db
        .prepare(
          `SELECT entity, author, added, deleted, COALESCE(fetched_at, stored_at) AS fetchedAt
           FROM codemaat_entity_ownership
           ORDER BY fetchedAt ASC, position ASC`
        )
        .all() as Array<{
        entity: string;
        author: string;
        added: number;
        deleted: number;
        fetchedAt: string;
      }>;

      const authors = normalizePatternList(options?.authors).map((author) => author.toLowerCase());
      const grouped = new Map<string, EntityOwnershipRecord[]>();

      for (const row of rows) {
        const normalized = {
          entity: row.entity,
          author: row.author,
          added: this.toNumber(row.added),
          deleted: this.toNumber(row.deleted),
        };

        if (!normalized.entity || !normalized.author) {
          continue;
        }
        if (!this.matchesEntityFilters(normalized.entity, options)) {
          continue;
        }
        if (authors.length > 0 && !authors.includes(normalized.author.toLowerCase())) {
          continue;
        }

        const fetchedAt = row.fetchedAt || new Date(0).toISOString();
        const current = grouped.get(fetchedAt) ?? [];
        current.push(normalized);
        grouped.set(fetchedAt, current);
      }

      return Array.from(grouped.entries()).map(([fetchedAt, data]) => ({
        fetchedAt,
        data: data
          .sort((a, b) => b.added + b.deleted - (a.added + a.deleted))
          .slice(0, this.resolveLimit(options?.top, Number.POSITIVE_INFINITY)),
      }));
    } finally {
      db.close();
    }
  }

  private openSqlite(): DatabaseSync {
    const db = new DatabaseSync(this.sqliteDbPath);
    applySqliteMigrations(db);
    return db;
  }

  private tableExists(db: DatabaseSync, tableName: string): boolean {
    return Boolean(
      db
        .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
        .get(tableName)
    );
  }

  private getLatestFetchedAt(db: DatabaseSync, tableName: string): string | null {
    if (!this.tableExists(db, tableName)) {
      return null;
    }

    const row = db
      .prepare(`SELECT MAX(COALESCE(fetched_at, stored_at)) AS latest FROM ${tableName}`)
      .get() as { latest: string | null };

    return row?.latest ?? null;
  }
}
