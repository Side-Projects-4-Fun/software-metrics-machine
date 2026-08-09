import * as fs from 'fs/promises';
import * as path from 'path';
import type { DatabaseSync } from 'node:sqlite';
import type { Configuration } from '../../../infrastructure';
import { RepositoryFactory } from '../../../infrastructure';
import { applySqliteMigrations } from '../../../infrastructure/sqlite-migrations';
import { openSqliteConnection } from '../../../infrastructure/sqlite-connection';
import type { TimeZoneProvider } from '../../../infrastructure/timezone-provider';
import type { RawFilter } from '../../../infrastructure/parse-raw-filters-repository';
import { ParseRawFiltersRepository } from '../../../infrastructure/parse-raw-filters-repository';
import type { ChangeRequestDetails, ChangeRequestFilters } from '../change-request-types';
import type {
  PullRequestCommentJsonResponse,
  PullRequestJsonResponse,
} from '../../../providers/github/github-response-types';
import type { IReadChangeRequestsRepository } from './change-requests-repository-json';
import {
  applyPayloadChangeRequestFilters,
  mapChangeRequestToDetails,
  normalizeChangeRequestFilterList,
} from './change-request-mapper';

type PayloadRow = {
  payload: string;
};

type SqlValue = string | number;

type PayloadQuery = {
  sql: string;
  params: SqlValue[];
};

export class ChangeRequestsSqliteRepository
  extends ParseRawFiltersRepository
  implements IReadChangeRequestsRepository
{
  private readonly sqliteDbPath: string;
  private readonly changeRequestsNamespace: string;
  private readonly changeRequestCommentsNamespace: string;

  constructor(
    configuration: Configuration,
    private readonly timeZoneProvider: TimeZoneProvider
  ) {
    super();
    this.sqliteDbPath = RepositoryFactory.getSqliteDatabasePath(configuration);
    this.changeRequestsNamespace = RepositoryFactory.getSqliteNamespace(
      `${configuration.getPathFromGitProvider()}/prs.json`,
      configuration
    );
    this.changeRequestCommentsNamespace = RepositoryFactory.getSqliteNamespace(
      `${configuration.getPathFromGitProvider()}/pr-comments.json`,
      configuration
    );
  }

  async loadChangeRequestsWithFilters(
    filters?: ChangeRequestFilters
  ): Promise<ChangeRequestDetails[]> {
    const rawChangeRequests = applyPayloadChangeRequestFilters(
      await this.loadChangeRequestPayloads(filters),
      filters,
      this.timeZoneProvider
    );
    if (rawChangeRequests.length === 0) {
      return [];
    }

    const commentsByChangeRequestNumber = await this.loadCommentsByChangeRequestNumber(
      rawChangeRequests.map((changeRequest) => Number(changeRequest.number)),
      filters
    );
    const mappedChangeRequests = rawChangeRequests.map((changeRequest) =>
      mapChangeRequestToDetails(
        changeRequest,
        commentsByChangeRequestNumber.get(Number(changeRequest.number)) || []
      )
    );

    return this.applyRawFilters(mappedChangeRequests, this.parseRawFilters(filters?.rawFilters));
  }

  private async loadChangeRequestPayloads(
    filters?: ChangeRequestFilters
  ): Promise<PullRequestJsonResponse[]> {
    const rows = await this.loadPayloadRows(
      'change_requests',
      this.buildChangeRequestsQuery(filters)
    );
    return rows.map((row) => JSON.parse(row.payload) as PullRequestJsonResponse);
  }

  private async loadCommentsByChangeRequestNumber(
    changeRequestNumbers: number[],
    filters?: ChangeRequestFilters
  ): Promise<Map<number, PullRequestCommentJsonResponse[]>> {
    const commentsByChangeRequestNumber = new Map<number, PullRequestCommentJsonResponse[]>();
    const uniqueNumbers = Array.from(new Set(changeRequestNumbers)).filter(Number.isFinite);
    if (uniqueNumbers.length === 0) {
      return commentsByChangeRequestNumber;
    }

    for (const numberChunk of this.chunkValues(uniqueNumbers, 500)) {
      const rows = await this.loadPayloadRows(
        'change_request_comments',
        this.buildChangeRequestCommentsQuery(numberChunk, filters)
      );

      for (const row of rows) {
        const comment = JSON.parse(row.payload) as PullRequestCommentJsonResponse;
        const changeRequestNumber = this.getChangeRequestNumberFromComment(comment);
        if (!Number.isFinite(changeRequestNumber)) {
          continue;
        }

        const comments = commentsByChangeRequestNumber.get(changeRequestNumber) || [];
        comments.push(comment);
        commentsByChangeRequestNumber.set(changeRequestNumber, comments);
      }
    }

    return commentsByChangeRequestNumber;
  }

  private buildChangeRequestsQuery(filters?: ChangeRequestFilters): PayloadQuery {
    const whereClauses = ['namespace = ?'];
    const params: SqlValue[] = [this.changeRequestsNamespace];

    if (filters?.startDate) {
      whereClauses.push('created_at >= ?');
      params.push(this.timeZoneProvider.getStartOfDayBoundary(filters.startDate).toISOString());
    }

    if (filters?.endDate) {
      whereClauses.push('created_at <= ?');
      params.push(this.timeZoneProvider.getEndOfDayBoundary(filters.endDate).toISOString());
    }

    this.addInFilter(
      whereClauses,
      params,
      'LOWER(author_login)',
      normalizeChangeRequestFilterList(filters?.authors).map((author) => author.toLowerCase())
    );
    this.addNotInFilter(
      whereClauses,
      params,
      'LOWER(author_login)',
      normalizeChangeRequestFilterList(filters?.excludeAuthors).map((author) =>
        author.toLowerCase()
      )
    );
    this.addStateFilter(whereClauses, filters?.state);

    return {
      sql: `SELECT payload
            FROM change_requests
            WHERE ${whereClauses.join(' AND ')}
            ORDER BY position ASC, number ASC, id ASC`,
      params,
    };
  }

  private buildChangeRequestCommentsQuery(
    changeRequestNumbers: number[],
    filters?: ChangeRequestFilters
  ): PayloadQuery {
    const whereClauses = [
      'namespace = ?',
      `change_request_number IN (${changeRequestNumbers.map(() => '?').join(', ')})`,
    ];
    const params: SqlValue[] = [this.changeRequestCommentsNamespace, ...changeRequestNumbers];

    this.addNotInFilter(
      whereClauses,
      params,
      'LOWER(author_login)',
      normalizeChangeRequestFilterList(filters?.excludeCommenters).map((commenter) =>
        commenter.toLowerCase()
      )
    );

    return {
      sql: `SELECT payload
            FROM change_request_comments
            WHERE ${whereClauses.join(' AND ')}
            ORDER BY position ASC, id ASC`,
      params,
    };
  }

  private addStateFilter(whereClauses: string[], state?: ChangeRequestFilters['state']): void {
    if (!state) {
      return;
    }

    if (state === 'merged') {
      whereClauses.push("NULLIF(merged_at, '') IS NOT NULL");
      return;
    }

    if (state === 'closed') {
      whereClauses.push("NULLIF(closed_at, '') IS NOT NULL");
      whereClauses.push("NULLIF(merged_at, '') IS NULL");
      return;
    }

    if (state === 'open') {
      whereClauses.push("NULLIF(closed_at, '') IS NULL");
      whereClauses.push("NULLIF(merged_at, '') IS NULL");
      return;
    }

    if (state === 'draft') {
      whereClauses.push("json_extract(payload, '$.draft') = 1");
    }
  }

  private addInFilter(
    whereClauses: string[],
    params: SqlValue[],
    columnExpression: string,
    values: string[]
  ): void {
    if (values.length === 0) {
      return;
    }

    whereClauses.push(`${columnExpression} IN (${values.map(() => '?').join(', ')})`);
    params.push(...values);
  }

  private addNotInFilter(
    whereClauses: string[],
    params: SqlValue[],
    columnExpression: string,
    values: string[]
  ): void {
    if (values.length === 0) {
      return;
    }

    whereClauses.push(`${columnExpression} NOT IN (${values.map(() => '?').join(', ')})`);
    params.push(...values);
  }

  private async loadPayloadRows(tableName: string, query: PayloadQuery): Promise<PayloadRow[]> {
    await fs.mkdir(path.dirname(this.sqliteDbPath), { recursive: true });
    const db = openSqliteConnection(this.sqliteDbPath);
    try {
      applySqliteMigrations(db);
      if (!this.tableExists(db, tableName)) {
        return [];
      }

      return db.prepare(query.sql).all(...query.params) as PayloadRow[];
    } finally {
      db.close();
    }
  }

  private tableExists(db: DatabaseSync, tableName: string): boolean {
    return Boolean(
      db
        .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
        .get(tableName)
    );
  }

  private getChangeRequestNumberFromComment(comment: PullRequestCommentJsonResponse): number {
    const match = comment.pull_request_url.match(/\/(?:pulls|merge_requests)\/(\d+)(?:$|[/?#])/);
    return match ? Number(match[1]) : Number.NaN;
  }

  private chunkValues<T>(values: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let index = 0; index < values.length; index += size) {
      chunks.push(values.slice(index, index + size));
    }
    return chunks;
  }

  private applyRawFilters(
    changeRequests: ChangeRequestDetails[],
    rawFilters: RawFilter[]
  ): ChangeRequestDetails[] {
    if (rawFilters.length === 0) {
      return changeRequests;
    }

    return changeRequests.filter((changeRequest) =>
      this.matchesRawFilters(changeRequest, rawFilters)
    );
  }
}
