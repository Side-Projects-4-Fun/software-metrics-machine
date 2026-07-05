import { Logger } from '@smmachine/utils';
import { IRepository, TimeZoneProvider } from '../../../infrastructure';
import {
  Commit,
  PairingIndexResult,
  PairedCommitSummary,
  PairingAuthorsStat,
} from '../../../domain-types';

export interface IPairingIndexService {
  getPairingIndex(options?: {
    selectedAuthors?: string[];
    startDate?: string;
    endDate?: string;
    includeAuthors?: string;
    excludeAuthors?: string;
  }): Promise<PairingIndexResult>;
}

/**
 * PairingIndex calculates the percentage of commits that have co-authors.
 * This metric helps identify pair programming practices.
 *
 * Formula: (paired_commits / total_analyzed_commits) * 100
 */
export class PairingService implements IPairingIndexService {
  private tz: TimeZoneProvider;

  constructor(
    private commitsJsonRepository: IRepository<Commit>,
    timeZoneProvider: TimeZoneProvider,
    private logger: Logger
  ) {
    this.tz = timeZoneProvider;
  }

  async getPairingIndex(options?: {
    selectedAuthors?: string[];
    startDate?: string;
    endDate?: string;
    includeAuthors?: string;
    excludeAuthors?: string;
  }): Promise<PairingIndexResult> {
    let selectedAuthors = options?.selectedAuthors || [];
    const startDate = options?.startDate;
    const endDate = options?.endDate;
    const includeAuthorsStr = options?.includeAuthors;
    const excludeAuthorsStr = options?.excludeAuthors;

    // Parse additional authors from string
    if (includeAuthorsStr) {
      const parsed = includeAuthorsStr
        .split(',')
        .map((a) => a.trim())
        .filter((a) => a.length > 0);
      selectedAuthors = [...selectedAuthors, ...parsed];
    }

    // Parse excluded authors
    let excludedList: Set<string> = new Set();
    if (excludeAuthorsStr) {
      excludedList = new Set(
        excludeAuthorsStr
          .split(',')
          .map((a) => a.trim().toLowerCase())
          .filter((a) => a.length > 0)
      );
    }

    if (selectedAuthors.length > 0) {
      this.logger.info(`Filtering commits to authors: ${selectedAuthors.join(', ')}`);
    }

    // Load all commits
    const allCommits = await this.commitsJsonRepository.loadAll();

    // Filter by date range
    let filteredCommits = allCommits;
    if (startDate || endDate) {
      filteredCommits = this.filterByDateRange(allCommits, startDate, endDate);
    }

    // Filter by authors
    if (selectedAuthors.length > 0 || excludedList.size > 0) {
      filteredCommits = this.filterByAuthors(filteredCommits, selectedAuthors, excludedList);
    }

    // Count paired commits (those with co-authors)
    const totalCommits = filteredCommits.length;
    const pairedCommits = filteredCommits.filter(
      (commit) =>
        (Array.isArray(commit.coAuthors) && commit.coAuthors.length > 0) ||
        (Array.isArray(commit.files) && commit.files.length > 0)
    ).length;

    this.logger.info(`Total commits analyzed: ${totalCommits}`);
    this.logger.info(`Total commits with co-authors: ${pairedCommits}`);

    if (totalCommits === 0) {
      return {
        pairingIndexPercentage: 0.0,
        totalAnalyzedCommits: 0,
        pairedCommits: 0,
      };
    }

    const index = (pairedCommits / totalCommits) * 100;
    const pairingIndex = Math.round(index * 100) / 100; // Round to 2 decimal places
    const topPairings = this.calculateTopPairings(filteredCommits);
    const latestPairedCommits = this.getLatestPairedCommits(filteredCommits);

    return {
      pairingIndexPercentage: pairingIndex,
      totalAnalyzedCommits: totalCommits,
      pairedCommits,
      topPairings,
      latestPairedCommits,
    };
  }

  private calculateTopPairings(commits: Commit[]): PairingAuthorsStat[] {
    const pairs = new Map<string, PairingAuthorsStat>();

    for (const commit of commits) {
      if (!Array.isArray(commit.coAuthors) || commit.coAuthors.length === 0) {
        continue;
      }

      const primaryAuthor = commit.author.trim();
      if (!primaryAuthor) {
        continue;
      }

      for (const coAuthorRaw of commit.coAuthors) {
        const coAuthor = coAuthorRaw.trim();
        if (!coAuthor) {
          continue;
        }

        const normalizedPair = [primaryAuthor, coAuthor].sort((a, b) =>
          a.localeCompare(b, undefined, { sensitivity: 'base' })
        );

        if (normalizedPair[0].toLowerCase() === normalizedPair[1].toLowerCase()) {
          continue;
        }

        const key = `${normalizedPair[0].toLowerCase()}::${normalizedPair[1].toLowerCase()}`;
        const existing = pairs.get(key);

        if (existing) {
          existing.pairedCommits += 1;
        } else {
          pairs.set(key, {
            author: normalizedPair[0],
            coAuthor: normalizedPair[1],
            pairedCommits: 1,
          });
        }
      }
    }

    return Array.from(pairs.values()).sort((a, b) => {
      if (b.pairedCommits !== a.pairedCommits) {
        return b.pairedCommits - a.pairedCommits;
      }

      if (a.author !== b.author) {
        return a.author.localeCompare(b.author);
      }

      return a.coAuthor.localeCompare(b.coAuthor);
    });
  }

  private getLatestPairedCommits(commits: Commit[]): PairedCommitSummary[] {
    const pairedCommits = commits
      .filter((commit) => Array.isArray(commit.coAuthors) && commit.coAuthors.length > 0)
      .sort((a, b) => {
        const aTimestamp = new Date(a.timestamp).getTime();
        const bTimestamp = new Date(b.timestamp).getTime();
        return bTimestamp - aTimestamp;
      })
      .slice(0, 20);

    return pairedCommits.map((commit) => {
      const timestamp =
        commit.timestamp instanceof Date
          ? commit.timestamp.toISOString()
          : String(commit.timestamp);

      return {
        hash: commit.hash,
        author: commit.author,
        coAuthors: commit.coAuthors || [],
        timestamp,
        subject: commit.subject || commit.msg || '',
      };
    });
  }

  private filterByDateRange(commits: Commit[], startDate?: string, endDate?: string): Commit[] {
    if (!startDate && !endDate) {
      return commits;
    }

    const start = startDate ? this.tz.getStartOfDayBoundary(startDate) : null;
    const end = endDate ? this.tz.getEndOfDayBoundary(endDate) : null;

    return commits.filter((commit) => {
      const commitDate = new Date(commit.timestamp);
      if (start && commitDate < start) return false;
      if (end && commitDate > end) return false;
      return true;
    });
  }

  private filterByAuthors(
    commits: Commit[],
    selectedAuthors: string[],
    excludedList: Set<string>
  ): Commit[] {
    return commits.filter((commit) => {
      const authorLower = commit.author.toLowerCase();

      if (excludedList.has(authorLower)) {
        return false;
      }

      if (selectedAuthors.length === 0) {
        return true;
      }

      return selectedAuthors.some((author) => author.toLowerCase() === authorLower);
    });
  }
}
