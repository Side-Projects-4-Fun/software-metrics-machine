import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createMetricsTestApp, MockedMetricsServices } from './helpers/metrics-test-app';

describe('MetricsController - Code Metrics', () => {
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

  it('should return code metrics', async () => {
    await request(app.getHttpServer())
      .get('/api/metrics/code')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('pairingIndex');
        expect(res.body).toHaveProperty('codeChurn');
        expect(res.body).toHaveProperty('fileCoupling');
      });
  });

  it('should handle single author parameter', async () => {
    await request(app.getHttpServer())
      .get('/api/metrics/code?selectedAuthors=Alice&selectedAuthors=Alice')
      .expect(200);
  });

  it('should handle missing repository', async () => {
    vi.spyOn(services.pairingService, 'getPairingIndex').mockRejectedValueOnce(
      new Error('Repository not found')
    );

    await request(app.getHttpServer()).get('/api/metrics/code').expect(500);
  });
});
