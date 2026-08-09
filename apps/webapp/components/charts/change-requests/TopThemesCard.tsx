'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLinkBuilder } from '@/components/providers/LinkBuilderContext';
import { TargetInfo } from '@/components/charts/TargetInfo';

interface Theme {
  text: string;
  value: number;
}

export default function TopThemesCard({ data }: { data: Theme[] }) {
  const { urlBuilder } = useLinkBuilder();
  const themes = Array.isArray(data) ? data : [];

  const buildThemeSearchUrl = (theme: string): string => {
    const changeRequestsUrl = urlBuilder.getChangeRequestsUrl();
    const [basePath] = changeRequestsUrl.split('?');
    return `${basePath}?q=${encodeURIComponent(theme)}`;
  };;

  const maxValue = themes.length > 0 ? Math.max(...themes.map((t) => t.value)) : 1;

  const getFontSize = (value: number): number => {
    const min = 12;
    const max = 36;
    return Math.round(min + ((value / maxValue) * (max - min)));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Top Themes in Comments</CardTitle>
          <TargetInfo metric="most-commented-change-requests" />
        </div>
        <p className="text-xs text-gray-500 mt-1">Click a theme to view related change requests</p>
      </CardHeader>
      <CardContent>
        {themes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No themes available.</p>
        ) : (
          <div className="flex flex-wrap gap-3 items-center">
            {themes.map(({ text, value }) => (
              <a
                key={text}
                href={buildThemeSearchUrl(text)}
                target="_blank"
                rel="noopener noreferrer"
                title={`${value} occurrence${value !== 1 ? 's' : ''}`}
                style={{ fontSize: `${getFontSize(value)}px` }}
                className="text-blue-600 hover:text-blue-800 hover:underline leading-tight"
              >
                {text}
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
