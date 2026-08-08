import type {
  CodeChurn,
  CodeChurnResult,
  FileCoupling,
  CodeMaatCodeChurnEntry,
  CodeMaatEntityChurnEntry,
  CodeMaatEntityEffortEntry,
  CodeMaatEntityOwnershipEntry,
  CodeMaatFileCouplingEntry,
  CodeMaatLayeredCouplingEntry,
} from '../../../../providers/codemaat/types';

export type EntityChurnRecord = {
  entity: string;
  added: number;
  deleted: number;
  commits: number;
};

export type EntityEffortRecord = {
  entity: string;
  'total-revs': number;
};

export type EntityOwnershipRecord = {
  entity: string;
  author: string;
  added: number;
  deleted: number;
};

export type AuthorChurnRecord = {
  author: string;
  added: number;
  deleted: number;
  commits: number;
};

export interface ICodeMetricsRepository {
  getCodeChurn(options?: CodeMaatChurnOptions): Promise<CodeChurnResult>;
  getCodeChurnHistory(options?: CodeMaatChurnOptions): Promise<CodeMaatCodeChurnEntry[]>;
  getAuthorChurn(
    options?: CodeMaatChurnOptions & { authors?: string[] }
  ): Promise<AuthorChurnRecord[]>;
  getFileCoupling(options?: CodeMaatEntityFilterOptions): Promise<FileCoupling[]>;
  getFileCouplingHistory(
    options?: CodeMaatEntityFilterOptions
  ): Promise<CodeMaatFileCouplingEntry[]>;
  getLayeredCoupling(options?: CodeMaatEntityFilterOptions): Promise<FileCoupling[]>;
  getLayeredCouplingHistory(
    options?: CodeMaatEntityFilterOptions
  ): Promise<CodeMaatLayeredCouplingEntry[]>;
  getEntityChurn(options?: CodeMaatEntityFilterOptions): Promise<EntityChurnRecord[]>;
  getEntityChurnHistory(options?: CodeMaatEntityFilterOptions): Promise<CodeMaatEntityChurnEntry[]>;
  getEntityEffort(options?: CodeMaatEntityFilterOptions): Promise<EntityEffortRecord[]>;
  getEntityEffortHistory(
    options?: CodeMaatEntityFilterOptions
  ): Promise<CodeMaatEntityEffortEntry[]>;
  getEntityOwnership(
    options: CodeMaatEntityFilterOptions & { select: 'authors' }
  ): Promise<string[]>;
  getEntityOwnership(options?: CodeMaatEntityFilterOptions): Promise<EntityOwnershipRecord[]>;
  getEntityOwnershipHistory(
    options?: CodeMaatEntityFilterOptions
  ): Promise<CodeMaatEntityOwnershipEntry[]>;
}

export type CodeMaatEntityFilterOptions = {
  ignorePatterns?: string | string[];
  includePatterns?: string | string[];
  authors?: string | string[];
  top?: string | number;
  sortBy?: 'degree' | 'churn' | 'revs';
  select?: 'authors';
  startDate?: string;
  endDate?: string;
  minCoupling?: number;
};

export type CodeMaatChurnOptions = {
  startDate?: string;
  endDate?: string;
};

export type CodeChurnValue = {
  date: string;
  type: string;
  value: number;
};

export type CodeChurnValueResult = {
  data: CodeChurnValue[];
  startDate?: string;
  endDate?: string;
};

/**
 * Pure projection of a raw CodeChurnResult into a single-value series.
 *
 * The repository always returns raw rows ({ date, added, deleted, commits }).
 * This function selects one metric per row (added, deleted, commits, or the
 * added+deleted total) so the dashboard can plot a single `value` series.
 * Kept as a pure function so the projection logic lives in exactly one place
 * instead of being duplicated inside every repository implementation.
 */
export function projectCodeChurnValue(
  result: CodeChurnResult,
  typeChurn?: string
): CodeChurnValueResult {
  const churnType = (typeChurn || 'total').toLowerCase();

  return {
    data: result.data.map((row) => ({
      date: row.date,
      type: churnType,
      value: getChurnValue(row, churnType),
    })),
    startDate: result.startDate,
    endDate: result.endDate,
  };
}

export function getChurnValue(row: CodeChurn, churnType: string): number {
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
