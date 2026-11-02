import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('keeps the dashboard tabs visible while scrolling', () => {
    renderWithProviders(
      <AppShell>
        <div>Shell content</div>
      </AppShell>,
    );

    expect(screen.getByTestId('dashboard-tabs-bar')).toHaveStyle({
      position: 'sticky',
    });
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
    expect(screen.queryByTestId('open-filters-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('filters-drawer')).not.toBeInTheDocument();
  });

  it('does not let the closed filters drawer intercept clicks on the content', async () => {
    renderWithProviders(
      <AppShell>
        <div>Shell content</div>
      </AppShell>,
    );
    const filtersDrawer = screen.getByTestId('filters-drawer');

    expect(filtersDrawer).toHaveStyle({ pointerEvents: 'auto' });

    await userEvent.click(screen.getByTestId('close-filters-panel'));

    expect(filtersDrawer).toHaveStyle({ pointerEvents: 'none' });

    await userEvent.click(screen.getByTestId('open-filters-panel'));

    expect(filtersDrawer).toHaveStyle({ pointerEvents: 'auto' });
  });

  it('does not let the closed projects drawer intercept clicks on the content', async () => {
    renderWithProviders(
      <AppShell>
        <div>Shell content</div>
      </AppShell>,
    );
    const projectsDrawer = screen.getByTestId('projects-drawer');

    expect(projectsDrawer).toHaveStyle({ pointerEvents: 'none' });

    await userEvent.click(screen.getByTestId('open-projects-panel'));

    expect(projectsDrawer).toHaveStyle({ pointerEvents: 'auto' });

    await userEvent.click(screen.getByTestId('close-projects-panel'));

    expect(projectsDrawer).toHaveStyle({ pointerEvents: 'none' });
  });

  it('does not reserve filters drawer space when showFilters is false', () => {
    renderWithProviders(
      <AppShell showFilters={false}>
        <div>Shell content</div>
      </AppShell>,
    );

    expect(screen.getByTestId('dashboard-content')).toHaveStyle({ marginRight: '0px' });
  });
});
