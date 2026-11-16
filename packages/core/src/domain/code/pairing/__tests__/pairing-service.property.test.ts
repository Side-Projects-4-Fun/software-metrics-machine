import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { PairingService } from '../pairing-service';
import type { Commit } from '../../../../domain-types';
import { CommitBuilder } from '../../../../test/domain/domain-builders';
import { RepositoryBuilder } from '../../../../test/repositories/repository-builders';
import { MockLoggerBuilder } from '../../../../test/infrastructure/mock-logger-builder';
import { TimeZoneProvider } from '../../../../infrastructure';

/**
 * Property-based tests for PairingService.
 *
 * The metric catalog defines pairing as the share of commits with co-authors:
 *   pairing_index = |{commit: co_authors ≠ ∅}| ÷ |commits| × 100
 * These tests encode that contract as an independent oracle and check the
 * running service against it. A commit that touched files but has no
 * co-author must NOT count as paired.
 */

interface CommitModel {
  hasCoAuthors: boolean;
  hasFiles: boolean;
}

const logger = new MockLoggerBuilder().build();

const commitModelArbitrary = fc.array(
  fc.record({
    hasCoAuthors: fc.boolean(),
    hasFiles: fc.boolean(),
  }),
  { minLength: 1, maxLength: 30 }
);

function toCommit(model: CommitModel, index: number): Commit {
  const builder = new CommitBuilder().withAuthor(`author-${index}`).withHash(`commit-${index}`);
  if (model.hasCoAuthors) {
    builder.withCoAuthors([`coauthor-${index}`]);
  }
  if (model.hasFiles) {
    builder.withFiles([
      { path: `src/file-${index}.ts`, additions: 1, deletions: 0, status: 'modified' },
    ]);
  }
  return builder.build();
}

function buildService(models: CommitModel[]): PairingService {
  const repo = new RepositoryBuilder<Commit>().withLoadAll(models.map(toCommit)).build();
  return new PairingService(repo, new TimeZoneProvider('UTC'), logger);
}

function expectedPairedCount(models: CommitModel[]): number {
  return models.filter((model) => model.hasCoAuthors).length;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

describe('PairingService — semantic oracles', () => {
  it('reports the total number of analyzed commits', async () => {
    await fc.assert(
      fc.asyncProperty(commitModelArbitrary, async (models) => {
        const result = await buildService(models).getPairingIndex();
        expect(result.totalAnalyzedCommits).toBe(models.length);
      })
    );
  });

  it('counts only commits with co-authors as paired', async () => {
    await fc.assert(
      fc.asyncProperty(commitModelArbitrary, async (models) => {
        const result = await buildService(models).getPairingIndex();
        expect(result.pairedCommits).toBe(expectedPairedCount(models));
      })
    );
  });

  it('computes the pairing index as paired over total, bounded by 100', async () => {
    await fc.assert(
      fc.asyncProperty(commitModelArbitrary, async (models) => {
        const result = await buildService(models).getPairingIndex();

        expect(result.pairedCommits).toBeLessThanOrEqual(result.totalAnalyzedCommits);
        expect(result.pairingIndexPercentage).toBeCloseTo(
          round2((result.pairedCommits / result.totalAnalyzedCommits) * 100),
          5
        );
        expect(result.pairingIndexPercentage).toBeGreaterThanOrEqual(0);
        expect(result.pairingIndexPercentage).toBeLessThanOrEqual(100);
      })
    );
  });

  it('returns zero for an empty commit set', async () => {
    const empty: CommitModel[] = [];
    const result = await buildService(empty).getPairingIndex();

    expect(result.totalAnalyzedCommits).toBe(0);
    expect(result.pairedCommits).toBe(0);
    expect(result.pairingIndexPercentage).toBe(0);
  });
});
