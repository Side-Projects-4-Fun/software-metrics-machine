import { notFound } from 'next/navigation';
import { fetchSavedFiltersDocument, resolveReport } from '../shared';
import type { SavedFilterEntry } from '@/components/filters/saved-filters-store';
import ReportDetailClient from '@/components/reports/ReportDetailClient';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ReportDetailPage({ params }: Props) {
  const { id } = await params;

  const doc = await fetchSavedFiltersDocument();
  const report = (doc.reports ?? []).find((r) => r.id === id);

  if (!report) {
    notFound();
  }

  const savedFiltersById = new Map<string, SavedFilterEntry>(
    doc.filters.map((f) => [f.id, f]),
  );

  const resolved = await resolveReport(report, savedFiltersById);

  return (
    <ReportDetailClient
      resolved={resolved}
      savedFiltersMap={savedFiltersById}
    />
  );
}
