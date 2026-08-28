'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Typography, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ReportCreator from './ReportCreator';
import {
  saveReport,
  updateReport,
  removeReport,
  duplicateReport,
} from '@/components/filters/saved-filters-actions';
import type { ReportSectionRef, ReportDateWindow, ReportEntry } from './reports-store';
import type { ResolvedReport } from '@/app/reports/shared';

interface ReportsClientProps {
  resolvedReports: ResolvedReport[];
  repository: string;
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function ReportsClient({
  resolvedReports,
  repository,
}: ReportsClientProps) {
  const router = useRouter();
  const [isCreatorOpen, setCreatorOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<ReportEntry | undefined>(
    undefined,
  );

  const handleCreate = useCallback(
    async (
      name: string,
      sections: ReportSectionRef[],
      startDateOverride?: string,
      endDateOverride?: string,
      dateWindows?: ReportDateWindow[],
    ) => {
      await saveReport(name, sections, repository, startDateOverride, endDateOverride, dateWindows);
      router.refresh();
    },
    [repository, router],
  );

  const handleUpdate = useCallback(
    async (
      name: string,
      sections: ReportSectionRef[],
      startDateOverride?: string,
      endDateOverride?: string,
      dateWindows?: ReportDateWindow[],
    ) => {
      if (!editingReport) { return; }
      await updateReport(
        editingReport.id,
        name,
        sections,
        repository,
        startDateOverride,
        endDateOverride,
        dateWindows,
      );
      router.refresh();
    },
    [editingReport, repository, router],
  );

  const handleCloseCreator = useCallback(() => {
    setCreatorOpen(false);
    setEditingReport(undefined);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!window.confirm('Delete this report?')) { return; }
      await removeReport(id);
      router.refresh();
    },
    [router],
  );

  const handleDuplicate = useCallback(
    async (id: string) => {
      await duplicateReport(id);
      router.refresh();
    },
    [router],
  );

  const sectionCount = (resolved: ResolvedReport): number =>
    resolved.report.sections?.length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
          Reports
        </Typography>
        <Button variant="contained" onClick={() => setCreatorOpen(true)}>
          New Report
        </Button>
      </div>

        <div className="mt-5 mb-5">
            <Typography variant="body2" color="text.secondary">
                Compose a report by selecting one saved filter per section. The report stacks
                evaluation cards from Pipelines, Change Requests, Source Code, Architecture, and
                SonarQube.
            </Typography>
        </div>

      {resolvedReports.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
          <Typography variant="body1" color="text.secondary">
            No reports yet. Click &quot;New Report&quot; to compose your
            first one.
          </Typography>
        </div>
      )}

      <div className="space-y-3">
        {resolvedReports.map((resolved) => (
          <div
            key={resolved.report.id}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50/30"
          >
            <div className="min-w-0 flex-1">
              <Link
                href={`/reports/${resolved.report.id}`}
                className="text-lg font-semibold text-slate-900 no-underline hover:text-blue-700"
              >
                {resolved.report.name}
              </Link>
              <div className="mt-1 flex items-center gap-3 text-sm text-slate-500">
                <span>{sectionCount(resolved)} section{sectionCount(resolved) !== 1 ? 's' : ''}</span>
                <span>&middot;</span>
                <span>Created {formatDate(resolved.report.createdAt)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <IconButton
                size="small"
                color="primary"
                onClick={() => handleDuplicate(resolved.report.id)}
                aria-label={`Duplicate ${resolved.report.name}`}
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                color="primary"
                onClick={() => {
                  setEditingReport(resolved.report);
                  setCreatorOpen(true);
                }}
                aria-label={`Edit ${resolved.report.name}`}
              >
                <EditIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                color="error"
                onClick={() => handleDelete(resolved.report.id)}
                aria-label={`Delete ${resolved.report.name}`}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
              <Link
                href={`/reports/${resolved.report.id}`}
                className="smm-print-hide flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50"
              >
                View
                <ArrowForwardIcon fontSize="small" />
              </Link>
            </div>
          </div>
        ))}
      </div>

      <ReportCreator
        key={isCreatorOpen ? `report-${editingReport?.id ?? 'new'}` : 'report-closed'}
        open={isCreatorOpen}
        repository={repository}
        onClose={handleCloseCreator}
        onSave={editingReport ? handleUpdate : handleCreate}
        existingReport={editingReport}
      />
    </div>
  );
}
