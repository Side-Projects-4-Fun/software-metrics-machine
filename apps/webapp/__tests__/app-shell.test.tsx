import { screen } from '@testing-library/react';
import AppShell from '@/components/layout/AppShell';
import { renderWithProviders } from './utils/test-providers';

jest.mock('@/app/theme-context', () => ({
  ThemeContextProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useTheme: jest.fn(() => ({ theme: 'light', toggleTheme: jest.fn() })),
}));

jest.mock('@/components/filters/FiltersContainer', () => ({
  __esModule: true,
  default: () => <div>Filters container</div>,
}));

describe('AppShell', () => {
  it('applies the accent color to the app bar', () => {
    renderWithProviders(
      <AppShell accentColor="#059669">
        <div>Shell content</div>
      </AppShell>,
    );

    expect(screen.getByRole('banner')).toHaveStyle({ backgroundColor: '#059669' });
  });

  it('shows the selected project in the top bar', () => {
    renderWithProviders(
      <AppShell>
        <div>Shell content</div>
      </AppShell>,
      { initialActiveProject: 'acme/backend' },
    );

    expect(screen.getByText('Software Metrics Machine')).toBeInTheDocument();
    expect(screen.getByText(/acme\/backend/)).toBeInTheDocument();
  });

  it('renders the dashboard tabs by default', () => {
    renderWithProviders(
      <AppShell>
        <div>Shell content</div>
      </AppShell>,
    );

    expect(screen.getByRole('tab', { name: 'Insights' })).toBeInTheDocument();
  });

  it('hides the dashboard tabs when showTabs is false', () => {
    renderWithProviders(
      <AppShell showTabs={false}>
        <div>Shell content</div>
      </AppShell>,
    );

    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.getByText('Shell content')).toBeInTheDocument();
  });

  it('renders the filters drawer by default', () => {
    renderWithProviders(
      <AppShell>
        <div>Shell content</div>
      </AppShell>,
    );

    expect(screen.getByText('Filters container')).toBeInTheDocument();
  });

  it('hides the filters drawer when showFilters is false', () => {
    renderWithProviders(
      <AppShell showFilters={false}>
        <div>Shell content</div>
      </AppShell>,
    );

    expect(screen.queryByText('Filters container')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'open drawer' })).not.toBeInTheDocument();
  });

  it('does not reserve filters drawer space when showFilters is false', () => {
    renderWithProviders(
      <AppShell showFilters={false}>
        <div>Shell content</div>
      </AppShell>,
    );

    expect(screen.getByRole('main')).toHaveStyle({ marginRight: '0px' });
  });
});
