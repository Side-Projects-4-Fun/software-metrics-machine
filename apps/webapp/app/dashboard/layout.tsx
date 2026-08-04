import AppProviders from '@/components/providers/AppProviders';
import DashboardFrame from './dashboard-frame';
import { Suspense } from 'react';
import { loadAppProviderData } from '@/server/app-provider-data';
import PageLoading from '@/components/ui/PageLoading';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const providerData = await loadAppProviderData();

  return (
    <Suspense fallback={<PageLoading message="Loading dashboard..." />}>
      <AppProviders {...providerData} requireConfiguration>
        <DashboardFrame>
          {children}
        </DashboardFrame>
      </AppProviders>
    </Suspense>
  );
}
