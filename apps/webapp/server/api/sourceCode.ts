import { ApiParams, fetchAPI } from './client';

export type BigOFileSummary = {
  filePath: string;
  fileName: string;
  classification: string;
  score: number;
  needsHelp: boolean;
};

export type BigOLineClassification = {
  lineNumber: number;
  content: string;
  classification: string;
  reason: string;
};

export type BigOFileAnalysis = BigOFileSummary & {
  content: string;
  lines: BigOLineClassification[];
};

export const sourceCodeAPI = {
  pairingIndex: (params?: ApiParams) =>
    fetchAPI<{
      pairing_index_percentage: number;
      total_analyzed_commits: number;
      paired_commits: number;
      top_pairs?: Array<{ author: string; co_author: string; paired_commits: number }>;
      latest_paired_commits?: Array<{
        hash: string;
        author: string;
        co_authors: string[];
        timestamp: string;
        subject: string;
      }>;
    }>(
      '/code/pairing-index',
      params
    ),
  
  entityChurn: (params?: ApiParams) =>
    fetchAPI<Array<{ entity: string; added: number; deleted: number; commits: number }>>(
      '/code/entity-churn',
      params
    ),
  
  codeChurn: (params?: ApiParams) =>
    fetchAPI<Array<{ date: string; type: string; value: number }>>(
      '/code/code-churn',
      params
    ),
  
  coupling: (params?: ApiParams) =>
    fetchAPI<Array<{ entity: string; coupled: string; degree: number; averageRevs: number }>>(
      '/code/coupling',
      params
    ),

  layeredCoupling: (params?: ApiParams) =>
    fetchAPI<Array<{ entity: string; coupled: string; degree: number; averageRevs: number }>>(
      '/code/layered-coupling',
      params
    ),
  
  entityEffort: (params?: ApiParams) =>
    fetchAPI<Array<{ entity: string; 'total-revs': number }>>(
      '/code/entity-effort',
      params
    ),
  
  entityOwnership: (params?: ApiParams) =>
    fetchAPI<Array<{ entity: string; author: string; added: number; deleted: number }>>(
      '/code/entity-ownership',
      params
    ),
  
  getAuthors: () =>
    fetchAPI<string[]>('/code/authors'),

  bigOFiles: (params?: ApiParams) =>
    fetchAPI<BigOFileSummary[]>('/code/big-o', params),
};
