export interface SonarqubeComponentChartData {
  key: string;
  name: string;
  type?: string;
  qualifier?: string;
  complexity: number;
  cognitiveComplexity: number;
  ncloc: number;
  coverage: number;
  maintainabilityRating: number;
}

export interface SonarqubeTopMetricData {
  name: string;
  value: number;
  componentKey?: string;
}
