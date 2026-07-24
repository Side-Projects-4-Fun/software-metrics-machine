import { execSync } from 'child_process';
import type { Commit, TraverserResult } from '../../domain-types';
import type { Logger } from '@smmachine/utils';

export interface ICommitTraverser {
  traverseCommits(options?: {
    selectedAuthors?: string[];
    excludedAuthors?: string[];
    startDate?: string;
    endDate?: string;
    maxBuffer?: number;
  }): Promise<TraverserResult>;
}

/**
 * Real Git commit analysis based on local repository
 * Uses: child_process + git CLI to analyze commits
 * Features:
 *   - Parses commit history from local repository
 *   - Detects co-authors from "Co-authored-by:" trailers
 *   - Extracts commit metadata (hash, author, date, subject)
 *   - Filters by author and date range
 *   - Calculates pairing statistics
 */
export class CommitTraverser implements ICommitTraverser {
  private logger: Logger;

  constructor(
    private gitRepositoryPath: string,
    logger: Logger
  ) {
    this.logger = logger;
  }

  async traverseCommits(options?: {
    selectedAuthors?: string[];
    excludedAuthors?: string[];
    startDate?: string;
    endDate?: string;
    maxBuffer?: number;
  }): Promise<TraverserResult> {
    try {
      this.logger.info(`Traversing commits in ${this.gitRepositoryPath}`);

      // Fetch all commits from git log
      const commits = await this.fetchCommits(options);

      this.logger.info(`Fetched ${commits.length} commits`);

      // Filter commits based on options
      const filtered = this.filterCommits(
        commits,
        options?.startDate,
        options?.endDate,
        options?.selectedAuthors,
        options?.excludedAuthors
      );

      this.logger.info(`After filtering: ${filtered.length} commits`);

      // Calculate pairing statistics
      const pairedCommits = filtered.filter((c) => (c.coAuthors || []).length > 0).length;

      this.logger.info(`Paired commits: ${pairedCommits}`);

      return {
        totalAnalyzedCommits: filtered.length,
        pairedCommits,
        commits: filtered,
      };
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`Error traversing commits: ${error.message}`);
        throw new Error(`Failed to traverse commits: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Fetch all commits using git log command
   * Format string breaks down as:
   *   %H = commit hash
   *   %an = author name
   *   %ae = author email
   *   %cI = committer date (ISO 8601)
   *   %s = subject
   *   %b = body (contains Co-authored-by trailers)
   *   %n = newline
   * Separator: --COMMIT-SEPARATOR-- between commits
   *
   * Date filtering is NOT applied here because git's --since/--until flags
   * use the system timezone, which may differ from the configured timezone.
   * All date filtering happens in the caller (PairingService) using
   * TimeZoneProvider for correct timezone-aware boundaries.
   */
  private async fetchCommits(options?: {
    selectedAuthors?: string[];
    excludedAuthors?: string[];
    maxBuffer?: number;
  }): Promise<Commit[]> {
    try {
      // Build git log command — no date flags, filtering is done by the caller
      const gitCommand =
        'git log --format=%H%n%an%n%ae%n%cI%n%s%n%b%n---COMMIT-SEPARATOR--- --reverse';

      const maxBufferBytes = (options?.maxBuffer ?? 100) * 1024 * 1024;

      // Execute git command
      this.logger.info(`Executing: ${gitCommand}`);
      const output = execSync(gitCommand, {
        cwd: this.gitRepositoryPath,
        timeout: 120000, // 120 seconds timeout
        maxBuffer: maxBufferBytes,
      });

      // Parse output into commits
      const commits = this.parseCommitOutput(output.toString());

      return commits;
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`Git command failed: ${error.message}`);
        throw error;
      }
      throw error;
    }
  }

  /**
   * Parse git log output into Commit objects
   */
  private parseCommitOutput(output: string): Commit[] {
    const commits: Commit[] = [];
    const commitBlocks = output.split('---COMMIT-SEPARATOR---');

    for (const block of commitBlocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;

      const lines = trimmed.split('\n');
      if (lines.length < 5) continue; // Need at least: hash, author, email, date, subject

      const hash = lines[0];
      const author = lines[1];
      const email = lines[2];
      const timestamp = lines[3];
      const subject = lines[4];
      const body = lines.slice(5).join('\n');
      const coAuthors = this.extractCoAuthors(body);

      const commit: Commit = {
        hash,
        author,
        email,
        subject,
        msg: subject,
        timestamp,
        coAuthors,
      };

      commits.push(commit);
    }

    return commits;
  }

  /**
   * Detect co-authors from "Co-authored-by:" trailers in commit message
   * Format: Co-authored-by: Name <email@example.com>
   */
  private extractCoAuthors(message: string): string[] {
    const coAuthors: string[] = [];
    const coAuthorRegex = /Co-authored-by:\s*(.+?)\s*<(.+?)>/gi;
    let match;

    while ((match = coAuthorRegex.exec(message)) !== null) {
      const author = match[1].trim();
      if (author && !coAuthors.includes(author)) {
        coAuthors.push(author);
      }
    }

    return coAuthors;
  }

  /**
   * Apply author filters to commits.
   * Date filtering is NOT done here — it is handled by PairingService
   * using TimeZoneProvider for correct timezone-aware boundaries.
   */
  private filterCommits(
    commits: Commit[],
    _startDate?: string,
    _endDate?: string,
    selectedAuthors?: string[],
    excludedAuthors?: string[]
  ): Commit[] {
    let filtered = commits;

    // Apply author filters
    if (selectedAuthors && selectedAuthors.length > 0) {
      const authorSet = new Set(selectedAuthors.map((a) => a.toLowerCase()));
      filtered = filtered.filter((commit) => authorSet.has(commit.author.toLowerCase()));
    }

    if (excludedAuthors && excludedAuthors.length > 0) {
      const excludedSet = new Set(excludedAuthors.map((a) => a.toLowerCase()));
      filtered = filtered.filter((commit) => !excludedSet.has(commit.author.toLowerCase()));
    }

    return filtered;
  }
}
