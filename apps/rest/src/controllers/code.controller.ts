import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { BigOService, ICodeMetricsRepository } from '@smmachine/core';
import { PairingService } from '@smmachine/core/domain/code/pairing/pairing-service';
import type {
  BigOFileAnalysis,
  BigOFileSummary,
  CodePairingIndexResponse,
  CodeChurnResponse,
  CodeCouplingResponse,
  CodeEntityChurnResponse,
  CodeEntityEffortResponse,
  CodeEntityOwnershipResponse,
  CodeAuthorsResponse,
} from '../dtos';

/**
 * Code Metrics REST Controller
 * Provides endpoints for code quality and analysis metrics
 */
@ApiTags('Code Metrics')
@Controller()
export class CodeController {
  constructor(
    private readonly pairingService: PairingService,
    @Inject('ICodeMetricsRepository')
    private readonly codemaat: ICodeMetricsRepository,
    private readonly bigOService: BigOService
  ) {}

  @Get('/code/pairing-index')
  @ApiQuery({
    name: 'start_date',
    required: false,
    type: String,
    description: 'Start date filter (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'end_date',
    required: false,
    type: String,
    description: 'End date filter (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'authors',
    required: false,
    type: String,
    description: 'Comma-separated list of authors to filter by',
  })
  async pairingIndex(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('authors') authors?: string
  ): Promise<CodePairingIndexResponse> {
    const pairing = await this.pairingService.getPairingIndex({
      startDate,
      endDate,
      includeAuthors: authors,
    });

    return {
      pairing_index_percentage: pairing?.pairingIndexPercentage ?? 0,
      total_analyzed_commits: pairing?.totalAnalyzedCommits ?? 0,
      paired_commits: pairing?.pairedCommits ?? 0,
      top_pairs: (pairing?.topPairings || []).map((pair) => ({
        author: pair.author,
        co_author: pair.coAuthor,
        paired_commits: pair.pairedCommits,
      })),
      latest_paired_commits: (pairing?.latestPairedCommits || []).map((commit) => ({
        hash: commit.hash,
        author: commit.author,
        co_authors: commit.coAuthors,
        timestamp: commit.timestamp,
        subject: commit.subject,
      })),
    };
  }

  @Get('/code/code-churn')
  async codeChurn(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('type_churn') typeChurn?: string
  ): Promise<CodeChurnResponse> {
    const churn = await this.codemaat.getCodeChurn({
      startDate,
      endDate,
      typeChurn,
    });

    return churn.data as unknown as CodeChurnResponse;
  }

  @Get('/code/coupling')
  async coupling(
    @Query('ignore_files') ignoreFiles?: string,
    @Query('include_only') includeOnly?: string,
    @Query('top') top?: string
  ): Promise<CodeCouplingResponse> {
    const coupling = await this.codemaat.getFileCoupling({
      ignorePatterns: ignoreFiles,
      includePatterns: includeOnly,
      top,
      sortBy: 'degree',
    });

    return coupling;
  }

  @Get('/code/entity-churn')
  async entityChurn(
    @Query('ignore_files') ignoreFiles?: string,
    @Query('include_only') includeOnly?: string,
    @Query('top') top?: string
  ): Promise<CodeEntityChurnResponse> {
    const filtered = await this.codemaat.getEntityChurn({
      ignorePatterns: ignoreFiles,
      includePatterns: includeOnly,
      top,
    });

    return filtered;
  }

  @Get('/code/entity-effort')
  async entityEffort(
    @Query('ignore_files') ignoreFiles?: string,
    @Query('include_only') includeOnly?: string,
    @Query('top') top?: string
  ): Promise<CodeEntityEffortResponse> {
    const filtered = await this.codemaat.getEntityEffort({
      ignorePatterns: ignoreFiles,
      includePatterns: includeOnly,
      top,
    });

    return filtered;
  }

  @Get('/code/entity-ownership')
  async entityOwnership(
    @Query('ignore_files') ignoreFiles?: string,
    @Query('include_only') includeOnly?: string,
    @Query('authors') authors?: string,
    @Query('top') top?: string
  ): Promise<CodeEntityOwnershipResponse> {
    const filtered = await this.codemaat.getEntityOwnership({
      ignorePatterns: ignoreFiles,
      includePatterns: includeOnly,
      authors,
      top,
    });

    return filtered;
  }

  @Get('/code/authors')
  async codeAuthors(): Promise<CodeAuthorsResponse> {
    return this.codemaat.getEntityOwnership({ select: 'authors' });
  }

  @Get('/code/big-o')
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Repository-relative file path search filter',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of files to analyze',
  })
  @ApiQuery({
    name: 'ignore_files',
    required: false,
    type: String,
    description: 'Comma-separated repository-relative patterns to ignore',
  })
  @ApiQuery({
    name: 'include_only',
    required: false,
    type: String,
    description: 'Comma-separated repository-relative patterns to include',
  })
  async bigOFiles(
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('ignore_files') ignoreFiles?: string,
    @Query('include_only') includeOnly?: string
  ): Promise<BigOFileSummary[]> {
    return this.bigOService.listFiles({
      search,
      ignorePatterns: ignoreFiles,
      includePatterns: includeOnly,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('/code/big-o/file')
  @ApiQuery({
    name: 'file_path',
    required: true,
    type: String,
    description: 'Repository-relative file path',
  })
  async bigOFile(@Query('file_path') filePath: string): Promise<BigOFileAnalysis> {
    return this.bigOService.analyzeFile(filePath);
  }
}
