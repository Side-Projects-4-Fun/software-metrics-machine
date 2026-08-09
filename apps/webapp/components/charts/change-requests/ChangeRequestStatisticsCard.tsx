'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CommentsData, SummaryData } from './types';
import { useLinkBuilder } from '@/components/providers/LinkBuilderContext';
import { TargetInfo } from '@/components/charts/TargetInfo';
import { formatMetricLabel, formatMetricMethod } from '@/utils/formatMetricMethod';

function StatBoxLink({ label, value, filters, urlBuilder }: { label: string; value: number; filters?: { status?: string; author?: string; label?: string }; urlBuilder: ReturnType<typeof useLinkBuilder>['urlBuilder'] }) {
  const href = urlBuilder.getChangeRequestsUrl(filters);
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="block p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="text-3xl font-bold text-blue-600">{value}</p>
    </a>
  );
}

export default function ChangeRequestStatisticsCard({
  summary,
  commentsData,
  method,
}: {
  summary: SummaryData | null;
  commentsData: CommentsData | null;
  method?: string;
}) {
  const { urlBuilder } = useLinkBuilder();
  const labels = summary?.labels || [];
  const commentsLabel = formatMetricLabel(method, 'Comments');
  const detailedCommentsLabel = `${formatMetricMethod(method)} Comments Per Change Request (Detailed)`;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Change Request Statistics</CardTitle>
          <TargetInfo metric="change-request-statistics" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <StatBoxLink label="Total Change Requests" value={summary?.total_change_requests || 0} urlBuilder={urlBuilder} />
            <a href={urlBuilder.getChangeRequestsUrl({ status: 'merged' })} target="_blank" rel="noopener noreferrer" className="block p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
              <p className="text-sm text-gray-600">Merged</p>
              <p className="text-3xl font-bold text-green-600">{summary?.merged_change_requests || 0}</p>
            </a>
            <a href={urlBuilder.getChangeRequestsUrl({ status: 'closed' })} target="_blank" rel="noopener noreferrer" className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <p className="text-sm text-gray-600">Closed</p>
              <p className="text-3xl font-bold text-gray-600">{summary?.closed_change_requests || 0}</p>
            </a>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-gray-600">{commentsLabel}</p>
              <p className="text-3xl font-bold text-purple-600">{summary?.comments_per_change_request?.toFixed(2) || 0}</p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <p className="text-sm text-gray-600">Unique Authors</p>
              <p className="text-3xl font-bold text-orange-600">{summary?.unique_authors || 0}</p>
            </div>
            <div className="p-4 bg-pink-50 rounded-lg">
              <p className="text-sm text-gray-600">Unique Labels</p>
              <p className="text-3xl font-bold text-pink-600">{summary?.unique_labels || 0}</p>
            </div>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-600">{detailedCommentsLabel}</p>
            <p className="text-3xl font-bold text-blue-600">{commentsData?.comments_count?.toFixed(2) || 0}</p>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">Labels</p>

            {labels.length === 0 ? (
              <p className="text-sm text-gray-500">No labels available.</p>
            ) : (
              <ul className="space-y-2">
                {labels.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center justify-between rounded border bg-white px-3 py-2 hover:bg-gray-50"
                  >
                    <a
                      href={urlBuilder.getChangeRequestsUrl({ label: item.label })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-slate-700 hover:text-blue-600"
                    >
                      {item.label}
                    </a>
                    <span className="text-sm text-slate-500">{item.change_requests} Change Requests</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}