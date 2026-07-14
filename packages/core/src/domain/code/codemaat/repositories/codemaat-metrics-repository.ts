import {
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

export interface ICodeMetricsRepository {
  getCodeChurn(
    options: CodeMaatChurnOptions & { typeChurn: string }
  ): Promise<CodeChurnValueResult>;
  getCodeChurn(options?: CodeMaatChurnOptions): Promise<CodeChurnResult>;
  getCodeChurnHistory(options?: CodeMaatChurnOptions): Promise<CodeMaatCodeChurnEntry[]>;
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
};

export type CodeMaatChurnOptions = {
  startDate?: string;
  endDate?: string;
  typeChurn?: string;
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
