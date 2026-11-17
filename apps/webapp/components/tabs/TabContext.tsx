'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import { Tab, Tabs } from '@mui/material';
import { useTheme } from '@mui/material/styles';

const dashboardTabs = [
  { value: 'insights', label: 'Insights', href: '/dashboard/insights/' },
  { value: 'pipelines', label: 'Pipelines', href: '/dashboard/pipelines/' },
  { value: 'change-requests', label: 'Change Requests', href: '/dashboard/change-requests/' },
  { value: 'source-code', label: 'Source Code', href: '/dashboard/source-code/' },
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
  const theme = useTheme();
  const activeTab = getActiveTab(pathname);
  const queryString = searchParams.toString();

  return (
    <Box
      data-testid="dashboard-tabs-bar"
      sx={{
        position: 'sticky',

        top: { xs: 56, sm: 64 },

        zIndex: theme.zIndex.appBar - 1,
        bgcolor: 'background.default',
        borderBottom: 1,
        borderColor: 'divider',

        mx: -3,
        px: 3,
        width: 'auto',
        mb: 3,

        '@media print': {
          position: 'static',
          borderBottom: 0,
          mb: 0,
        },
      }}
    >
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
