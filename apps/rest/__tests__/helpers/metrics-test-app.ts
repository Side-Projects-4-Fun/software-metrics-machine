import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, BadRequestException } from '@nestjs/common';
import { MetricsController } from '../../src/metrics.controller';
import { HttpExceptionFilter, AllExceptionsFilter } from '../../src/filters/http-exception.filter';
import {
  IssuesRepository,
  PairingIndexService,
  PipelinesService,
  PRsService,
  SonarQubeService,
} from '@smmachine/core';
import { vi } from 'vitest';

export interface MockedMetricsServices {
  prsService: {
    getMetrics: ReturnType<typeof vi.fn>;
  };
  pipelinesService: {
    getMetrics: ReturnType<typeof vi.fn>;
    getDeploymentFrequencyWithAllIntervals: ReturnType<typeof vi.fn>;
    getJobMetrics: ReturnType<typeof vi.fn>;
  };
  codeMetricsRepository: {
    getCodeChurn: ReturnType<typeof vi.fn>;
    getFileCoupling: ReturnType<typeof vi.fn>;
  };
  issuesRepository: {
    getIssues: ReturnType<typeof vi.fn>;
  };
  sonarqubeService: {
    getQualityMetrics: ReturnType<typeof vi.fn>;
  };
  pairingService: {
    getPairingIndex: ReturnType<typeof vi.fn>;
  };
}

export async function createMetricsTestApp(): Promise<{
  app: INestApplication;
  services: MockedMetricsServices;
}> {
  const services: MockedMetricsServices = {
    prsService: {
      getMetrics: vi.fn().mockResolvedValue({
        totalPRs: 42,
        leadTime: { average: 2.5, unit: 'days' },
        commentSummary: { total: 156 },
        labelSummary: { bug: 5, feature: 12 },
        filters: {},
      }),
    },
    pipelinesService: {
      getMetrics: vi.fn().mockResolvedValue({ totalRuns: 100, successRate: 0.95 }),
      getDeploymentFrequencyWithAllIntervals: vi.fn().mockResolvedValue([
        { date: '2024-01-01', value: 3 },
        { date: '2024-01-02', value: 5 },
      ]),
      getJobMetrics: vi.fn().mockResolvedValue([{ jobName: 'build', avgDuration: 120 }]),
    },
    codeMetricsRepository: {
      getCodeChurn: vi.fn().mockResolvedValue({ data: { additions: 1520, deletions: 890 } }),
      getFileCoupling: vi.fn().mockResolvedValue([]),
    },
    issuesRepository: {
      getIssues: vi.fn().mockResolvedValue(
        Array.from({ length: 320 }, (_, index) => ({
          id: String(index + 1),
          key: `ISSUE-${index + 1}`,
          status: 'Done',
          createdAt: '2024-01-01T00:00:00Z',
        }))
      ),
    },
    sonarqubeService: {
      getQualityMetrics: vi.fn().mockResolvedValue({
        coverage: 78.5,
        complexity: 42,
        filters: {},
      }),
    },
    pairingService: {
      getPairingIndex: vi.fn().mockResolvedValue({
        pairingIndexPercentage: 45,
      }),
    },
  };

  const moduleFixture: TestingModule = await Test.createTestingModule({
    controllers: [MetricsController],
    providers: [
      {
        provide: PRsService,
        useValue: services.prsService,
      },
      {
        provide: PipelinesService,
        useValue: services.pipelinesService,
      },
      {
        provide: 'ICodeMetricsRepository',
        useValue: services.codeMetricsRepository,
      },
      {
        provide: IssuesRepository,
        useValue: services.issuesRepository,
      },
      {
        provide: SonarQubeService,
        useValue: services.sonarqubeService,
      },
      {
        provide: PairingIndexService,
        useValue: services.pairingService,
      },
    ],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        const message = errors
          .map((error) => {
            const constraints = Object.values(error.constraints || {});
            return `${error.property}: ${constraints.join(', ')}`;
          })
          .join('; ');
        return new BadRequestException(message);
      },
    })
  );
  app.useGlobalFilters(new HttpExceptionFilter(), new AllExceptionsFilter());
  await app.init();

  return {
    app,
    services,
  };
}
