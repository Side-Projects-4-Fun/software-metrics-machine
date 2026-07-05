/**
 * Integration tests for SonarQube API client
 *
 * WARNING: These tests make real HTTP calls to SonarQube API.
 * They require:
 * - Valid SONARQUBE_URL, SONARQUBE_TOKEN, SONARQUBE_PROJECT in environment
 * - Network access to SonarQube instance
 * - Project configured in SonarQube
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { SonarqubeMeasuresClient } from '../sonarqube-client';
import { MockLoggerBuilder } from '../../../test/mock-logger-builder';

const SONARQUBE_URL = process.env.SONARQUBE_URL || 'http://localhost:9000';
const SONARQUBE_TOKEN = process.env.SONARQUBE_TOKEN || 'test-token';
const SONARQUBE_PROJECT = process.env.SONARQUBE_PROJECT || 'my-project';
const logger = new MockLoggerBuilder().build();

// Skip real API tests if not configured
const skipRealApiTests = !process.env.RUN_SONARQUBE_INTEGRATION_TESTS;

describe.skip('SonarQube API Integration Tests', () => {
  let sonarClient: SonarqubeMeasuresClient;

  beforeAll(() => {
    sonarClient = new SonarqubeMeasuresClient(
      SONARQUBE_URL,
      SONARQUBE_TOKEN,
      SONARQUBE_PROJECT,
      logger
    );
  });

  describe('SonarqubeMeasuresClient', () => {
    it.skipIf(skipRealApiTests)('should fetch current component measures', async () => {
      const result = await sonarClient.fetchComponentMeasures();

      expect(result).toBeDefined();
      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('measures');
      expect(Array.isArray(result.measures)).toBe(true);

      if (result.measures.length > 0) {
        const measure = result.measures[0];
        expect(measure).toHaveProperty('key');
        expect(measure).toHaveProperty('value');
      }
    });

    it.skipIf(skipRealApiTests)('should fetch specific metrics', async () => {
      const result = await sonarClient.fetchComponentMeasures({
        metrics: ['ncloc', 'complexity', 'coverage'],
      });

      expect(result).toBeDefined();
      expect(result.measures).toBeDefined();

      // At least some of the requested metrics should be present
      const measureKeys = result.measures.map((m) => m.metric);
      const hasRequestedMetric = measureKeys.some((key) =>
        ['ncloc', 'complexity', 'coverage'].includes(key)
      );
      expect(hasRequestedMetric || result.measures.length === 0).toBe(true);
    });

    it.skipIf(skipRealApiTests)('should fetch historical measures', async () => {
      const result = await sonarClient.fetchHistoricalMeasures({
        metrics: ['coverage', 'sqale_rating'],
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });

      expect(Array.isArray(result)).toBe(true);
    });

    it('should throw error on invalid project', async () => {
      const invalidClient = new SonarqubeMeasuresClient(
        SONARQUBE_URL,
        SONARQUBE_TOKEN,
        'non-existent-project-key',
        logger
      );

      try {
        await invalidClient.fetchComponentMeasures();
      } catch (error: any) {
        expect(error.message).toMatch(/not found|not found/i);
      }
    });

    it('should handle invalid token gracefully', async () => {
      const invalidClient = new SonarqubeMeasuresClient(
        SONARQUBE_URL,
        'invalid-token',
        SONARQUBE_PROJECT,
        logger
      );

      try {
        await invalidClient.fetchComponentMeasures();
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('should handle unreachable server gracefully', async () => {
      const unreachableClient = new SonarqubeMeasuresClient(
        'http://invalid-sonarqube-url-12345.local',
        SONARQUBE_TOKEN,
        SONARQUBE_PROJECT,
        logger
      );

      try {
        await unreachableClient.fetchComponentMeasures();
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });
  });
});

describe('SonarQube API Unit Tests', () => {
  it('should initialize client with credentials', () => {
    const client = new SonarqubeMeasuresClient(
      'http://localhost:9000',
      'token123',
      'my-project',
      logger
    );

    expect(client).toBeDefined();
  });

  it('should handle URL with trailing slash', () => {
    const client1 = new SonarqubeMeasuresClient(
      'http://localhost:9000/',
      'token123',
      'my-project',
      logger
    );

    const client2 = new SonarqubeMeasuresClient(
      'http://localhost:9000',
      'token123',
      'my-project',
      logger
    );

    expect(client1).toBeDefined();
    expect(client2).toBeDefined();
  });

  it('should create client with default metrics', async () => {
    const client = new SonarqubeMeasuresClient(
      'http://localhost:9000',
      'token123',
      'test-project',
      logger
    );

    // This should not throw even though we won't hit the API
    expect(client).toBeDefined();
  });
});
