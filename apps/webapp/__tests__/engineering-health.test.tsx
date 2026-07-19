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

    expect(screen.getByLabelText('Show comparison guide')).toBeInTheDocument();
    expect(screen.getByText('Comparison chart')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Jul 18, 2026, 20:00 UTC')).toBeInTheDocument();
    expect(screen.getByText('Jun 1, 2026 to Jun 30, 2026')).toBeInTheDocument();
    expect(screen.getByText('May 1, 2026 to May 31, 2026')).toBeInTheDocument();
    expect(screen.getByText('Trend chart')).toBeInTheDocument();
    expect(screen.getByLabelText('Metric trend over selected period')).toBeInTheDocument();
    expect(screen.getByText('Executive Summary')).toBeInTheDocument();
    expect(screen.getByText('Scorecard')).toBeInTheDocument();
    expect(screen.getByText('Trend And Driver Analysis')).toBeInTheDocument();
    expect(screen.getByText('Data Confidence And References')).toBeInTheDocument();
    const referencesLink = screen.getByRole('link', { name: 'References' });
    expect(referencesLink).toHaveAttribute('href', '/dashboard/references');
    expect(screen.getByText('Report References')).toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: /Accelerate \(Lead time elite benchmark: < 1 hour\)/,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: /Reference 1:/,
      })
    ).toBeInTheDocument();
    expect(screen.queryByText('Action Plan')).not.toBeInTheDocument();
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

  it('renders comparison guide trigger when compare dates are missing', async () => {
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

    expect(screen.getByLabelText('Show comparison guide')).toBeInTheDocument();
  });

  it('formats leadership generated date using the provided timezone filter', async () => {
    mockEngineeringHealthAPI.evaluate.mockResolvedValue({
      generatedAt: '2026-07-18T23:30:00.000Z',
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
        timezone: 'Europe/Madrid',
      }),
    });
    render(ui);

    expect(screen.getByText(/Jul 19, 2026, 01:30/)).toBeInTheDocument();
  });
});
