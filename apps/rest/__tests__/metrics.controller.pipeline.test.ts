import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createMetricsTestApp, MockedMetricsServices } from './helpers/metrics-test-app';

describe('MetricsController - Pipeline Metrics', () => {
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

  it('should return deployment metrics', async () => {
    await request(app.getHttpServer())
      .get('/api/metrics/deployment')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('pipelineMetrics');
        expect(res.body).toHaveProperty('deploymentFrequency');
        expect(res.body).toHaveProperty('jobMetrics');
      });
  });

  it('should support frequency parameter', async () => {
    await request(app.getHttpServer())
      .get('/api/metrics/deployment?frequency=day')
      .expect(200)
      .expect(() => {
        expect(services.pipelinesService.getMetrics).toHaveBeenCalledWith(
          expect.objectContaining({
            frequency: 'day',
          })
        );
      });
  });

  it('should validate frequency parameter gracefully', async () => {
    await request(app.getHttpServer()).get('/api/metrics/deployment?frequency=invalid').expect(500);
  });

  it('should handle missing pipeline data', async () => {
    vi.spyOn(services.pipelinesService, 'getMetrics').mockRejectedValueOnce(
      new Error('No workflow data available')
    );

    await request(app.getHttpServer()).get('/api/metrics/deployment').expect(500);
  });
});
