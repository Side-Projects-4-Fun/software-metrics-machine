import AppProviders from '@/components/providers/AppProviders';
import { Suspense } from 'react';
import { loadAppProviderData } from '@/server/app-provider-data';
import EngineeringHealthFrame from './engineering-health-frame';
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
        <EngineeringHealthFrame>{children}</EngineeringHealthFrame>
      </AppProviders>
    </Suspense>
  );
}
