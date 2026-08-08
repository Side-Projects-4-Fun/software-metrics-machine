import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { MockedMetricsServices } from './helpers/metrics-test-app';
import { createMetricsTestApp } from './helpers/metrics-test-app';

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

  it('returns the CodeChurnResult shape (added/deleted/commits rows) for codeChurn', async () => {
    // Guards the contract: getCodeChurn is called WITHOUT typeChurn, so the
    // response must carry added/deleted/commits rows, not {date,type,value}.
    services.codeMetricsRepository.getCodeChurn.mockResolvedValueOnce({
      data: [
        { date: '2024-01-01', added: 1520, deleted: 890, commits: 3 },
        { date: '2024-01-02', added: 40, deleted: 10, commits: 1 },
      ],
    });

    await request(app.getHttpServer())
      .get('/api/metrics/code')
      .expect(200)
      .expect((res) => {
        expect(res.body.codeChurn.data).toEqual([
          { date: '2024-01-01', added: 1520, deleted: 890, commits: 3 },
          { date: '2024-01-02', added: 40, deleted: 10, commits: 1 },
        ]);
      });

    expect(services.codeMetricsRepository.getCodeChurn).toHaveBeenCalledWith({
      startDate: undefined,
      endDate: undefined,
    });
  });

  it('passes the default helper codeChurn mock through unchanged', async () => {
    // Uses the default helper mock (no override) so this test fails if the
    // metrics-test-app fixture itself drifts to a non-CodeChurnResult shape.
    const response = await request(app.getHttpServer()).get('/api/metrics/code').expect(200);

    expect(response.body.codeChurn).toEqual({
      data: [{ date: '2024-01-01', added: 1520, deleted: 890, commits: 3 }],
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
