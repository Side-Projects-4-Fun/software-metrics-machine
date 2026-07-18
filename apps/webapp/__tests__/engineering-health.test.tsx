import React from 'react';
import { render, screen } from '@testing-library/react';
import EngineeringHealthPage from '@/app/dashboard/engineering-health/page';
import { engineeringHealthAPI } from '@/server/api/engineeringHealth';

jest.mock('@/server/api/engineeringHealth', () => ({
  engineeringHealthAPI: {
    evaluate: jest.fn(),
  },
}));

const mockEngineeringHealthAPI = engineeringHealthAPI as jest.Mocked<typeof engineeringHealthAPI>;

describe('EngineeringHealthPage', () => {
  it('renders comparison chart and trend chart when series is available', async () => {
    mockEngineeringHealthAPI.evaluate.mockResolvedValue({
      generatedAt: '2026-07-18T20:00:00.000Z',
      evaluations: [
        {
          id: 'pipeline-duration',
          category: 'delivery',
          value: {
            value: 15,
            unit: 'minutes',
            direction: 'lower_is_better',
            sampleSize: 2,
            series: [
              { period: '2026-W05', value: 20 },
              { period: '2026-W06', value: 15 },
            ],
          },
          comparison: {
            trend: 'degrading',
            delta: 15,
            deltaPercentage: null,
            current: 15,
            previous: 0,
            summary: 'Metric degraded by 15.00 minutes.',
          },
          summary: {
            title: 'pipeline-duration',
            valueLabel: '15.00 minutes',
            notes: ['Metric degraded by 15.00 minutes.'],
          },
          target: {
            operator: 'lt',
            value: 10,
            description: 'Average pipeline duration below ten minutes.',
          },
          recommendation: {
            level: 'critical',
            summary: 'Metric is outside target and needs attention.',
            actions: ['Investigate root causes and define a short-term corrective action plan.'],
          },
        },
      ],
    });

    const ui = await EngineeringHealthPage({
      searchParams: Promise.resolve({
        startDate: '2026-06-01',
        endDate: '2026-06-30',
        compareStartDate: '2026-05-01',
        compareEndDate: '2026-05-31',
      }),
    });
    render(ui);

    expect(screen.getByText('How comparison works')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Example: if current is June 1 to June 30 and compare is May 1 to May 31, June is compared against May.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/Current period:/)).toBeInTheDocument();
    expect(screen.getByText(/2026-06-01 to 2026-06-30/)).toBeInTheDocument();
    expect(screen.getByText(/Comparison period:/)).toBeInTheDocument();
    expect(screen.getByText(/2026-05-01 to 2026-05-31/)).toBeInTheDocument();
    expect(screen.getByText('Comparison chart')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Trend chart')).toBeInTheDocument();
    expect(screen.getByLabelText('Metric trend over selected period')).toBeInTheDocument();
  });

  it('does not render trend chart when series is missing or too short', async () => {
    mockEngineeringHealthAPI.evaluate.mockResolvedValue({
      generatedAt: '2026-07-18T20:00:00.000Z',
      evaluations: [
        {
          id: 'pipeline-duration',
          category: 'delivery',
          value: {
            value: 15,
            unit: 'minutes',
            direction: 'lower_is_better',
            sampleSize: 1,
            series: [{ period: '2026-W06', value: 15 }],
          },
          comparison: {
            trend: 'unknown',
            delta: null,
            deltaPercentage: null,
            current: 15,
            previous: null,
            summary: 'Insufficient data to compare periods.',
          },
          summary: {
            title: 'pipeline-duration',
            valueLabel: '15.00 minutes',
            notes: ['Insufficient data to compare periods.'],
          },
          target: {
            operator: 'lt',
            value: 10,
            description: 'Average pipeline duration below ten minutes.',
          },
          recommendation: {
            level: 'critical',
            summary: 'Metric is outside target and needs attention.',
            actions: ['Investigate root causes and define a short-term corrective action plan.'],
          },
        },
      ],
    });

    const ui = await EngineeringHealthPage({ searchParams: Promise.resolve({}) });
    render(ui);

    expect(screen.getByText('Comparison chart')).toBeInTheDocument();
    expect(screen.queryByText('Trend chart')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Metric trend over selected period')).not.toBeInTheDocument();
  });

  it('shows comparison period as not set when compare dates are missing', async () => {
    mockEngineeringHealthAPI.evaluate.mockResolvedValue({
      generatedAt: '2026-07-18T20:00:00.000Z',
      evaluations: [
        {
          id: 'pipeline-duration',
          category: 'delivery',
          value: {
            value: 15,
            unit: 'minutes',
            direction: 'lower_is_better',
            sampleSize: 1,
          },
          comparison: {
            trend: 'unknown',
            delta: null,
            deltaPercentage: null,
            current: 15,
            previous: null,
            summary: 'Insufficient data to compare periods.',
          },
          summary: {
            title: 'pipeline-duration',
            valueLabel: '15.00 minutes',
            notes: ['Insufficient data to compare periods.'],
          },
          target: {
            operator: 'lt',
            value: 10,
            description: 'Average pipeline duration below ten minutes.',
          },
          recommendation: {
            level: 'critical',
            summary: 'Metric is outside target and needs attention.',
            actions: ['Investigate root causes and define a short-term corrective action plan.'],
          },
        },
      ],
    });

    const ui = await EngineeringHealthPage({
      searchParams: Promise.resolve({
        startDate: '2026-06-01',
        endDate: '2026-06-30',
      }),
    });
    render(ui);

    expect(screen.getByText(/Current period:/)).toBeInTheDocument();
    expect(screen.getByText(/2026-06-01 to 2026-06-30/)).toBeInTheDocument();
    expect(screen.getByText(/Comparison period:/)).toBeInTheDocument();
    expect(screen.getByText(/Not set/)).toBeInTheDocument();
  });
});
