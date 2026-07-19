import React from 'react';
import { render, screen, within } from '@testing-library/react';
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
    expect(screen.getAllByText('Current').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Jul 18, 2026, 20:00 UTC')).toBeInTheDocument();
    expect(screen.getAllByText('Jun 1, 2026 to Jun 30, 2026')).toHaveLength(2);
    expect(screen.getAllByText('May 1, 2026 to May 31, 2026')).toHaveLength(2);
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
        name: /^\[1\] Forsgren et al\. \(2018\)/,
      })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', {
        name: /Reference 1:/,
      })[0]
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

  it('groups scorecards by category before sorting each category by risk and movement', async () => {
    mockEngineeringHealthAPI.evaluate.mockResolvedValue({
      generatedAt: '2026-07-18T20:00:00.000Z',
      evaluations: [
        {
          id: 'quality-watch-small-delta',
          category: 'quality',
          value: {
            value: 12,
            unit: 'points',
            direction: 'lower_is_better',
            sampleSize: 1,
          },
          comparison: {
            trend: 'stable',
            delta: 2,
            deltaPercentage: null,
            current: 12,
            previous: 10,
            summary: 'Quality watch metric moved by 2 points.',
          },
          summary: {
            title: 'quality-watch-small-delta',
            valueLabel: '12 points',
            notes: ['Quality watch metric moved by 2 points.'],
          },
          target: {
            operator: 'lt',
            value: 10,
            description: 'Keep quality score below ten points.',
          },
          recommendation: {
            level: 'watch',
            summary: 'Quality metric needs monitoring.',
            actions: [],
          },
        },
        {
          id: 'delivery-watch-small-delta',
          category: 'delivery',
          scope: {
            type: 'deployment-target',
            key: 'frontend',
            label: 'Frontend App',
          },
          value: {
            value: 11,
            unit: 'minutes',
            direction: 'lower_is_better',
            sampleSize: 1,
          },
          comparison: {
            trend: 'stable',
            delta: 1,
            deltaPercentage: null,
            current: 11,
            previous: 10,
            summary: 'Delivery watch metric moved by 1 minute.',
          },
          summary: {
            title: 'delivery-watch-small-delta',
            valueLabel: '11 minutes',
            notes: ['Delivery watch metric moved by 1 minute.'],
          },
          target: {
            operator: 'lt',
            value: 10,
            description: 'Keep delivery score below ten minutes.',
          },
          recommendation: {
            level: 'watch',
            summary: 'Delivery metric needs monitoring.',
            actions: [],
          },
        },
        {
          id: 'delivery-critical-large-delta',
          category: 'delivery',
          scope: {
            type: 'deployment-target',
            key: 'frontend',
            label: 'Frontend App',
          },
          value: {
            value: 25,
            unit: 'minutes',
            direction: 'lower_is_better',
            sampleSize: 1,
          },
          comparison: {
            trend: 'degrading',
            delta: 15,
            deltaPercentage: null,
            current: 25,
            previous: 10,
            summary: 'Delivery critical metric moved by 15 minutes.',
          },
          summary: {
            title: 'delivery-critical-large-delta',
            valueLabel: '25 minutes',
            notes: ['Delivery critical metric moved by 15 minutes.'],
          },
          target: {
            operator: 'lt',
            value: 10,
            description: 'Keep delivery score below ten minutes.',
          },
          recommendation: {
            level: 'critical',
            summary: 'Delivery metric needs attention.',
            actions: [],
          },
        },
        {
          id: 'delivery-api-target',
          category: 'delivery',
          scope: {
            type: 'deployment-target',
            key: 'api',
            label: 'API Service',
          },
          value: {
            value: 8,
            unit: 'minutes',
            direction: 'lower_is_better',
            sampleSize: 1,
          },
          comparison: {
            trend: 'improving',
            delta: -2,
            deltaPercentage: null,
            current: 8,
            previous: 10,
            summary: 'API delivery metric improved by 2 minutes.',
          },
          summary: {
            title: 'delivery-api-target',
            valueLabel: '8 minutes',
            notes: ['API delivery metric improved by 2 minutes.'],
          },
          target: {
            operator: 'lt',
            value: 10,
            description: 'Keep delivery score below ten minutes.',
          },
          recommendation: {
            level: 'good',
            summary: 'Delivery metric is on track.',
            actions: [],
          },
        },
      ],
    });

    const ui = await EngineeringHealthPage({ searchParams: Promise.resolve({}) });
    render(ui);

    const deliveryScorecards = screen.getByRole('region', { name: 'Delivery scorecards' });
    const qualityScorecards = screen.getByRole('region', { name: 'Quality scorecards' });
    expect(deliveryScorecards.nextElementSibling).toBe(qualityScorecards);

    const frontendTargetScorecards = within(deliveryScorecards).getByRole('region', {
      name: 'Frontend App delivery target scorecards',
    });
    const apiTargetScorecards = within(deliveryScorecards).getByRole('region', {
      name: 'API Service delivery target scorecards',
    });
    expect(frontendTargetScorecards).toBeInTheDocument();
    expect(apiTargetScorecards).toBeInTheDocument();
    expect(within(frontendTargetScorecards).queryByRole('article', {
      name: 'Delivery Api Target scorecard',
    })).not.toBeInTheDocument();

    const deliveryCritical = within(frontendTargetScorecards).getByRole('article', {
      name: 'Delivery Critical Large Delta scorecard',
    });
    const deliveryWatch = within(frontendTargetScorecards).getByRole('article', {
      name: 'Delivery Watch Small Delta scorecard',
    });
    expect(deliveryCritical.nextElementSibling).toBe(deliveryWatch);
  });
});
