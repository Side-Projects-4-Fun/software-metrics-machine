import { screen } from '@testing-library/react';
import ReportsFrame from '@/app/reports/reports-frame';
import { renderWithProviders } from '../utils/test-providers';

jest.mock('@/components/ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">Theme Toggle</div>,
}));

const mockUsePathname = jest.requireMock('next/navigation').usePathname as jest.Mock;

describe('ReportsFrame', () => {

  it('shows "Home" link when on reports list page', () => {
    mockUsePathname.mockReturnValue('/reports');

    renderWithProviders(
      <ReportsFrame>
        <div>Test Content</div>
      </ReportsFrame>,
    );

    const homeLink = screen.getByRole('link', { name: /← Home/i });
    expect(homeLink).toBeVisible();
    expect(homeLink).toHaveAttribute('href', '/');
  });

  it('shows "Back to Reports" link when on report detail page', () => {
    mockUsePathname.mockReturnValue('/reports/abc123');

    renderWithProviders(
      <ReportsFrame>
        <div>Test Content</div>
      </ReportsFrame>,
    );

    const backLink = screen.getByRole('link', { name: /← Back to Reports/i });
    expect(backLink).toBeVisible();
    expect(backLink).toHaveAttribute('href', '/reports');
  });

  it('shows "Back to Reports" link for any report detail path', () => {
    mockUsePathname.mockReturnValue('/reports/some-report-id');

    renderWithProviders(
      <ReportsFrame>
        <div>Test Content</div>
      </ReportsFrame>,
    );

    const backLink = screen.getByRole('link', { name: /← Back to Reports/i });
    expect(backLink).toBeVisible();
    expect(backLink).toHaveAttribute('href', '/reports');
  });

  it('renders children content', () => {
    mockUsePathname.mockReturnValue('/reports');

    renderWithProviders(
      <ReportsFrame>
        <div data-testid="child-content">Child Content</div>
      </ReportsFrame>,
    );

    expect(screen.getByTestId('child-content')).toBeVisible();
  });

  it('renders the app title link', () => {
    mockUsePathname.mockReturnValue('/reports');

    renderWithProviders(
      <ReportsFrame>
        <div>Test Content</div>
      </ReportsFrame>,
    );

    const titleLink = screen.getByRole('link', { name: /Software Metrics Machine/i });
    expect(titleLink).toBeVisible();
    expect(titleLink).toHaveAttribute('href', '/');
  });
});
