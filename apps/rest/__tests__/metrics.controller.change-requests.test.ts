import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { MockedMetricsServices } from './helpers/metrics-test-app';
import { createMetricsTestApp } from './helpers/metrics-test-app';

describe('MetricsController - Change Request Metrics', () => {
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

  it('should return change request metrics', async () => {
    await request(app.getHttpServer())
      .get('/api/metrics/change-requests')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('totalChangeRequests');
        expect(res.body).toHaveProperty('leadTime');
        expect(res.body).toHaveProperty('leadTime_formatted');
        expect(res.body.totalChangeRequests).toBe(42);
        expect(res.body.leadTime).toBe(2.5);
      });
  });

  it('should support date filtering', async () => {
    await request(app.getHttpServer())
      .get('/api/metrics/change-requests?startDate=2024-01-01&endDate=2024-03-31')
      .expect(200)
      .expect(() => {
        expect(services.changeRequestsService.getMetrics).toHaveBeenCalledWith(
          expect.objectContaining({
            startDate: '2024-01-01',
            endDate: '2024-03-31',
          })
        );
      });
  });

  it('should handle invalid date format', async () => {
    await request(app.getHttpServer())
      .get('/api/metrics/change-requests?startDate=invalid-date')
      .expect(500);
  });

  it('should handle missing required data gracefully', async () => {
    vi.spyOn(services.changeRequestsService, 'getMetrics').mockRejectedValueOnce(
      new Error('GitHub API unavailable')
    );

    await request(app.getHttpServer())
      .get('/api/metrics/change-requests')
      .expect(500)
      .expect((res) => {
        expect(res.body).toHaveProperty('error');
        expect(res.body).toHaveProperty('timestamp');
      });
  });

  it('should include filters in responses', async () => {
    await request(app.getHttpServer())
      .get('/api/metrics/change-requests?startDate=2024-01-01')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('totalChangeRequests');
      });
  });

  it('should return JSON content type', async () => {
    await request(app.getHttpServer())
      .get('/api/metrics/change-requests')
      .expect('Content-Type', /json/)
      .expect(200);
  });
});
