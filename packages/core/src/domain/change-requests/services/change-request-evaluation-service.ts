import type {
  ChangeRequestDashboardData,
  ChangeRequestEvaluation,
  ChangeRequestBottleneckSignal,
  ChangeRequestBottleneckSeverity,
} from '../change-request-evaluation-types';

export class ChangeRequestEvaluationService {
  evaluate(data: ChangeRequestDashboardData): ChangeRequestEvaluation {
    const rawSignals: Array<ChangeRequestBottleneckSignal | null> = [
      ...this.evaluateReviewTime(data),
      ...this.evaluateReviewerWorkload(data),
      this.evaluateOpenTime(data),
      this.evaluateThroughput(data),
      this.evaluateFirstCommentTime(data),
      this.evaluateCommentHealth(data),
    ];

    return {
      generatedAt: new Date().toISOString(),
      signals: rawSignals.filter((s): s is ChangeRequestBottleneckSignal => s !== null),
      summary: this.buildSummary(data),
    };
  }

  private evaluateReviewTime(data: ChangeRequestDashboardData): ChangeRequestBottleneckSignal[] {
    const items = data.reviewTime || [];
    const signals: ChangeRequestBottleneckSignal[] = [];

    if (items.length === 0) {
      return [this.insufficientData('review_time', 'review')];
    }

    const sorted = [...items]
      .filter((item) => (item.value ?? 0) > 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    if (sorted.length === 0) {
      return [this.insufficientData('review_time', 'review')];
    }

    const topAuthor = sorted[0];
    const topDays = topAuthor.value ?? 0;
    const avgDays = sorted.reduce((sum, item) => sum + (item.value ?? 0), 0) / sorted.length;
    const ratio = avgDays > 0 ? topDays / avgDays : 1;

    const severity = this.severityFromThresholds(topDays, 3, 1);
    const template =
      topDays >= 2
        ? `Change requests by "${topAuthor.author}" take ${topDays.toFixed(1)} days to review on average — ${ratio.toFixed(1)}x the team average of ${avgDays.toFixed(1)} days. This creates a delivery bottleneck for their work.`
        : `The slowest-reviewed author ("${topAuthor.author}") averages ${topDays.toFixed(1)} days — review speed is healthy.`;

    signals.push({
      id: 'review_time',
      title: topDays >= 2 ? `Slow reviews for "${topAuthor.author}"` : 'Review speed is healthy',
      description: template,
      severity,
      category: 'review',
      metrics: [
        { label: 'Slowest author', value: topAuthor.author },
        { label: 'Avg review time', value: `${topDays.toFixed(1)} days` },
        { label: 'Team average', value: `${avgDays.toFixed(1)} days` },
      ],
    });

    if (sorted.length > 1) {
      const second = sorted[1];
      const secondDays = second.value ?? 0;
      if (secondDays >= 1) {
        signals.push({
          id: 'review_time_second',
          title: `"${second.author}" also has elevated review time`,
          description: `"${second.author}" averages ${secondDays.toFixed(1)} days for reviews — the second-highest in the team.`,
          severity: this.severityFromThresholds(secondDays, 2, 1),
          category: 'review',
          metrics: [
            { label: 'Author', value: second.author },
            { label: 'Avg', value: `${secondDays.toFixed(1)} days` },
          ],
        });
      }
    }

    return signals;
  }

  private evaluateReviewerWorkload(
    data: ChangeRequestDashboardData
  ): ChangeRequestBottleneckSignal[] {
    const comments = data.commentsByAuthor || [];
    const signals: ChangeRequestBottleneckSignal[] = [];

    if (comments.length === 0) {
      return [this.insufficientData('reviewer_workload', 'collaboration')];
    }

    const sorted = [...comments].sort((a, b) => b.count - a.count);
    const topReviewer = sorted[0];
    const totalComments = sorted.reduce((sum, c) => sum + c.count, 0);
    const share = totalComments > 0 ? (topReviewer.count / totalComments) * 100 : 0;

    const severity = this.severityFromThresholds(share, 50, 30);

    signals.push({
      id: 'reviewer_workload',
      title:
        share >= 40
          ? `"${topReviewer.author}" carries most review load`
          : 'Review load is reasonably distributed',
      description:
        share >= 40
          ? `"${topReviewer.author}" wrote ${topReviewer.count} of ${totalComments} review comments (${share.toFixed(1)}%). This creates a review bottleneck and knowledge silo.`
          : `The top reviewer ("${topReviewer.author}") accounts for ${share.toFixed(1)}% of comments — review workload is balanced across ${comments.length} people.`,
      severity,
      category: 'collaboration',
      metrics: [
        { label: 'Top reviewer', value: topReviewer.author },
        { label: 'Comments', value: String(topReviewer.count) },
        { label: 'Share', value: `${share.toFixed(1)}%` },
        { label: 'Reviewers', value: String(comments.length) },
      ],
    });

    return signals;
  }

  private evaluateOpenTime(data: ChangeRequestDashboardData): ChangeRequestBottleneckSignal | null {
    const items = data.openTime || [];

    if (items.length === 0) {
      return this.insufficientData('open_time', 'review');
    }

    const recentItems = items.slice(-4);
    const recentAvg = recentItems.reduce((sum, item) => sum + item.value, 0) / recentItems.length;

    const olderItems = items.slice(0, Math.max(0, items.length - 4));
    const olderAvg =
      olderItems.length > 0
        ? olderItems.reduce((sum, item) => sum + item.value, 0) / olderItems.length
        : recentAvg;

    const trendRatio = olderAvg > 0 ? recentAvg / olderAvg : 1;
    const severity = this.severityFromThresholds(recentAvg, 7, 3);

    const title =
      trendRatio >= 1.3
        ? `Change request open time is rising`
        : recentAvg >= 5
          ? `Change requests are open too long`
          : 'Change request open time is healthy';

    const description =
      trendRatio >= 1.3
        ? `Recent change requests average ${recentAvg.toFixed(1)} days open — ${trendRatio.toFixed(1)}x the earlier baseline of ${olderAvg.toFixed(1)} days. The backlog may be growing.`
        : recentAvg >= 5
          ? `Change requests average ${recentAvg.toFixed(1)} days open. Long open times delay feedback and increase merge conflicts.`
          : `Change requests average ${recentAvg.toFixed(1)} days open — within healthy range.`;

    return {
      id: 'open_time',
      title,
      description,
      severity,
      category: 'review',
      metrics: [
        { label: 'Recent avg', value: `${recentAvg.toFixed(1)} days` },
        { label: 'Baseline avg', value: `${olderAvg.toFixed(1)} days` },
        {
          label: 'Trend',
          value: trendRatio >= 1.3 ? `↑ ${trendRatio.toFixed(1)}x` : `${trendRatio.toFixed(1)}x`,
        },
      ],
    };
  }

  private evaluateThroughput(
    data: ChangeRequestDashboardData
  ): ChangeRequestBottleneckSignal | null {
    const items = data.throughput || [];
    if (items.length === 0) {
      return this.insufficientData('throughput', 'throughput');
    }

    const totalOpened = items.reduce((sum, item) => sum + item.opened, 0);
    const totalClosed = items.reduce((sum, item) => sum + item.closed, 0);
    const ratio = totalClosed > 0 ? totalOpened / totalClosed : totalOpened > 0 ? Infinity : 1;

    const severity = ratio > 1.5 ? 'critical' : ratio > 1.1 ? 'warning' : 'good';

    return {
      id: 'throughput',
      title:
        ratio > 1.3
          ? 'More change requests opened than closed — backlog growing'
          : ratio < 0.7
            ? 'More change requests closed than opened — catching up'
            : 'Change request throughput is balanced',
      description:
        ratio > 1.3
          ? `${totalOpened} opened vs ${totalClosed} closed (${ratio.toFixed(1)}x). The change request backlog is growing — review capacity may be insufficient.`
          : ratio < 0.7
            ? `${totalOpened} opened vs ${totalClosed} closed (${ratio.toFixed(1)}x). The team is closing change requests faster than they open — backlog is shrinking.`
            : `${totalOpened} opened vs ${totalClosed} closed — the team is keeping up.`,
      severity,
      category: 'throughput',
      metrics: [
        { label: 'Opened', value: String(totalOpened) },
        { label: 'Closed', value: String(totalClosed) },
        { label: 'Ratio', value: ratio === Infinity ? 'inf' : `${ratio.toFixed(1)}x` },
      ],
    };
  }

  private evaluateFirstCommentTime(
    data: ChangeRequestDashboardData
  ): ChangeRequestBottleneckSignal | null {
    const items = data.firstCommentTime || [];
    if (items.length === 0) {
      return this.insufficientData('first_comment', 'review');
    }

    const sorted = [...items].sort((a, b) => b.value - a.value);
    const slowest = sorted[0];
    const avgHours = sorted.reduce((sum, item) => sum + item.value, 0) / sorted.length;

    const severity = this.severityFromThresholds(slowest.value, 24, 8);

    return {
      id: 'first_comment',
      title:
        slowest.value >= 12
          ? `Slow first response for change requests by "${slowest.author}"`
          : 'First response time is healthy',
      description:
        slowest.value >= 12
          ? `Change requests by "${slowest.author}" wait ${slowest.value.toFixed(1)} hours for the first review comment — ${(slowest.value / Math.max(avgHours, 0.1)).toFixed(1)}x the team average of ${avgHours.toFixed(1)}h.`
          : `The slowest first response is ${slowest.value.toFixed(1)}h (team avg ${avgHours.toFixed(1)}h) — engagement is prompt.`,
      severity,
      category: 'review',
      metrics: [
        { label: 'Slowest author', value: slowest.author },
        { label: 'Avg wait', value: `${slowest.value.toFixed(1)}h` },
        { label: 'Team avg', value: `${avgHours.toFixed(1)}h` },
        {
          label: 'Change requests with comments',
          value: String(slowest.change_requests_with_comments),
        },
      ],
    };
  }

  private evaluateCommentHealth(
    data: ChangeRequestDashboardData
  ): ChangeRequestBottleneckSignal | null {
    const summary = data.summary;
    if (!summary) {
      return this.insufficientData('comment_health', 'collaboration');
    }

    const avgComments = summary.avg_comments_per_change_request;
    const totalChangeRequests = summary.total_change_requests;

    const severity = avgComments === 0 ? 'critical' : avgComments < 1 ? 'warning' : 'good';

    return {
      id: 'comment_health',
      title:
        avgComments < 1
          ? avgComments === 0
            ? 'No review comments detected — risk of unreviewed code'
            : 'Very few review comments'
          : 'Comment activity is healthy',
      description:
        avgComments < 1
          ? `Averaging ${avgComments.toFixed(1)} comments per change request across ${totalChangeRequests} change requests. This may indicate insufficient code review depth.`
          : `Averaging ${avgComments.toFixed(1)} comments per change request across ${totalChangeRequests} change requests — healthy discussion level.`,
      severity,
      category: 'collaboration',
      metrics: [
        { label: 'Avg comments/change request', value: avgComments.toFixed(1) },
        { label: 'Total change requests', value: String(totalChangeRequests) },
      ],
    };
  }

  private buildSummary(data: ChangeRequestDashboardData): ChangeRequestEvaluation['summary'] {
    const summary = data.summary;
    const reviewItems = data.reviewTime || [];
    const openItems = data.openTime || [];
    const authorItems = data.byAuthor || [];
    const commenterItems = data.commentsByAuthor || [];

    const method = reviewItems[0]?.method ?? openItems[0]?.method ?? 'average';

    const avgReviewHours =
      reviewItems.length > 0
        ? reviewItems.reduce((sum, item) => sum + (item.value ?? 0) * 24, 0) / reviewItems.length
        : 0;

    const avgOpenDays =
      openItems.length > 0
        ? openItems.reduce((sum, item) => sum + item.value, 0) / openItems.length
        : 0;

    const sortedAuthors = [...authorItems].sort((a, b) => b.count - a.count);
    const sortedReviewers = [...commenterItems].sort((a, b) => b.count - a.count);

    return {
      totalChangeRequests: summary?.total_change_requests ?? 0,
      mergedChangeRequests: summary?.merged_change_requests ?? 0,
      openChangeRequests: summary?.open_change_requests ?? 0,
      avgCommentsPerChangeRequest: summary?.avg_comments_per_change_request ?? 0,
      reviewHours: Math.round(avgReviewHours * 10) / 10,
      openDays: Math.round(avgOpenDays * 10) / 10,
      method,
      uniqueAuthors: summary?.unique_authors ?? 0,
      topReviewer: sortedReviewers[0]?.author,
      bottleneckAuthor: sortedAuthors[0]?.author,
    };
  }

  private severityFromThresholds(
    value: number,
    criticalThreshold: number,
    warningThreshold: number
  ): ChangeRequestBottleneckSeverity {
    if (value >= criticalThreshold) return 'critical';
    if (value >= warningThreshold) return 'warning';
    return 'good';
  }

  private insufficientData(
    id: string,
    category: ChangeRequestBottleneckSignal['category']
  ): ChangeRequestBottleneckSignal {
    return {
      id,
      title: 'Not enough data',
      description: 'Merge more change requests to populate this analysis.',
      severity: 'good',
      category,
      metrics: [],
    };
  }
}
