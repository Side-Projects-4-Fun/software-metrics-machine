import type {
  PRDashboardData,
  PREvaluation,
  PRBottleneckSignal,
  PRBottleneckSeverity,
} from '../pr-evaluation-types';

export class PREvaluationService {
  evaluate(data: PRDashboardData): PREvaluation {
    const rawSignals: Array<PRBottleneckSignal | null> = [
      ...this.evaluateReviewTime(data),
      ...this.evaluateReviewerWorkload(data),
      this.evaluateOpenTime(data),
      this.evaluateThroughput(data),
      this.evaluateFirstCommentTime(data),
      this.evaluateCommentHealth(data),
    ];

    return {
      generatedAt: new Date().toISOString(),
      signals: rawSignals.filter((s): s is PRBottleneckSignal => s !== null),
      summary: this.buildSummary(data),
    };
  }

  private evaluateReviewTime(data: PRDashboardData): PRBottleneckSignal[] {
    const items = data.reviewTime || [];
    const signals: PRBottleneckSignal[] = [];

    if (items.length === 0) {
      return [this.insufficientData('review_time', 'review')];
    }

    const sorted = [...items]
      .filter((item) => {
        const days = item.avg_days ?? (item.avg_hours ? item.avg_hours / 24 : 0);
        return days > 0;
      })
      .sort((a, b) => {
        const aDays = a.avg_days ?? (a.avg_hours ? a.avg_hours / 24 : 0);
        const bDays = b.avg_days ?? (b.avg_hours ? b.avg_hours / 24 : 0);
        return bDays - aDays;
      });

    if (sorted.length === 0) {
      return [this.insufficientData('review_time', 'review')];
    }

    const topAuthor = sorted[0];
    const topDays = topAuthor.avg_days ?? (topAuthor.avg_hours ? topAuthor.avg_hours / 24 : 0);
    const avgDays =
      sorted.reduce((sum, item) => {
        return sum + (item.avg_days ?? (item.avg_hours ? item.avg_hours / 24 : 0));
      }, 0) / sorted.length;
    const ratio = avgDays > 0 ? topDays / avgDays : 1;

    const severity = this.severityFromThresholds(topDays, 3, 1);
    const template =
      topDays >= 2
        ? `PRs by "${topAuthor.author}" take ${topDays.toFixed(1)} days to review on average — ${ratio.toFixed(1)}x the team average of ${avgDays.toFixed(1)} days. This creates a delivery bottleneck for their work.`
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
      const secondDays = second.avg_days ?? (second.avg_hours ? second.avg_hours / 24 : 0);
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

  private evaluateReviewerWorkload(data: PRDashboardData): PRBottleneckSignal[] {
    const comments = data.commentsByAuthor || [];
    const signals: PRBottleneckSignal[] = [];

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

  private evaluateOpenTime(data: PRDashboardData): PRBottleneckSignal | null {
    const items = data.openTime || [];

    if (items.length === 0) {
      return this.insufficientData('open_time', 'review');
    }

    const recentItems = items.slice(-4);
    const recentAvg =
      recentItems.reduce((sum, item) => sum + item.avg_days, 0) / recentItems.length;

    const olderItems = items.slice(0, Math.max(0, items.length - 4));
    const olderAvg =
      olderItems.length > 0
        ? olderItems.reduce((sum, item) => sum + item.avg_days, 0) / olderItems.length
        : recentAvg;

    const trendRatio = olderAvg > 0 ? recentAvg / olderAvg : 1;
    const severity = this.severityFromThresholds(recentAvg, 7, 3);

    const title =
      trendRatio >= 1.3
        ? `PR open time is rising`
        : recentAvg >= 5
          ? `PRs are open too long`
          : 'PR open time is healthy';

    const description =
      trendRatio >= 1.3
        ? `Recent PRs average ${recentAvg.toFixed(1)} days open — ${trendRatio.toFixed(1)}x the earlier baseline of ${olderAvg.toFixed(1)} days. The backlog may be growing.`
        : recentAvg >= 5
          ? `PRs average ${recentAvg.toFixed(1)} days open. Long open times delay feedback and increase merge conflicts.`
          : `PRs average ${recentAvg.toFixed(1)} days open — within healthy range.`;

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

  private evaluateThroughput(data: PRDashboardData): PRBottleneckSignal | null {
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
          ? 'More PRs opened than closed — backlog growing'
          : ratio < 0.7
            ? 'More PRs closed than opened — catching up'
            : 'PR throughput is balanced',
      description:
        ratio > 1.3
          ? `${totalOpened} opened vs ${totalClosed} closed (${ratio.toFixed(1)}x). The PR backlog is growing — review capacity may be insufficient.`
          : ratio < 0.7
            ? `${totalOpened} opened vs ${totalClosed} closed (${ratio.toFixed(1)}x). The team is closing PRs faster than they open — backlog is shrinking.`
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

  private evaluateFirstCommentTime(data: PRDashboardData): PRBottleneckSignal | null {
    const items = data.firstCommentTime || [];
    if (items.length === 0) {
      return this.insufficientData('first_comment', 'review');
    }

    const sorted = [...items].sort((a, b) => b.avg_hours - a.avg_hours);
    const slowest = sorted[0];
    const avgHours = sorted.reduce((sum, item) => sum + item.avg_hours, 0) / sorted.length;

    const severity = this.severityFromThresholds(slowest.avg_hours, 24, 8);

    return {
      id: 'first_comment',
      title:
        slowest.avg_hours >= 12
          ? `Slow first response for PRs by "${slowest.author}"`
          : 'First response time is healthy',
      description:
        slowest.avg_hours >= 12
          ? `PRs by "${slowest.author}" wait ${slowest.avg_hours.toFixed(1)} hours for the first review comment — ${(slowest.avg_hours / Math.max(avgHours, 0.1)).toFixed(1)}x the team average of ${avgHours.toFixed(1)}h.`
          : `The slowest first response is ${slowest.avg_hours.toFixed(1)}h (team avg ${avgHours.toFixed(1)}h) — engagement is prompt.`,
      severity,
      category: 'review',
      metrics: [
        { label: 'Slowest author', value: slowest.author },
        { label: 'Avg wait', value: `${slowest.avg_hours.toFixed(1)}h` },
        { label: 'Team avg', value: `${avgHours.toFixed(1)}h` },
        { label: 'PRs with comments', value: String(slowest.prs_with_comments) },
      ],
    };
  }

  private evaluateCommentHealth(data: PRDashboardData): PRBottleneckSignal | null {
    const summary = data.summary;
    if (!summary) {
      return this.insufficientData('comment_health', 'collaboration');
    }

    const avgComments = summary.avg_comments_per_pr;
    const totalPRs = summary.total_prs;

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
          ? `Averaging ${avgComments.toFixed(1)} comments per PR across ${totalPRs} PRs. This may indicate insufficient code review depth.`
          : `Averaging ${avgComments.toFixed(1)} comments per PR across ${totalPRs} PRs — healthy discussion level.`,
      severity,
      category: 'collaboration',
      metrics: [
        { label: 'Avg comments/PR', value: avgComments.toFixed(1) },
        { label: 'Total PRs', value: String(totalPRs) },
      ],
    };
  }

  private buildSummary(data: PRDashboardData): PREvaluation['summary'] {
    const summary = data.summary;
    const reviewItems = data.reviewTime || [];
    const openItems = data.openTime || [];
    const authorItems = data.byAuthor || [];
    const commenterItems = data.commentsByAuthor || [];

    const avgReviewHours =
      reviewItems.length > 0
        ? reviewItems.reduce((sum, item) => {
            return sum + (item.avg_hours ?? (item.avg_days ? item.avg_days * 24 : 0));
          }, 0) / reviewItems.length
        : 0;

    const avgOpenDays =
      openItems.length > 0
        ? openItems.reduce((sum, item) => sum + item.avg_days, 0) / openItems.length
        : 0;

    const sortedAuthors = [...authorItems].sort((a, b) => b.count - a.count);
    const sortedReviewers = [...commenterItems].sort((a, b) => b.count - a.count);

    return {
      totalPRs: summary?.total_prs ?? 0,
      mergedPRs: summary?.merged_prs ?? 0,
      openPRs: summary?.open_prs ?? 0,
      avgCommentsPerPR: summary?.avg_comments_per_pr ?? 0,
      avgReviewHours: Math.round(avgReviewHours * 10) / 10,
      avgOpenDays: Math.round(avgOpenDays * 10) / 10,
      uniqueAuthors: summary?.unique_authors ?? 0,
      topReviewer: sortedReviewers[0]?.author,
      bottleneckAuthor: sortedAuthors[0]?.author,
    };
  }

  private severityFromThresholds(
    value: number,
    criticalThreshold: number,
    warningThreshold: number
  ): PRBottleneckSeverity {
    if (value >= criticalThreshold) return 'critical';
    if (value >= warningThreshold) return 'warning';
    return 'good';
  }

  private insufficientData(
    id: string,
    category: PRBottleneckSignal['category']
  ): PRBottleneckSignal {
    return {
      id,
      title: 'Not enough data',
      description: 'Merge more pull requests to populate this analysis.',
      severity: 'good',
      category,
      metrics: [],
    };
  }
}
