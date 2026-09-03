import React from 'react';
import { screen } from '@testing-library/react';
import ReportsPage from '@/app/reports/page';
import { renderWithProviders } from '../utils/test-providers';

jest.mock('@/app/reports/shared', () => ({
  fetchSavedFiltersDocument: jest.fn(),
  resolveReports: jest.fn(),
}));

import { fetchSavedFiltersDocument, resolveReports } from '@/app/reports/shared';

const mockFetchDoc = fetchSavedFiltersDocument as jest.MockedFunction<typeof fetchSavedFiltersDocument>;
const mockResolveReports = resolveReports as jest.MockedFunction<typeof resolveReports>;

describe('Reports Page - User Journey', () => {
  it('renders reports list with create button when reports exist', async () => {
    mockFetchDoc.mockResolvedValue({
      version: 1,
      filters: [],
      reports: [
        {
          id: 'r1',
          name: 'Sprint Review',
          repository: 'owner/repo',
          sections: [],
          createdAt: '2026-01-01T00:00:00Z',
        },
      ],
    });
    mockResolveReports.mockResolvedValue([
      {
        report: {
          id: 'r1',
          name: 'Sprint Review',
          repository: 'owner/repo',
          sections: [],
          createdAt: '2026-01-01T00:00:00Z',
        },
        windows: [],
      },
    ]);

    const ui = await ReportsPage();
    renderWithProviders(ui);

    expect(screen.getByText('Sprint Review')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Report/ })).toBeInTheDocument();
  });

  it('shows empty state when no reports exist', async () => {
    mockFetchDoc.mockResolvedValue({ version: 1, filters: [], reports: [] });
    mockResolveReports.mockResolvedValue([]);

    const ui = await ReportsPage();
    renderWithProviders(ui);

    expect(screen.getByRole('button', { name: /New Report/ })).toBeInTheDocument();
  });
});
