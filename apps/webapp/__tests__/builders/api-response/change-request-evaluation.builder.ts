export type ChangeRequestEvaluationResponse = Awaited<
  ReturnType<typeof import('@/server/api/changeRequest').changeRequestAPI.evaluate>
>;

export class ChangeRequestEvaluationBuilder {
  private data: ChangeRequestEvaluationResponse = {
    generatedAt: '2026-01-01T00:00:00Z',
    signals: [],
    summary: {
      totalChangeRequests: 20,
      mergedChangeRequests: 15,
      openChangeRequests: 2,
      commentsPerChangeRequest: 3.5,
      reviewHours: 3.3,
      reviewHours_formatted: '3.3 h',
      openDays: 2.3,
      openDays_formatted: '2.3 days',
      method: 'average',
      uniqueAuthors: 2,
    },
  };

  withCommentsPerChangeRequest(value: number): this {
    this.data.summary.commentsPerChangeRequest = value; return this;
  }

  withSignals(signals: ChangeRequestEvaluationResponse['signals']): this {
    this.data.signals = signals;
    return this;
  }

  build(): ChangeRequestEvaluationResponse {
    return { ...this.data, signals: [...this.data.signals], summary: { ...this.data.summary } };
  }
}
