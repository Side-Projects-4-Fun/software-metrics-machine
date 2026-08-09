import { render, screen, within } from '@testing-library/react';
import EngineeringHealthPage from '@/app/engineering-health/page';
import { engineeringHealthAPI } from '@/server/api/engineeringHealth';
import {
  EngineeringHealthMetricBuilder,
} from './builders/api-response/engineering-health-metric.builder';
import {
  EngineeringHealthEvaluationBuilder,
} from './builders/api-response/engineering-health-evaluation.builder';

jest.mock('@/server/api/engineeringHealth', () => ({
  engineeringHealthAPI: {
    evaluate: jest.fn(),
  },
}));

const mockEngineeringHealthAPI = engineeringHealthAPI as jest.Mocked<typeof engineeringHealthAPI>;

function pipelineDurationMetric(): ReturnType<EngineeringHealthMetricBuilder['build']> {
  return new EngineeringHealthMetricBuilder()
    .withId('pipeline-duration')
    .withCategory('delivery')
    .withValue(15, '15.00 minutes')
    .withTrend('degrading', 15, 0)
    .withRecommendation('critical')
    .build();
}

describe('EngineeringHealthPage', () => {
  it('renders comparison chart and trend chart when series is available', async () => {
    const metric = pipelineDurationMetric();
    metric.value.series = [
      { period: '2026-W05', value: 20, value_formatted: '20' },
      { period: '2026-W06', value: 15, value_formatted: '15' },
    ];

    mockEngineeringHealthAPI.evaluate.mockResolvedValue(
      new EngineeringHealthEvaluationBuilder()
        .withGeneratedAt('2026-07-18T20:00:00.000Z')
        .withMetric(metric)
        .build()
    );

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
    const metric = pipelineDurationMetric();
    metric.value.series = [{ period: '2026-W06', value: 15, value_formatted: '15' }];
    metric.comparison.trend = 'unknown';
    metric.comparison.delta = null;
    metric.comparison.delta_formatted = 'N/A';
    metric.comparison.previous = null;
    metric.comparison.previous_formatted = 'N/A';

    mockEngineeringHealthAPI.evaluate.mockResolvedValue(
      new EngineeringHealthEvaluationBuilder().withMetric(metric).build()
    );

    const ui = await EngineeringHealthPage({ searchParams: Promise.resolve({}) });
    render(ui);

    expect(screen.getByText('Comparison chart')).toBeInTheDocument();
    expect(screen.queryByText('Trend chart')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Metric trend over selected period')).not.toBeInTheDocument();
  });

  it('renders comparison guide trigger when compare dates are missing', async () => {
    const metric = pipelineDurationMetric();
    metric.comparison.trend = 'unknown';
    metric.comparison.delta = null;
    metric.comparison.delta_formatted = 'N/A';
    metric.comparison.previous = null;
    metric.comparison.previous_formatted = 'N/A';

    mockEngineeringHealthAPI.evaluate.mockResolvedValue(
      new EngineeringHealthEvaluationBuilder().withMetric(metric).build()
    );

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
    const metric = pipelineDurationMetric();
    metric.comparison.trend = 'unknown';
    metric.comparison.delta = null;
    metric.comparison.delta_formatted = 'N/A';
    metric.comparison.previous = null;
    metric.comparison.previous_formatted = 'N/A';

    const evaluation = new EngineeringHealthEvaluationBuilder().withMetric(metric).build();
    evaluation.generatedAt = '2026-07-18T23:30:00.000Z';

    mockEngineeringHealthAPI.evaluate.mockResolvedValue(evaluation);

    const ui = await EngineeringHealthPage({
      searchParams: Promise.resolve({
        timezone: 'Europe/Madrid',
      }),
    });
    render(ui);

    expect(screen.getByText(/Jul 19, 2026, 01:30/)).toBeInTheDocument();
  });

  it('groups scorecards by category before sorting each category by risk and movement', async () => {
    const qualityWatch = new EngineeringHealthMetricBuilder()
      .withId('complexity')
      .withCategory('quality')
      .withValue(12, '12 points')
      .withTrend('stable', 12, 10)
      .withRecommendation('watch')
      .build();

    const deliveryWatch = new EngineeringHealthMetricBuilder()
      .withId('pipeline-duration')
      .withCategory('delivery')
      .withDeploymentTarget('.github/workflows/frontend.yml', 'deploy')
      .withValue(11, '11 minutes')
      .withTrend('stable', 11, 10)
      .withRecommendation('watch')
      .build();
    deliveryWatch.scope!.key = 'frontend';
    deliveryWatch.scope!.label = 'Frontend App';

    const deliveryCritical = new EngineeringHealthMetricBuilder()
      .withId('lead-time')
      .withCategory('delivery')
      .withDeploymentTarget('.github/workflows/frontend.yml', 'deploy')
      .withValue(25, '25 minutes')
      .withTrend('degrading', 25, 10)
      .withRecommendation('critical')
      .build();
    deliveryCritical.scope!.key = 'frontend';
    deliveryCritical.scope!.label = 'Frontend App';

    const deliveryApi = new EngineeringHealthMetricBuilder()
      .withId('failure-rate')
      .withCategory('delivery')
      .withDeploymentTarget('.github/workflows/api.yml', 'deploy')
      .withValue(8, '8 minutes')
      .withTrend('improving', 8, 10)
      .withRecommendation('good')
      .build();
    deliveryApi.scope!.key = 'api';
    deliveryApi.scope!.label = 'API Service';

    mockEngineeringHealthAPI.evaluate.mockResolvedValue(
      new EngineeringHealthEvaluationBuilder()
        .withMetric(qualityWatch)
        .withMetric(deliveryWatch)
        .withMetric(deliveryCritical)
        .withMetric(deliveryApi)
        .build()
    );

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

    const deliveryCriticalCard = within(frontendTargetScorecards).getByRole('article', {
      name: 'Lead Time scorecard',
    });
    const deliveryWatchCard = within(frontendTargetScorecards).getByRole('article', {
      name: 'Pipeline Duration scorecard',
    });
    expect(deliveryCriticalCard.nextElementSibling).toBe(deliveryWatchCard);
  });
});
