'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import { Tab, Tabs } from '@mui/material';

const dashboardTabs = [
  { value: 'insights', label: 'Insights', href: '/dashboard/insights/' },
  { value: 'pipelines', label: 'Pipelines', href: '/dashboard/pipelines/' },
  { value: 'pull-requests', label: 'Pull Requests', href: '/dashboard/pull-requests/' },
  { value: 'source-code', label: 'Source Code', href: '/dashboard/source-code/' },
  { value: 'engineering-health', label: 'Engineering Health', href: '/dashboard/engineering-health/' },
  { value: 'architecture', label: 'Architecture', href: '/dashboard/architecture/' },
  { value: 'sonarqube', label: 'SonarQube', href: '/dashboard/sonarqube/' },
];

function getActiveTab(pathname: string): string {
  const tab = dashboardTabs.find((item) => item.href === pathname);
  return tab ? tab.value : 'insights';
}

export default function DashboardTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = getActiveTab(pathname);
  const queryString = searchParams.toString();

  return (
    <Box sx={{ width: '100%', mb: 3 }}>
      <Tabs
        value={activeTab}
        textColor="secondary"
        indicatorColor="secondary"
        aria-label="dashboard tabs"
      >
        {dashboardTabs.map((tab) => (
          <Tab
            key={tab.value}
            component={Link}
            href={queryString ? `${tab.href}?${queryString}` : tab.href}
            value={tab.value}
            label={tab.label}
            scroll={false}
          />
        ))}
      </Tabs>
    </Box>
  );
}