import { screen } from '@testing-library/react';
import PageLoading from '@/components/ui/PageLoading';
import { renderWithProviders } from '../utils/test-providers';

describe('PageLoading', () => {
  it('renders with default message', () => {
    renderWithProviders(<PageLoading />);

    expect(screen.getByText('Loading...')).toBeVisible();
    expect(screen.getByRole('progressbar')).toBeVisible();
  });

  it('renders with custom message', () => {
    renderWithProviders(<PageLoading message="Loading reports..." />);

    expect(screen.getByText('Loading reports...')).toBeVisible();
    expect(screen.getByRole('progressbar')).toBeVisible();
  });

  it('renders with another custom message', () => {
    renderWithProviders(<PageLoading message="Loading dashboard..." />);

    expect(screen.getByText('Loading dashboard...')).toBeVisible();
    expect(screen.getByRole('progressbar')).toBeVisible();
  });

  it('centers the loading indicator', () => {
    const { container } = renderWithProviders(<PageLoading />);

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveStyle({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
    });
  });
});
