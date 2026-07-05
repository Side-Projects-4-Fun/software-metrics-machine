import { BadRequestException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SonarqubeRepository } from '@smmachine/core';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SonarqubeController } from '../src/controllers/sonarqube.controller';
import { HttpExceptionFilter, AllExceptionsFilter } from '../src/filters/http-exception.filter';
import { createMetricsTestApp, MockedMetricsServices } from './helpers/metrics-test-app';

describe('Sonarqube', () => {
  let app: INestApplication;
  let services: MockedMetricsServices;

  beforeAll(async () => {
    const testApp = await createMetricsTestApp();
    app = testApp.app;
    services = testApp.services;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('should return quality metrics', async () => {
    await request(app.getHttpServer())
      .get('/api/metrics/quality')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('coverage');
        expect(res.body).toHaveProperty('complexity');
      });
  });

  it('should support quality metric selection', async () => {
    await request(app.getHttpServer())
      .get('/api/metrics/quality?measures=coverage&measures=complexity')
      .expect(200)
      .expect(() => {
        expect(services.sonarqubeService.getQualityMetrics).toHaveBeenCalledWith(
          expect.arrayContaining(['coverage', 'complexity'])
        );
      });
  });
});

describe('Sonarqube controller', () => {
  let app: INestApplication;
  const sonarqubeRepository = {
    loadAllComponentTreeEntries: vi.fn().mockResolvedValue([
      {
        fetchedAt: '2024-01-01T00:00:00.000Z',
        data: [],
      },
    ]),
    loadComponentTree: vi.fn().mockResolvedValue([]),
    loadAll: vi.fn().mockResolvedValue({ coverage: 90 }),
    loadMeasurements: vi.fn().mockResolvedValue([]),
    loadAllMeasurementEntries: vi.fn().mockResolvedValue([]),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [SonarqubeController],
      providers: [
        {
          provide: SonarqubeRepository,
          useValue: sonarqubeRepository,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
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
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    sonarqubeRepository.loadAllComponentTreeEntries.mockResolvedValue([
      {
        fetchedAt: '2024-01-01T00:00:00.000Z',
        data: [],
      },
    ]);
    sonarqubeRepository.loadComponentTree.mockResolvedValue([]);
    sonarqubeRepository.loadAll.mockResolvedValue({ coverage: 90 });
    sonarqubeRepository.loadMeasurements.mockResolvedValue([]);
    sonarqubeRepository.loadAllMeasurementEntries.mockResolvedValue([]);
  });

  it('should accept project when loading component tree history', async () => {
    await request(app.getHttpServer())
      .get('/sonarqube/component-tree/history?project=vercel%2Fnext.js&remove_folders=true')
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual([
          {
            fetchedAt: '2024-01-01T00:00:00.000Z',
            data: [],
          },
        ]);
        expect(sonarqubeRepository.loadAllComponentTreeEntries).toHaveBeenCalledWith({
          component: undefined,
          depth: undefined,
          metrics: undefined,
          ignore_files: undefined,
          include_files: undefined,
          remove_folders: true,
        });
      });
  });

  it('returns a 500 when loading component tree history fails', async () => {
    sonarqubeRepository.loadAllComponentTreeEntries.mockRejectedValueOnce(new Error('boom'));

    await request(app.getHttpServer())
      .get('/sonarqube/component-tree/history')
      .expect(500)
      .expect((res) => {
        expect(res.body.message).toBe('Failed to fetch SonarQube component tree history: boom');
      });
  });

  describe('GET /sonarqube/component-tree', () => {
    it('forwards query params to loadComponentTree', async () => {
      sonarqubeRepository.loadComponentTree.mockResolvedValueOnce([
        { key: 'my:project', name: 'project', type: 'TRK', measures: [] },
      ]);

      await request(app.getHttpServer())
        .get(
          '/sonarqube/component-tree?component=my%3Aproject&depth=2&metrics=complexity&ignore_files=*.test.ts&include_files=src%2F**&remove_folders=true'
        )
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual([
            { key: 'my:project', name: 'project', type: 'TRK', measures: [] },
          ]);
          expect(sonarqubeRepository.loadComponentTree).toHaveBeenCalledWith({
            component: 'my:project',
            depth: 2,
            metrics: ['complexity'],
            ignore_files: ['*.test.ts'],
            include_files: ['src/**'],
            remove_folders: true,
          });
        });
    });

    it('returns a 500 when loading the component tree fails', async () => {
      sonarqubeRepository.loadComponentTree.mockRejectedValueOnce(new Error('tree broke'));

      await request(app.getHttpServer())
        .get('/sonarqube/component-tree')
        .expect(500)
        .expect((res) => {
          expect(res.body.message).toBe('Failed to fetch component tree: tree broke');
        });
    });
  });

  describe('GET /sonarqube/quality', () => {
    it('forwards the measures query param to loadAll', async () => {
      sonarqubeRepository.loadAll.mockResolvedValueOnce({ coverage: 85, complexity: 10 });

      await request(app.getHttpServer())
        .get('/sonarqube/quality?measures=coverage&measures=complexity')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({ coverage: 85, complexity: 10 });
          expect(sonarqubeRepository.loadAll).toHaveBeenCalledWith({
            measures: ['coverage', 'complexity'],
          });
        });
    });

    it('returns a 500 when loading quality metrics fails', async () => {
      sonarqubeRepository.loadAll.mockRejectedValueOnce(new Error('quality broke'));

      await request(app.getHttpServer())
        .get('/sonarqube/quality')
        .expect(500)
        .expect((res) => {
          expect(res.body.message).toBe('Failed to fetch quality metrics: quality broke');
        });
    });
  });

  describe('GET /sonarqube/measurements', () => {
    it('returns measurements on success', async () => {
      sonarqubeRepository.loadMeasurements.mockResolvedValueOnce([
        { metric: 'coverage', value: '90' },
      ]);

      await request(app.getHttpServer())
        .get('/sonarqube/measurements')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual([{ metric: 'coverage', value: '90' }]);
        });
    });

    it('returns a 500 when loading measurements fails', async () => {
      sonarqubeRepository.loadMeasurements.mockRejectedValueOnce(new Error('measurements broke'));

      await request(app.getHttpServer())
        .get('/sonarqube/measurements')
        .expect(500)
        .expect((res) => {
          expect(res.body.message).toBe(
            'Failed to fetch SonarQube measurements: measurements broke'
          );
        });
    });
  });

  describe('GET /sonarqube/measurements/history', () => {
    it('returns measurement history on success', async () => {
      sonarqubeRepository.loadAllMeasurementEntries.mockResolvedValueOnce([
        { fetchedAt: '2024-01-01T00:00:00.000Z', data: [] },
      ]);

      await request(app.getHttpServer())
        .get('/sonarqube/measurements/history')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual([{ fetchedAt: '2024-01-01T00:00:00.000Z', data: [] }]);
        });
    });

    it('returns a 500 when loading measurement history fails', async () => {
      sonarqubeRepository.loadAllMeasurementEntries.mockRejectedValueOnce(
        new Error('history broke')
      );

      await request(app.getHttpServer())
        .get('/sonarqube/measurements/history')
        .expect(500)
        .expect((res) => {
          expect(res.body.message).toBe(
            'Failed to fetch SonarQube measurement history: history broke'
          );
        });
    });
  });
});
