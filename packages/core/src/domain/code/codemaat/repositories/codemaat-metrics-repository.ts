import { CodeChurnResult, FileCoupling } from '../../../../providers/codemaat/types';

export interface ICodeMetricsRepository {
  getCodeChurn(
    options: CodeMaatChurnOptions & { typeChurn: string }
  ): Promise<CodeChurnValueResult>;
  getCodeChurn(options?: CodeMaatChurnOptions): Promise<CodeChurnResult>;
  getFileCoupling(options?: CodeMaatEntityFilterOptions): Promise<FileCoupling[]>;
  getEntityChurn(
    options?: CodeMaatEntityFilterOptions
  ): Promise<Array<{ entity: string; added: number; deleted: number; commits: number }>>;
  getEntityEffort(
    options?: CodeMaatEntityFilterOptions
  ): Promise<Array<{ entity: string; 'total-revs': number }>>;
  getEntityOwnership(
    options: CodeMaatEntityFilterOptions & { select: 'authors' }
  ): Promise<string[]>;
  getEntityOwnership(
    options?: CodeMaatEntityFilterOptions
  ): Promise<Array<{ entity: string; author: string; added: number; deleted: number }>>;
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
