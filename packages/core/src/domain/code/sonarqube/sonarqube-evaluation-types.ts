export type SonarqubeEvaluationSeverity = 'critical' | 'warning' | 'good';
export type SonarqubeEvaluationCategory = 'quality' | 'complexity' | 'coverage';

export interface SonarqubeEvaluationSignal {
  id: string;
  title: string;
  description: string;
  severity: SonarqubeEvaluationSeverity;
  category: SonarqubeEvaluationCategory;
  metrics: Array<{
    label: string;
    value: string;
  }>;
}

export interface SonarqubeDashboardData {
  quality: {
    reliabilityRating: number;
    securityRating: number;
    maintainabilityRating: number;
    duplicationDensity: number;
  } | null;
  componentTree: Array<{
    key: string;
    name: string;
    complexity: number;
    cognitiveComplexity: number;
    ncloc: number;
    coverage: number;
    maintainabilityRating: number;
  }>;
}

export interface SonarqubeEvaluation {
  generatedAt: string;
  signals: SonarqubeEvaluationSignal[];
  summary: {
    totalComponents: number;
    avgComplexity: number;
    avgCoverage: number;
    totalNLOC: number;
    duplicationDensity: number;
    maintainabilityRating: number;
    reliabilityRating: number;
    securityRating: number;
  };
}
