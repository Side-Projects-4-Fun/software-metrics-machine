import type { MetricMethod } from '../metric-samples';

export type PipelineBottleneckSeverity = 'critical' | 'warning' | 'good';
export type PipelineBottleneckCategory = 'duration' | 'stability' | 'throughput';

export interface PipelineBottleneckSignal {
  id: string;
  title: string;
  description: string;
  severity: PipelineBottleneckSeverity;
  category: PipelineBottleneckCategory;
  metrics: Array<{
    label: string;
    value: string;
  }>;
}

export interface PipelineEvaluation {
  generatedAt: string;
  signals: PipelineBottleneckSignal[];
  summary: {
    totalRuns: number;
    durationMinutes: number;
    method: MetricMethod;
    successRate: number;
    failureRate: number;
    totalReruns: number;
    bottleneckJob?: string;
    bottleneckJobSharePercent?: number;
    slowestWorkflow?: string;
  };
}
