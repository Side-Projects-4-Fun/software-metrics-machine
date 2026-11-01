'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TargetInfo } from '@/components/charts/TargetInfo';

export default function SonarqubeStatCard({
  title,
  value,
  color,
  metric,
}: {
  title: string;
  value: number;
  color: string;
  metric: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</CardTitle>
          <TargetInfo metric={metric} />
        </div>
      </CardHeader>
      <CardContent>
        <span className="text-4xl font-bold" style={{ color }}>{value}</span>
      </CardContent>
    </Card>
  );
}
