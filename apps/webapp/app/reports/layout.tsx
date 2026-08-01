import AppProviders from '@/components/providers/AppProviders';
import { Suspense } from 'react';
import { loadAppProviderData } from '@/server/app-provider-data';
import ReportsFrame from './reports-frame';

export const dynamic = 'force-dynamic';

export default async function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const providerData = await loadAppProviderData();

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AppProviders {...providerData} requireConfiguration>
        <ReportsFrame>{children}</ReportsFrame>
      </AppProviders>
    </Suspense>
  );
}
