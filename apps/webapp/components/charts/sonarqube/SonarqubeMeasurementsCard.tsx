import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buildSonarqubeApiParams } from '@/server/utils/apiParams';
import { sonarqubeAPI } from '@/server/api';
import { DashboardFilters } from '@/components/filters/DashboardFilters';
import { TargetInfo } from '@/components/charts/TargetInfo';

interface SonarqubeMeasurementsCardProps {
  filters: DashboardFilters;
}

export default async function SonarqubeMeasurementsCard({ filters }: SonarqubeMeasurementsCardProps) {
  const apiParams = buildSonarqubeApiParams(filters);
  const measurements = await sonarqubeAPI.loadMeasurements(apiParams);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>SonarQube Measurements</CardTitle>
          <TargetInfo metric="sq-measurements" />
        </div>
      </CardHeader>
      <CardContent>
        {measurements && measurements.length > 0 ? (
          <ul>
            {measurements.map((measurement, index) => (
              <li key={index}>
                <strong>{measurement.metric}:</strong> {measurement.value}
              </li>
            ))}
          </ul>
        ) : (
          <p>No measurements found.</p>
        )}
      </CardContent>
    </Card>
  );
}
