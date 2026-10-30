'use client';

import { useState } from 'react';
import Link from 'next/link';
import TimelineScroller from './TimelineScroller';
import ReportRenderer from './ReportRenderer';
import type { SavedFilterEntry } from '@/components/filters/saved-filters-store';
import type { ResolvedReport } from '@/app/reports/shared';

interface ReportDetailClientProps {
  resolved: ResolvedReport;
  savedFiltersMap: Map<string, SavedFilterEntry>;
}

export default function ReportDetailClient({
  resolved,
  savedFiltersMap,
}: ReportDetailClientProps) {
  const [activeWindowIndex, setActiveWindowIndex] = useState(0);
  const hasMultipleWindows = resolved.windows.length > 1;
  const activeWindow = resolved.windows[activeWindowIndex] ?? resolved.windows[0];

  if (!activeWindow) {
    return null;
  }

  const effectiveStartDate =
    activeWindow.window?.startDate ?? resolved.report.startDateOverride ?? '';
  const effectiveEndDate =
    activeWindow.window?.endDate ?? resolved.report.endDateOverride ?? '';

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/reports"
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 no-underline hover:text-slate-900 hover:underline"
        >
          &larr; Back to Reports
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          {resolved.report.name}
        </h1>
      </div>
      {hasMultipleWindows && (
        <div className="sticky top-16 z-20 -mx-3 -mt-3 mb-4 bg-white/95 px-3 pb-3 pt-3 shadow-sm backdrop-blur">
          <TimelineScroller
            windows={resolved.windows.map((w) => w.window)}
            activeIndex={activeWindowIndex}
            onSelect={setActiveWindowIndex}
          />
        </div>
      )}
      <ReportRenderer
        report={resolved.report}
        savedFiltersMap={savedFiltersMap}
        evaluations={activeWindow.evaluations}
        errors={activeWindow.errors}
        effectiveStartDate={effectiveStartDate}
        effectiveEndDate={effectiveEndDate}
        windowLabel={
          hasMultipleWindows
            ? activeWindow.window?.label ??
              `${activeWindow.window?.startDate ?? ''} – ${activeWindow.window?.endDate ?? ''}`
            : undefined
        }
      />
    </div>
  );
}
