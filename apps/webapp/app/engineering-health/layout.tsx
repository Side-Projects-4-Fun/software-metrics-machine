import AppProviders from '@/components/providers/AppProviders';
import AppShell from '@/components/layout/AppShell';
import { ENGINEERING_HEALTH_ACCENT_COLOR } from '@/lib/section-colors';
import { Suspense } from 'react';
import { loadAppProviderData } from '@/server/app-provider-data';
import PageLoading from '@/components/ui/PageLoading';

export const dynamic = 'force-dynamic';

export default async function EngineeringHealthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const providerData = await loadAppProviderData();

  return (
    <Suspense fallback={<PageLoading message="Loading engineering health..." />}>
      <AppProviders {...providerData} requireConfiguration>
        <AppShell
          showTabs={false}
          initialFiltersOpen={false}
          accentColor={ENGINEERING_HEALTH_ACCENT_COLOR}
        >
          {children}
        </AppShell>
      </AppProviders>
    </Suspense>
  );
}
