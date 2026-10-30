import AppProviders from '@/components/providers/AppProviders';
import AppShell from '@/components/layout/AppShell';
import { REPORTS_ACCENT_COLOR } from '@/lib/section-colors';
import { Suspense } from 'react';
import { loadAppProviderData } from '@/server/app-provider-data';
import PageLoading from '@/components/ui/PageLoading';

export const dynamic = 'force-dynamic';

export default async function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const providerData = await loadAppProviderData();

  return (
    <Suspense fallback={<PageLoading message="Loading reports..." />}>
      <AppProviders {...providerData} requireConfiguration>
        <AppShell showTabs={false} showFilters={false} accentColor={REPORTS_ACCENT_COLOR}>
          {children}
        </AppShell>
      </AppProviders>
    </Suspense>
  );
}
