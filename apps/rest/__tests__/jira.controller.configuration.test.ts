import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMetricsTestApp, MockedMetricsServices } from './helpers/metrics-test-app';

describe('Jira', () => {
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

  it('should return issue metrics', async () => {
    await request(app.getHttpServer())
      .get('/api/metrics/issues')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('totalIssues');
        expect(res.body.totalIssues).toBe(320);
      });
  });

  it('should support issue status filtering', async () => {
    await request(app.getHttpServer())
      .get('/api/metrics/issues?status=Done')
      .expect(200)
      .expect(() => {
        expect(services.issuesRepository.getIssues).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'Done',
          })
        );
      });
  });
});
