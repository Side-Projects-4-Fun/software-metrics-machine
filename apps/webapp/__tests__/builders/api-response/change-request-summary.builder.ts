export type ChangeRequestSummaryResponse = Awaited<
  ReturnType<typeof import('@/server/api/changeRequest').changeRequestAPI.summary>
>;

export class ChangeRequestSummaryBuilder {
  private data: ChangeRequestSummaryResponse = {
    total: 20,
    merged: 15,
    closed: 3,
    open: 2,
    first_change_request: null,
    last_change_request: null,
    top_themes: [{ text: 'fix', value: 10 }],
    labels: [{ label: 'bug', change_requests: 5 }],
  };

  withTotal(total: number): this { this.data.total = total; return this; }
  withMerged(merged: number): this { this.data.merged = merged; return this; }
  withOpen(open: number): this { this.data.open = open; return this; }
  withLabels(labels: Array<{ label: string; change_requests: number }>): this {
    this.data.labels = labels; return this;
  }
  withTopThemes(themes: Array<{ text: string; value: number }>): this {
    this.data.top_themes = themes; return this;
  }

  build(): ChangeRequestSummaryResponse {
    return { ...this.data, labels: [...this.data.labels], top_themes: [...this.data.top_themes] };
  }
}
