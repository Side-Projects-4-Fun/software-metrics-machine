import { MetricOutlierRow } from '@/components/charts/OutliersCard';

interface OutlierLike {
  timestamp: string;
  value: number;
  lowerBound: number;
  upperBound: number;
  item: Record<string, unknown>;
}

export function toOutlierRows(metric: string, outliers: OutlierLike[] | undefined): MetricOutlierRow[] {
  return (outliers || []).map((outlier, index) => ({
    id: `${metric}-${index}-${outlier.timestamp}-${outlier.value}`,
    metric,
    value: outlier.value,
    timestamp: outlier.timestamp,
    lowerBound: outlier.lowerBound,
    upperBound: outlier.upperBound,
    item: outlier.item,
  }));
}
