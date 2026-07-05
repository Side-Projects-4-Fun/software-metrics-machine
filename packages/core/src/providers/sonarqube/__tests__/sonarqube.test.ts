import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SonarqubeMeasuresClient } from '../sonarqube-client';
import { MockLoggerBuilder } from '../../../test/mock-logger-builder';

vi.mock('axios');

const mockGet = vi.fn();
const logger = new MockLoggerBuilder().build();

describe('SonarqubeMeasuresClient', () => {
  let client: SonarqubeMeasuresClient;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(axios.create).mockReturnValue({
      get: mockGet,
    } as any);

    mockGet.mockResolvedValue({
      data: {
        component: {
          key: 'project-key',
          measures: [],
        },
      },
    });

    client = new SonarqubeMeasuresClient(
      'https://sonarqube.example.com',
      'sonar-token',
      'project-key',
      logger
    );
  });

  it('should initialize self-hosted with Basic auth', () => {
    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'https://sonarqube.example.com',
        timeout: 30000,
        auth: { username: 'sonar-token', password: '' },
      })
    );
  });

  it('should initialize sonarcloud.io with query token', () => {
    new SonarqubeMeasuresClient('https://sonarcloud.io', 'sonar-token', 'project-key', logger);
    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'https://sonarcloud.io',
        timeout: 30000,
        params: { token: 'sonar-token' },
      })
    );
  });

  it('should fetch component measures', async () => {
    const measures = await client.fetchComponentMeasures({
      metrics: ['coverage', 'complexity'],
    });

    expect(measures).toBeDefined();
    expect(measures.key).toBe('project-key');
    expect(Array.isArray(measures.measures)).toBe(true);
    expect(mockGet).toHaveBeenCalledWith('/api/measures/component', {
      params: {
        component: 'project-key',
        metricKeys: 'coverage,complexity',
      },
    });
  });

  it('should fetch historical coverage measures with metric and timestamp fields', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        measures: [
          {
            metric: 'coverage',
            history: [
              { date: '2024-01-01T00:00:00+0000', value: '81.3' },
              { date: '2024-02-01T00:00:00+0000', value: '82.1' },
            ],
          },
        ],
      },
    });

    const measures = await client.fetchHistoricalMeasures({
      metrics: ['coverage'],
      startDate: '2024-01-01',
      endDate: '2024-02-29',
    });

    expect(measures).toEqual([
      {
        key: 'coverage_2024-01-01T00:00:00+0000',
        name: 'coverage on 2024-01-01T00:00:00+0000',
        metric: 'coverage',
        value: '81.3',
        formatter: 'PERCENT',
        timestamp: '2024-01-01T00:00:00+0000',
      },
      {
        key: 'coverage_2024-02-01T00:00:00+0000',
        name: 'coverage on 2024-02-01T00:00:00+0000',
        metric: 'coverage',
        value: '82.1',
        formatter: 'PERCENT',
        timestamp: '2024-02-01T00:00:00+0000',
      },
    ]);
    expect(mockGet).toHaveBeenCalledWith('/api/measures/search_history', {
      params: {
        component: 'project-key',
        metrics: 'coverage',
        from: '2024-01-01',
        to: '2024-02-29',
        p: 1,
        ps: 100,
      },
    });
  });

  it('should map 401 errors to auth error message for fetchHistoricalMeasures', async () => {
    const axiosError = Object.assign(new Error('Request failed'), {
      isAxiosError: true,
      response: { status: 401 },
      code: undefined,
    });
    mockGet.mockRejectedValueOnce(axiosError);
    vi.mocked(axios.isAxiosError).mockReturnValueOnce(true);

    await expect(client.fetchHistoricalMeasures()).rejects.toThrow(
      'SonarQube authentication failed. Check token.'
    );
  });

  it('should map 403 errors to access denied message for fetchHistoricalMeasures', async () => {
    const axiosError = Object.assign(new Error('Request failed'), {
      isAxiosError: true,
      response: { status: 403 },
      code: undefined,
    });
    mockGet.mockRejectedValueOnce(axiosError);
    vi.mocked(axios.isAxiosError).mockReturnValueOnce(true);

    await expect(client.fetchHistoricalMeasures()).rejects.toThrow(
      'SonarQube access denied for project project-key. Ensure the token user has Browse permission for this project.'
    );
  });

  it('should map ECONNABORTED errors to timeout message for fetchHistoricalMeasures', async () => {
    const axiosError = Object.assign(new Error('timeout'), {
      isAxiosError: true,
      response: undefined,
      code: 'ECONNABORTED',
    });
    mockGet.mockRejectedValueOnce(axiosError);
    vi.mocked(axios.isAxiosError).mockReturnValueOnce(true);

    await expect(client.fetchHistoricalMeasures()).rejects.toThrow(
      'SonarQube API request timeout (30s).'
    );
  });

  it('should rethrow 404 errors unmodified for fetchHistoricalMeasures (not mapped)', async () => {
    const axiosError = Object.assign(new Error('Not Found'), {
      isAxiosError: true,
      response: { status: 404 },
      code: undefined,
    });
    mockGet.mockRejectedValueOnce(axiosError);
    vi.mocked(axios.isAxiosError).mockReturnValueOnce(true);

    await expect(client.fetchHistoricalMeasures()).rejects.toBe(axiosError);
  });

  it('should rethrow axios errors with no matching status/code for fetchHistoricalMeasures', async () => {
    const axiosError = Object.assign(new Error('Internal Server Error'), {
      isAxiosError: true,
      response: { status: 500 },
      code: undefined,
    });
    mockGet.mockRejectedValueOnce(axiosError);
    vi.mocked(axios.isAxiosError).mockReturnValueOnce(true);

    await expect(client.fetchHistoricalMeasures()).rejects.toBe(axiosError);
  });

  it('should rethrow non-axios errors unmodified for fetchHistoricalMeasures', async () => {
    const plainError = new Error('plain failure');
    mockGet.mockRejectedValueOnce(plainError);
    vi.mocked(axios.isAxiosError).mockReturnValueOnce(false);

    await expect(client.fetchHistoricalMeasures()).rejects.toBe(plainError);
  });

  it('should return an empty array when no historical measures are found', async () => {
    mockGet.mockResolvedValueOnce({ data: { measures: [] } });

    const measures = await client.fetchHistoricalMeasures();

    expect(measures).toEqual([]);
  });

  it('should return an empty array when measures is missing entirely', async () => {
    mockGet.mockResolvedValueOnce({ data: {} });

    const measures = await client.fetchHistoricalMeasures();

    expect(measures).toEqual([]);
  });

  it('should flatten multiple measures each with multiple history entries', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        measures: [
          {
            metric: 'coverage',
            history: [
              { date: '2024-01-01', value: '80' },
              { date: '2024-02-01', value: '85' },
            ],
          },
          {
            metric: 'complexity',
            history: [{ date: '2024-01-01', value: '10' }],
          },
        ],
      },
    });

    const measures = await client.fetchHistoricalMeasures();

    expect(measures).toHaveLength(3);
    expect(measures).toEqual([
      {
        key: 'coverage_2024-01-01',
        name: 'coverage on 2024-01-01',
        metric: 'coverage',
        value: '80',
        formatter: 'PERCENT',
        timestamp: '2024-01-01',
      },
      {
        key: 'coverage_2024-02-01',
        name: 'coverage on 2024-02-01',
        metric: 'coverage',
        value: '85',
        formatter: 'PERCENT',
        timestamp: '2024-02-01',
      },
      {
        key: 'complexity_2024-01-01',
        name: 'complexity on 2024-01-01',
        metric: 'complexity',
        value: '10',
        formatter: 'NUMBER',
        timestamp: '2024-01-01',
      },
    ]);
  });

  it('should fall back to 0 when a history entry value is missing', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        measures: [
          {
            metric: 'coverage',
            history: [{ date: '2024-01-01', value: undefined }],
          },
        ],
      },
    });

    const measures = await client.fetchHistoricalMeasures();

    expect(measures[0].value).toBe(0);
  });

  it('should use NUMBER formatter for non-coverage metrics', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        measures: [
          {
            metric: 'complexity',
            history: [{ date: '2024-01-01', value: '5' }],
          },
        ],
      },
    });

    const measures = await client.fetchHistoricalMeasures();

    expect(measures[0].formatter).toBe('NUMBER');
  });

  it('should use default metrics when none are provided for fetchHistoricalMeasures', async () => {
    mockGet.mockResolvedValueOnce({ data: { measures: [] } });

    await client.fetchHistoricalMeasures();

    expect(mockGet).toHaveBeenCalledWith('/api/measures/search_history', {
      params: {
        component: 'project-key',
        metrics: 'sqale_rating,coverage,duplicated_lines_density',
        p: 1,
        ps: 100,
      },
    });
  });

  it('should omit from/to params when startDate and endDate are not provided', async () => {
    mockGet.mockResolvedValueOnce({ data: { measures: [] } });

    await client.fetchHistoricalMeasures();

    const callParams = mockGet.mock.calls[0][1].params;
    expect(callParams).not.toHaveProperty('from');
    expect(callParams).not.toHaveProperty('to');
  });

  it('should map 401 errors to auth error message', async () => {
    const axiosError = Object.assign(new Error('Request failed'), {
      isAxiosError: true,
      response: { status: 401 },
      code: undefined,
    });
    mockGet.mockRejectedValueOnce(axiosError);
    vi.mocked(axios.isAxiosError).mockReturnValueOnce(true);

    await expect(client.fetchComponentMeasures()).rejects.toThrow(
      'SonarQube authentication failed. Check token.'
    );
  });

  it('should use strategy=all for self-hosted component tree', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        baseComponent: { key: 'project-key', measures: [] },
        components: [],
      },
    });

    await client.fetchComponentTree();

    expect(mockGet).toHaveBeenCalledWith('/api/measures/component_tree', {
      params: expect.objectContaining({ strategy: 'all' }),
    });
  });

  it('should map 403 errors to access denied message for fetchComponentMeasures', async () => {
    const axiosError = Object.assign(new Error('Request failed'), {
      isAxiosError: true,
      response: { status: 403 },
      code: undefined,
    });
    mockGet.mockRejectedValueOnce(axiosError);
    vi.mocked(axios.isAxiosError).mockReturnValueOnce(true);

    await expect(client.fetchComponentMeasures()).rejects.toThrow(
      'SonarQube access denied for project project-key. Ensure the token user has Browse permission for this project.'
    );
  });

  it('should map 404 errors to project not found message for fetchComponentMeasures', async () => {
    const axiosError = Object.assign(new Error('Request failed'), {
      isAxiosError: true,
      response: { status: 404 },
      code: undefined,
    });
    mockGet.mockRejectedValueOnce(axiosError);
    vi.mocked(axios.isAxiosError).mockReturnValueOnce(true);

    await expect(client.fetchComponentMeasures()).rejects.toThrow(
      'SonarQube project project-key not found.'
    );
  });

  it('should map ECONNABORTED errors to timeout message for fetchComponentMeasures', async () => {
    const axiosError = Object.assign(new Error('timeout'), {
      isAxiosError: true,
      response: undefined,
      code: 'ECONNABORTED',
    });
    mockGet.mockRejectedValueOnce(axiosError);
    vi.mocked(axios.isAxiosError).mockReturnValueOnce(true);

    await expect(client.fetchComponentMeasures()).rejects.toThrow(
      'SonarQube API request timeout (30s).'
    );
  });

  it('should rethrow axios errors with no matching status/code for fetchComponentMeasures', async () => {
    const axiosError = Object.assign(new Error('Internal Server Error'), {
      isAxiosError: true,
      response: { status: 500 },
      code: undefined,
    });
    mockGet.mockRejectedValueOnce(axiosError);
    vi.mocked(axios.isAxiosError).mockReturnValueOnce(true);

    await expect(client.fetchComponentMeasures()).rejects.toBe(axiosError);
  });

  it('should rethrow non-axios errors unmodified for fetchComponentMeasures', async () => {
    const plainError = new Error('plain failure');
    mockGet.mockRejectedValueOnce(plainError);
    vi.mocked(axios.isAxiosError).mockReturnValueOnce(false);

    await expect(client.fetchComponentMeasures()).rejects.toBe(plainError);
  });

  it('should throw when response component is missing for fetchComponentMeasures', async () => {
    mockGet.mockResolvedValueOnce({ data: {} });

    await expect(client.fetchComponentMeasures()).rejects.toThrow(
      'Project project-key not found in SonarQube.'
    );
  });

  it('should use default metrics when none are provided for fetchComponentMeasures', async () => {
    await client.fetchComponentMeasures();

    expect(mockGet).toHaveBeenCalledWith('/api/measures/component', {
      params: {
        component: 'project-key',
        metricKeys: 'coverage,sqale_rating,complexity,duplicated_lines_density,ncloc,code_smells,bugs',
      },
    });
  });

  it('should map 401 errors to auth error message for fetchComponentTree', async () => {
    const axiosError = Object.assign(new Error('Request failed'), {
      isAxiosError: true,
      response: { status: 401 },
      code: undefined,
    });
    mockGet.mockRejectedValueOnce(axiosError);
    vi.mocked(axios.isAxiosError).mockReturnValueOnce(true);

    await expect(client.fetchComponentTree()).rejects.toThrow(
      'SonarQube authentication failed. Check token.'
    );
  });

  it('should map 403 errors to access denied message using explicit component for fetchComponentTree', async () => {
    const axiosError = Object.assign(new Error('Request failed'), {
      isAxiosError: true,
      response: { status: 403 },
      code: undefined,
    });
    mockGet.mockRejectedValueOnce(axiosError);
    vi.mocked(axios.isAxiosError).mockReturnValueOnce(true);

    await expect(client.fetchComponentTree({ component: 'sub-module' })).rejects.toThrow(
      'SonarQube access denied for component sub-module. Ensure the token user has Browse permission for this project/component.'
    );
  });

  it('should map 404 errors to component not found message using explicit component for fetchComponentTree', async () => {
    const axiosError = Object.assign(new Error('Request failed'), {
      isAxiosError: true,
      response: { status: 404 },
      code: undefined,
    });
    mockGet.mockRejectedValueOnce(axiosError);
    vi.mocked(axios.isAxiosError).mockReturnValueOnce(true);

    await expect(client.fetchComponentTree({ component: 'sub-module' })).rejects.toThrow(
      'SonarQube component sub-module not found.'
    );
  });

  it('should map 403 errors to access denied message using projectKey by default for fetchComponentTree', async () => {
    const axiosError = Object.assign(new Error('Request failed'), {
      isAxiosError: true,
      response: { status: 403 },
      code: undefined,
    });
    mockGet.mockRejectedValueOnce(axiosError);
    vi.mocked(axios.isAxiosError).mockReturnValueOnce(true);

    await expect(client.fetchComponentTree()).rejects.toThrow(
      'SonarQube access denied for component project-key. Ensure the token user has Browse permission for this project/component.'
    );
  });

  it('should map ECONNABORTED errors to timeout message for fetchComponentTree', async () => {
    const axiosError = Object.assign(new Error('timeout'), {
      isAxiosError: true,
      response: undefined,
      code: 'ECONNABORTED',
    });
    mockGet.mockRejectedValueOnce(axiosError);
    vi.mocked(axios.isAxiosError).mockReturnValueOnce(true);

    await expect(client.fetchComponentTree()).rejects.toThrow(
      'SonarQube API request timeout (30s).'
    );
  });

  it('should rethrow axios errors with no matching status/code for fetchComponentTree', async () => {
    const axiosError = Object.assign(new Error('Internal Server Error'), {
      isAxiosError: true,
      response: { status: 500 },
      code: undefined,
    });
    mockGet.mockRejectedValueOnce(axiosError);
    vi.mocked(axios.isAxiosError).mockReturnValueOnce(true);

    await expect(client.fetchComponentTree()).rejects.toBe(axiosError);
  });

  it('should rethrow non-axios errors unmodified for fetchComponentTree', async () => {
    const plainError = new Error('plain failure');
    mockGet.mockRejectedValueOnce(plainError);
    vi.mocked(axios.isAxiosError).mockReturnValueOnce(false);

    await expect(client.fetchComponentTree()).rejects.toBe(plainError);
  });

  it('should throw when baseComponent is missing for fetchComponentTree', async () => {
    mockGet.mockResolvedValueOnce({ data: {} });

    await expect(client.fetchComponentTree()).rejects.toThrow(
      'Component project-key not found in SonarQube.'
    );
  });

  it('should throw using explicit component name when baseComponent is missing', async () => {
    mockGet.mockResolvedValueOnce({ data: {} });

    await expect(client.fetchComponentTree({ component: 'sub-module' })).rejects.toThrow(
      'Component sub-module not found in SonarQube.'
    );
  });

  it('should fall back to just baseComponent when components is missing', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        baseComponent: { key: 'project-key', measures: [] },
      },
    });

    const tree = await client.fetchComponentTree();

    expect(tree).toEqual([{ key: 'project-key', measures: [] }]);
  });

  it('should use default component, depth, and metrics when none are provided for fetchComponentTree', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        baseComponent: { key: 'project-key', measures: [] },
        components: [],
      },
    });

    await client.fetchComponentTree();

    expect(mockGet).toHaveBeenCalledWith('/api/measures/component_tree', {
      params: expect.objectContaining({
        component: 'project-key',
        metricKeys: 'complexity,cognitive_complexity,ncloc,sqale_rating,coverage',
        ps: 500,
        strategy: 'all',
      }),
    });
  });

  it('should use explicit component and depth when provided for fetchComponentTree', async () => {
    const sonarCloudClient = new SonarqubeMeasuresClient(
      'https://sonarcloud.io',
      'sonar-token',
      'project-key',
      logger
    );
    mockGet.mockResolvedValueOnce({
      data: {
        baseComponent: { key: 'sub-module', measures: [] },
        components: [],
      },
    });

    await sonarCloudClient.fetchComponentTree({ component: 'sub-module', depth: 2 });

    expect(mockGet).toHaveBeenCalledWith('/api/measures/component_tree', {
      params: expect.objectContaining({
        component: 'sub-module',
        depth: 2,
      }),
    });
  });

  it('should use explicit metrics when provided for fetchComponentTree', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        baseComponent: { key: 'project-key', measures: [] },
        components: [],
      },
    });

    await client.fetchComponentTree({ metrics: ['bugs', 'vulnerabilities'] });

    expect(mockGet).toHaveBeenCalledWith('/api/measures/component_tree', {
      params: expect.objectContaining({
        metricKeys: 'bugs,vulnerabilities',
      }),
    });
  });

  it('should use depth param for sonarcloud.io component tree', async () => {
    const sonarCloudClient = new SonarqubeMeasuresClient(
      'https://sonarcloud.io',
      'sonar-token',
      'project-key',
      logger
    );
    mockGet.mockResolvedValueOnce({
      data: {
        baseComponent: { key: 'project-key', measures: [] },
        components: [],
      },
    });

    await sonarCloudClient.fetchComponentTree();

    const callParams = mockGet.mock.calls[0][1].params;
    expect(callParams).toHaveProperty('depth', -1);
    expect(callParams).not.toHaveProperty('strategy');
  });
});
