import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createMetricsTestApp, MockedMetricsServices } from './helpers/metrics-test-app';

describe('MetricsController - Pull Request Metrics', () => {
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

  it('should return pull request metrics', async () => {
    await request(app.getHttpServer())
      .get('/api/metrics/pr')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('totalPRs');
        expect(res.body).toHaveProperty('leadTime');
        expect(res.body.totalPRs).toBe(42);
        expect(res.body.leadTime.average).toBe(2.5);
      });
  });

  it('should support date filtering', async () => {
    await request(app.getHttpServer())
      .get('/api/metrics/pr?startDate=2024-01-01&endDate=2024-03-31')
      .expect(200)
      .expect(() => {
        expect(services.prsService.getMetrics).toHaveBeenCalledWith(
          expect.objectContaining({
            startDate: '2024-01-01',
            endDate: '2024-03-31',
          })
        );
      });
  });

  it('should handle invalid date format', async () => {
    await request(app.getHttpServer()).get('/api/metrics/pr?startDate=invalid-date').expect(500);
  });

  it('should handle missing required data gracefully', async () => {
    vi.spyOn(services.prsService, 'getMetrics').mockRejectedValueOnce(
      new Error('GitHub API unavailable')
    );

    await request(app.getHttpServer())
      .get('/api/metrics/pr')
      .expect(500)
      .expect((res) => {
        expect(res.body).toHaveProperty('error');
        expect(res.body).toHaveProperty('timestamp');
      });
  });

  it('should include filters in responses', async () => {
    await request(app.getHttpServer())
      .get('/api/metrics/pr?startDate=2024-01-01')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('filters');
      });
  });

  it('should return JSON content type', async () => {
    await request(app.getHttpServer())
      .get('/api/metrics/pr')
      .expect('Content-Type', /json/)
      .expect(200);
  });
});
