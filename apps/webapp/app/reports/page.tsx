import { cookies } from 'next/headers';
import { fetchSavedFiltersDocument, resolveReports } from './shared';
import ReportsClient from '@/components/reports/ReportsClient';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const cookieStore = await cookies();
  const repository = cookieStore.get('smm_active_project')?.value
    ? decodeURIComponent(cookieStore.get('smm_active_project')!.value)
    : '';

  const doc = await fetchSavedFiltersDocument();
  const reports = doc.reports ?? [];

  const repositoryReports = reports.filter(
    (r) => !repository || r.repository === repository,
  );

  const resolvedReports = await resolveReports(repositoryReports, doc.filters);

  return (
    <ReportsClient
      resolvedReports={resolvedReports}
      repository={repository}
    />
  );
}
