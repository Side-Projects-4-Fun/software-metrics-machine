import { execFileSync } from 'child_process';
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

      const commits = await this.fetchCommits(options);

      this.logger.info(`Fetched ${commits.length} commits`);

      const filtered = this.filterCommits(
        commits,
        options?.startDate,
        options?.endDate,
        options?.selectedAuthors,
        options?.excludedAuthors
      );

      this.logger.info(`After filtering: ${filtered.length} commits`);

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

  private async fetchCommits(options?: {
    selectedAuthors?: string[];
    excludedAuthors?: string[];
    maxBuffer?: number;
  }): Promise<Commit[]> {
    try {
      const gitArgs = [
        'log',
        '--format=%H%n%an%n%ae%n%cI%n%s%n%b%n---COMMIT-SEPARATOR---',
        '--reverse',
      ];

      const maxBufferBytes = (options?.maxBuffer ?? 100) * 1024 * 1024;

      this.logger.info(`Executing: git log --format=... --reverse`);
      const output = execFileSync('git', gitArgs, {
        cwd: this.gitRepositoryPath,
        timeout: 120000,
        maxBuffer: maxBufferBytes,
      });

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

  private parseCommitOutput(output: string): Commit[] {
    const commits: Commit[] = [];
    const commitBlocks = output.split('---COMMIT-SEPARATOR---');

    for (const block of commitBlocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;

      const lines = trimmed.split('\n');
      if (lines.length < 5) continue;

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

  private filterCommits(
    commits: Commit[],
    _startDate?: string,
    _endDate?: string,
    selectedAuthors?: string[],
    excludedAuthors?: string[]
  ): Commit[] {
    let filtered = commits;

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
