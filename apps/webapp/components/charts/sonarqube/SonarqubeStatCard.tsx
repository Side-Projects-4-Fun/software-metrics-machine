'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TargetInfo } from '@/components/charts/TargetInfo';

function getMetricKey(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('reliability')) {return 'sonarqube-reliability';}
  if (t.includes('security')) {return 'sonarqube-security';}
  if (t.includes('maintainability')) {return 'sonarqube-maintainability';}
  if (t.includes('duplication')) {return 'sonarqube-duplication';}
  return 'sonarqube-coverage';
}

export default function SonarqubeStatCard({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</CardTitle>
          <TargetInfo metric={getMetricKey(title)} />
        </div>
      </CardHeader>
      <CardContent>
        <span className="text-4xl font-bold" style={{ color }}>{value}</span>
      </CardContent>
    </Card>
  );
}
