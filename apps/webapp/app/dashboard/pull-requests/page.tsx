import {defaultFilters, parseDashboardFilters} from "@/components/filters/DashboardFilters";
import {pullRequestAPI} from '@/server/api';
import {buildPullRequestApiParams} from '@/server/utils/apiParams';
import {ensureArray} from '@/server/utils/chartData';
import PRsByAuthorCard from '@/components/charts/pull-requests/PRsByAuthorCard';
import AverageReviewTimeCard from '@/components/charts/pull-requests/AverageReviewTimeCard';
import OpenPRsThroughTimeCard from '@/components/charts/pull-requests/OpenPRsThroughTimeCard';
import TopThemesCard from '@/components/charts/pull-requests/TopThemesCard';
import AverageDaysPRsRemainOpenCard from '@/components/charts/pull-requests/AverageDaysPRsRemainOpenCard';
import PRStatisticsCard from '@/components/charts/pull-requests/PRStatisticsCard';
import MostCommentedPRsCard from '@/components/charts/pull-requests/MostCommentedPRsCard';
import CommentsByAuthorCard from '@/components/charts/pull-requests/CommentsByAuthorCard';
import FirstCommentTimeCard from '@/components/charts/pull-requests/FirstCommentTimeCard';
import OutliersCard, { MetricOutlierRow } from '@/components/charts/OutliersCard';
import PREvaluationCard from '@/components/charts/pull-requests/PREvaluationCard';
import { toOutlierRows } from '@/components/charts/outliers-utils';
import {
  AvgCommentsData,
  AvgOpenByData,
  AvgReviewTimeData,
  ByAuthorData,
  CommentsByAuthorData,
  FirstCommentTimeData,
  OpenThroughTimeData,
  OpenThroughTimeResponseItem,
  SummaryData,
} from '@/components/charts/pull-requests/types';

type ResultWrapper<T> = {
  result: T;
};

function unwrapResult<T>(data: T | ResultWrapper<T>): T {
  if (typeof data === 'object' && data !== null && 'result' in data) {
    return data.result;
  }
  return data;
}

interface EvaluationData {
  generatedAt: string;
  signals: Array<{
    id: string;
    title: string;
    description: string;
    severity: 'critical' | 'warning' | 'good';
    category: string;
    metrics: Array<{ label: string; value: string }>;
  }>;
  summary: {
    totalPRs: number;
    mergedPRs: number;
    openPRs: number;
    avgCommentsPerPR: number;
    avgReviewHours: number;
    avgOpenDays: number;
    uniqueAuthors: number;
    topReviewer?: string;
    bottleneckAuthor?: string;
  };
}

export default async function PullRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseDashboardFilters(await searchParams ?? {}, defaultFilters);
  let byAuthor: ByAuthorData[] = [];
  let avgReviewTime: AvgReviewTimeData[] = [];
  let openThroughTime: OpenThroughTimeData[] = [];
  let avgOpenBy: AvgOpenByData[] = [];
  let avgComments: AvgCommentsData | null = null;
  let summary: SummaryData | null = null;
  let topThemes: Array<{ text: string; value: number }> = [];
  let commentsByAuthor: CommentsByAuthorData[] = [];
  let firstCommentTime: FirstCommentTimeData[] = [];
  let outliers: MetricOutlierRow[] = [];
  let evaluation: EvaluationData | null = null;
  let detailViewError: string | null = null;

  try {
    const apiParams = buildPullRequestApiParams(filters);
    const [author, review, open, openBy, comments, summaryData, commentsByAuthorData, firstCommentTimeData, evalData] = await Promise.all([
      pullRequestAPI.byAuthor(apiParams),
      pullRequestAPI.averageReviewTime(apiParams),
      pullRequestAPI.openThroughTime(apiParams),
      pullRequestAPI.averageOpenBy(apiParams),
      pullRequestAPI.averageComments(apiParams),
      pullRequestAPI.summary(apiParams),
      pullRequestAPI.commentsByAuthor(apiParams),
      pullRequestAPI.firstCommentTime(apiParams),
      pullRequestAPI.evaluate(apiParams),
    ]);

    evaluation = evalData;

    byAuthor = ensureArray<ByAuthorData>(unwrapResult(author as ByAuthorData[] | ResultWrapper<ByAuthorData[]>));
    avgReviewTime = ensureArray<AvgReviewTimeData>(unwrapResult(review as AvgReviewTimeData[] | ResultWrapper<AvgReviewTimeData[]>));
    const openData = ensureArray<OpenThroughTimeResponseItem>(
      unwrapResult(open as OpenThroughTimeResponseItem[] | ResultWrapper<OpenThroughTimeResponseItem[]>)
    );
    if (openData.length > 0) {
      openThroughTime = openData.reduce((acc: OpenThroughTimeData[], item: OpenThroughTimeResponseItem) => {
        const existing = acc.find((d: OpenThroughTimeData) => d.date === item.date);
        if (existing) {
          if (item.kind === 'Opened') {
            existing.opened = item.count || 0;
          } else if (item.kind === 'Closed') {
            existing.closed = item.count || 0;
          }
        } else {
          acc.push({
            date: item.date,
            opened: item.kind === 'Opened' ? (item.count || 0) : 0,
            closed: item.kind === 'Closed' ? (item.count || 0) : 0,
          });
        }
        return acc;
      }, []);
    } else {
      openThroughTime = openData.map((item): OpenThroughTimeData => ({
        date: item.date,
        opened: item.open_prs || 0,
        closed: 0,
      }));
    }
    avgOpenBy = ensureArray<AvgOpenByData>(unwrapResult(openBy as AvgOpenByData[] | ResultWrapper<AvgOpenByData[]>));
    avgComments = unwrapResult(comments as AvgCommentsData | ResultWrapper<AvgCommentsData>);
    const summaryResult = unwrapResult(summaryData as SummaryData | ResultWrapper<SummaryData>);
    summary = summaryResult;
    topThemes = Array.isArray(summaryResult?.top_themes)
      ? summaryResult.top_themes
      : [];
    commentsByAuthor = ensureArray<CommentsByAuthorData>(
      unwrapResult(commentsByAuthorData as CommentsByAuthorData[] | ResultWrapper<CommentsByAuthorData[]>)
    );
    firstCommentTime = ensureArray<FirstCommentTimeData>(
      unwrapResult(firstCommentTimeData as FirstCommentTimeData[] | ResultWrapper<FirstCommentTimeData[]>)
    );
    outliers = [
      ...avgReviewTime.flatMap((item) =>
        toOutlierRows(`Average review time: ${item.author}`, item.outliers)
      ),
      ...avgOpenBy.flatMap((item) =>
        toOutlierRows(`Average open days: ${item.period}`, item.outliers)
      ),
      ...toOutlierRows('Average comments per PR', avgComments?.outliers),
      ...firstCommentTime.flatMap((item) =>
        toOutlierRows(`Time to first comment: ${item.author}`, item.outliers)
      ),
    ];
  } catch (error) {
    console.error('Error fetching PR data:', error);
    detailViewError = 'Failed to load PR detail data.';
  }

  return (
    <div className="space-y-6">
      {evaluation ? (
        <PREvaluationCard data={evaluation} method={filters.method} />
      ) : null}

      <OutliersCard rows={outliers} />

      <div className="border-t border-gray-200 pt-2">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Detail View</h2>
      </div>

      {detailViewError ? (
        <div className="text-red-600 text-sm">{detailViewError}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6">
            <AverageReviewTimeCard data={avgReviewTime} method={filters.method} />
          </div>
          <div className="grid grid-cols-2 gap-6">
            <CommentsByAuthorCard data={commentsByAuthor} />
            <FirstCommentTimeCard data={firstCommentTime} method={filters.method} />
          </div>
          <div className="grid grid-cols-1 gap-6">
            <PRsByAuthorCard data={byAuthor} />
          </div>
          <div className="grid grid-cols-2 gap-6">
            <MostCommentedPRsCard data={summary?.most_commented_prs || []} />
            <TopThemesCard data={topThemes} />
          </div>
          <div className="grid grid-cols-1 gap-6">
            <OpenPRsThroughTimeCard data={openThroughTime} />
          </div>
          <div className="grid grid-cols-1 gap-6">
            <AverageDaysPRsRemainOpenCard data={avgOpenBy} method={filters.method} />
          </div>
          <div className="grid grid-cols-1 gap-6">
            <PRStatisticsCard summary={summary} avgComments={avgComments} method={filters.method} />
          </div>
        </>
      )}
    </div>
  );
}
