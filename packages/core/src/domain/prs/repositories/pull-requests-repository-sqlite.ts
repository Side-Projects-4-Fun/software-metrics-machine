import * as fs from 'fs/promises';
import * as path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { Configuration, RepositoryFactory } from '../../../infrastructure';
import { TimeZoneProvider } from '../../../infrastructure/timezone-provider';
import {
  ParseRawFiltersRepository,
  RawFilter,
} from '../../../infrastructure/parse-raw-filters-repository';
import { PRDetails, PRFilters } from '../pr-types';
import {
  PullRequestCommentJsonResponse,
  PullRequestJsonResponse,
} from '../../../providers/github/github-response-types';
import { IReadPullRequestsRepository } from './pull-requests-repository-json';
import {
  applyPayloadPrFilters,
  mapPullRequestToDetails,
  normalizePrFilterList,
} from './pull-request-mapper';

type PayloadRow = {
  payload: string;
};

type SqlValue = string | number;

type PayloadQuery = {
  sql: string;
  params: SqlValue[];
};

export class PullRequestsSqliteRepository
  extends ParseRawFiltersRepository
  implements IReadPullRequestsRepository
{
  private readonly sqliteDbPath: string;
  private readonly pullRequestsNamespace: string;
  private readonly pullRequestCommentsNamespace: string;

  constructor(
    configuration: Configuration,
    private readonly timeZoneProvider: TimeZoneProvider
  ) {
    super();
    this.sqliteDbPath = RepositoryFactory.getSqliteDatabasePath(configuration);
    this.pullRequestsNamespace = RepositoryFactory.getSqliteNamespace(
      `${configuration.getPathFromGitProvider()}/prs.json`,
      configuration
    );
    this.pullRequestCommentsNamespace = RepositoryFactory.getSqliteNamespace(
      `${configuration.getPathFromGitProvider()}/pr-comments.json`,
      configuration
    );
  }

  async loadPrsWithFilters(filters?: PRFilters): Promise<PRDetails[]> {
    const rawPrs = applyPayloadPrFilters(
      await this.loadPullRequestPayloads(filters),
      filters,
      this.timeZoneProvider
    );
    if (rawPrs.length === 0) {
      return [];
    }

    const commentsByPullRequestNumber = await this.loadCommentsByPullRequestNumber(
      rawPrs.map((pr) => Number(pr.number)),
      filters
    );
    const mappedPrs = rawPrs.map((pr) =>
      mapPullRequestToDetails(pr, commentsByPullRequestNumber.get(Number(pr.number)) || [])
    );

    return this.applyRawFilters(mappedPrs, this.parseRawFilters(filters?.rawFilters));
  }

  private async loadPullRequestPayloads(filters?: PRFilters): Promise<PullRequestJsonResponse[]> {
    const rows = await this.loadPayloadRows('pull_requests', this.buildPullRequestsQuery(filters));
    return rows.map((row) => JSON.parse(row.payload) as PullRequestJsonResponse);
  }

  private async loadCommentsByPullRequestNumber(
    pullRequestNumbers: number[],
    filters?: PRFilters
  ): Promise<Map<number, PullRequestCommentJsonResponse[]>> {
    const commentsByPullRequestNumber = new Map<number, PullRequestCommentJsonResponse[]>();
    const uniqueNumbers = Array.from(new Set(pullRequestNumbers)).filter(Number.isFinite);
    if (uniqueNumbers.length === 0) {
      return commentsByPullRequestNumber;
    }

    for (const numberChunk of this.chunkValues(uniqueNumbers, 500)) {
      const rows = await this.loadPayloadRows(
        'pull_request_comments',
        this.buildPullRequestCommentsQuery(numberChunk, filters)
      );

      for (const row of rows) {
        const comment = JSON.parse(row.payload) as PullRequestCommentJsonResponse;
        const pullRequestNumber = this.getPullRequestNumberFromComment(comment);
        if (!Number.isFinite(pullRequestNumber)) {
          continue;
        }

        const comments = commentsByPullRequestNumber.get(pullRequestNumber) || [];
        comments.push(comment);
        commentsByPullRequestNumber.set(pullRequestNumber, comments);
      }
    }

    return commentsByPullRequestNumber;
  }

  private buildPullRequestsQuery(filters?: PRFilters): PayloadQuery {
    const whereClauses = ['namespace = ?'];
    const params: SqlValue[] = [this.pullRequestsNamespace];

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
      normalizePrFilterList(filters?.authors).map((author) => author.toLowerCase())
    );
    this.addNotInFilter(
      whereClauses,
      params,
      'LOWER(author_login)',
      normalizePrFilterList(filters?.excludeAuthors).map((author) => author.toLowerCase())
    );
    this.addStateFilter(whereClauses, filters?.state);

    return {
      sql: `SELECT payload
            FROM pull_requests
            WHERE ${whereClauses.join(' AND ')}
            ORDER BY position ASC, number ASC, id ASC`,
      params,
    };
  }

  private buildPullRequestCommentsQuery(
    pullRequestNumbers: number[],
    filters?: PRFilters
  ): PayloadQuery {
    const whereClauses = [
      'namespace = ?',
      `pull_request_number IN (${pullRequestNumbers.map(() => '?').join(', ')})`,
    ];
    const params: SqlValue[] = [this.pullRequestCommentsNamespace, ...pullRequestNumbers];

    this.addNotInFilter(
      whereClauses,
      params,
      'LOWER(author_login)',
      normalizePrFilterList(filters?.excludeCommenters).map((commenter) => commenter.toLowerCase())
    );

    return {
      sql: `SELECT payload
            FROM pull_request_comments
            WHERE ${whereClauses.join(' AND ')}
            ORDER BY position ASC, id ASC`,
      params,
    };
  }

  private addStateFilter(whereClauses: string[], state?: PRFilters['state']): void {
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
    const db = new DatabaseSync(this.sqliteDbPath);
    try {
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

  private getPullRequestNumberFromComment(comment: PullRequestCommentJsonResponse): number {
    const match = comment.pull_request_url.match(/\/pulls\/(\d+)(?:$|[/?#])/);
    return match ? Number(match[1]) : Number.NaN;
  }

  private chunkValues<T>(values: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let index = 0; index < values.length; index += size) {
      chunks.push(values.slice(index, index + size));
    }
    return chunks;
  }

  private applyRawFilters(prs: PRDetails[], rawFilters: RawFilter[]): PRDetails[] {
    if (rawFilters.length === 0) {
      return prs;
    }

    return prs.filter((pr) => this.matchesRawFilters(pr, rawFilters));
  }
}
