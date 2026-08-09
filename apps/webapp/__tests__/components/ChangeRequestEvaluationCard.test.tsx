import { render, screen } from '@testing-library/react';
import ChangeRequestEvaluationCard from '@/components/charts/change-requests/ChangeRequestEvaluationCard';

type Severity = 'critical' | 'warning' | 'good';

const evaluationData = {
  generatedAt: '2026-01-01T00:00:00Z',
  signals: [
    {
      id: 'sig-1',
      title: 'Slow reviews',
      description: 'Reviews exceed 24h target',
      severity: 'warning' as Severity,
      category: 'review-time',
      metrics: [{ label: 'Review Hours', value: '3.5h' }],
    },
  ],
  summary: {
    totalChangeRequests: 20,
    mergedChangeRequests: 15,
    openChangeRequests: 2,
    commentsPerChangeRequest: 3.5,
    reviewHours: 3.3,
    reviewHours_formatted: '3.3 h',
    openDays: 2.3,
    openDays_formatted: '2.3 days',
    method: 'average',
    uniqueAuthors: 2,
    topReviewer: 'alice',
    bottleneckAuthor: 'bob',
  },
};

describe('ChangeRequestEvaluationCard', () => {
  it('renders the commentsPerChangeRequest value from the evaluation summary', () => {
    render(<ChangeRequestEvaluationCard data={evaluationData} method="average" />);

    // The component calls summary.commentsPerChangeRequest.toFixed(1) — if the field
    // name mismatches the API contract, this throws at runtime (TypeError: Cannot read
    // properties of undefined). The rendered value should be '3.5'.
    expect(screen.getByText('3.5')).toBeInTheDocument();
  });

  it('renders the review hours formatted value', () => {
    render(<ChangeRequestEvaluationCard data={evaluationData} method="average" />);

    expect(screen.getByText('3.3 h')).toBeInTheDocument();
  });

  it('renders the open days formatted value', () => {
    render(<ChangeRequestEvaluationCard data={evaluationData} method="average" />);

    expect(screen.getByText('2.3 days')).toBeInTheDocument();
  });

  it('renders the total change requests count', () => {
    render(<ChangeRequestEvaluationCard data={evaluationData} method="average" />);

    expect(screen.getByText('20')).toBeInTheDocument();
  });
});