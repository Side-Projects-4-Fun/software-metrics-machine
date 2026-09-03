import {screen, waitFor} from "@testing-library/react";
import DashboardLayout from "@/app/dashboard/layout";
import React from "react";
import { renderWithProviders } from './utils/test-providers';

jest.mock('@smmachine/core', () => ({
  Configuration: jest.fn().mockImplementation(() => ({
    githubRepository: 'owner/repo',
    getCodeMaatPath: jest.fn(),
    getPathFromGitProvider: jest.fn(),
    getSonarqubePath: jest.fn(),
    getGitPath: jest.fn(),
  })),
}));

jest.mock('@/server/api', () => ({
  configurationAPI: {
    getConfiguration: jest.fn().mockResolvedValue({ result: { git_provider: 'github', github_repository: 'owner/repo' } }),
  },
  projectsAPI: {
    getProjects: jest.fn().mockResolvedValue({ result: [{ github_repository: 'owner/repo' }] }),
  },
}));

jest.mock('@/app/theme-context', () => ({
  ThemeContextProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useTheme: jest.fn(() => ({ mode: 'light', toggleTheme: jest.fn() })),
}));
const MockChild = () => <div>Insights</div>;

describe('Dashboard', () => {
  it('should render dashboard tabs', async () => {
    const layout = await DashboardLayout({ children: <MockChild /> });
    renderWithProviders(layout);

    await waitFor(() => {
      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toBeGreaterThan(0);
    });

    const insightsTab = screen.getByRole('tab', { name: /Insights/i });
    const pipelinesTab = screen.getByRole('tab', { name: /Pipelines/i });
    const prTab = screen.getByRole('tab', { name: /Change Requests/i });
    const sourceCodeTab = screen.getByRole('tab', { name: /Source Code/i });

    expect(insightsTab).toBeInTheDocument();
    expect(pipelinesTab).toBeInTheDocument();
    expect(prTab).toBeInTheDocument();
    expect(sourceCodeTab).toBeInTheDocument();
  });

  it('should render child content', async () => {
    const layout = await DashboardLayout({ children: <MockChild /> });
    renderWithProviders(layout);

    await waitFor(() => {
      const insightsTab = screen.getByRole('tab', { name: /Insights/i });
      expect(insightsTab).toBeInTheDocument();
    });
  });
});
