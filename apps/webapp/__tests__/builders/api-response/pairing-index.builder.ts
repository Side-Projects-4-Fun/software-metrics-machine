export type PairingIndexResponse = Exclude<
  Awaited<ReturnType<typeof import('@/server/api/sourceCode').sourceCodeAPI.pairingIndex>>,
  null
>;

export class PairingIndexBuilder {
  private data: PairingIndexResponse = {
    pairing_index_percentage: 45,
    total_analyzed_commits: 100,
    paired_commits: 45,
    top_pairs: [{ author: 'alice', co_author: 'bob', paired_commits: 10 }],
    latest_paired_commits: [
      { hash: 'abc', author: 'alice', co_authors: ['bob'], timestamp: '2026-01-01', subject: 'feat: stuff' },
    ],
  };

  build(): PairingIndexResponse {
    return { ...this.data };
  }
}
