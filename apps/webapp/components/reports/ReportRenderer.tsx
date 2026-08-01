'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Typography, Chip, Box, Button, IconButton } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PipelineEvaluationCard from '@/components/charts/pipeline/PipelineEvaluationCard';
import PREvaluationCard from '@/components/charts/pull-requests/PREvaluationCard';
import CodeEvaluationCard from '@/components/charts/source-code/CodeEvaluationCard';
import ArchitectureEvaluationCard from '@/components/charts/architecture/ArchitectureEvaluationCard';
import SonarqubeEvaluationCard from '@/components/charts/sonarqube/SonarqubeEvaluationCard';
import type { SavedFilterEntry } from '@/components/filters/saved-filters-store';
import type { ReportEntry, EvaluatableSection } from './reports-store';
import { EVALUATABLE_SECTION_LABELS } from './reports-store';

interface ReportRendererProps {
  report: ReportEntry;
  savedFiltersMap: Map<string, SavedFilterEntry>;
  evaluations: Partial<Record<EvaluatableSection, unknown>>;
  errors: Partial<Record<EvaluatableSection, string>>;
  windowLabel?: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function renderEvaluationCard(section: EvaluatableSection, data: unknown) {
  switch (section) {
    case 'pipelines':
      return <PipelineEvaluationCard data={data as Parameters<typeof PipelineEvaluationCard>[0]['data']} />;
    case 'pull-requests':
      return <PREvaluationCard data={data as Parameters<typeof PREvaluationCard>[0]['data']} />;
    case 'source-code':
      return <CodeEvaluationCard data={data as Parameters<typeof CodeEvaluationCard>[0]['data']} />;
    case 'architecture':
      return <ArchitectureEvaluationCard data={data as Parameters<typeof ArchitectureEvaluationCard>[0]['data']} />;
    case 'sonarqube':
      return <SonarqubeEvaluationCard data={data as Parameters<typeof SonarqubeEvaluationCard>[0]['data']} />;
    default:
      return null;
  }
}

export default function ReportRenderer({
  report,
  savedFiltersMap,
  evaluations,
  errors,
  windowLabel,
}: ReportRendererProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(),
  );
  const allCollapsed = report.sections.length > 0 && report.sections.every((s) => collapsedSections.has(s.section));

  const toggleSection = useCallback((section: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (allCollapsed) {
      setCollapsedSections(new Set());
    } else {
      setCollapsedSections(new Set(report.sections.map((s) => s.section)));
    }
  }, [allCollapsed, report.sections]);

  const resolvedSections = report.sections.map((ref) => {
    const saved = savedFiltersMap.get(ref.savedFilterId);
    return {
      ref,
      saved,
      missing: !saved,
    };
  });

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{report.name}</CardTitle>
          {report.sections.length > 0 && (
            <Button
              size="small"
              variant="text"
              onClick={toggleAll}
              sx={{ textTransform: 'none' }}
            >
              {allCollapsed ? 'Expand All' : 'Collapse All'}
            </Button>
          )}
        </div>
        <Typography variant="caption" color="text.secondary" className="block mt-1 ml-1">
          Created {formatDate(report.createdAt)}
          {windowLabel && ` — ${windowLabel}`}
        </Typography>
        <div className="flex flex-wrap gap-2 mt-2">
          {resolvedSections.map(({ ref, saved, missing }) => (
            <Chip
              key={ref.section + ref.savedFilterId}
              label={
                missing
                  ? `${EVALUATABLE_SECTION_LABELS[ref.section]}: missing`
                  : `${EVALUATABLE_SECTION_LABELS[ref.section]}: ${saved!.name}`
              }
              size="small"
              color={missing ? 'warning' : 'primary'}
              variant="outlined"
            />
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {report.sections.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No sections selected in this report.
          </Typography>
        )}
        <div className="space-y-6">
          {report.sections.map((ref) => {
            const data = evaluations[ref.section];
            const error = errors[ref.section];
            const saved = savedFiltersMap.get(ref.savedFilterId);
            const isCollapsed = collapsedSections.has(ref.section);

            return (
              <Box key={ref.section}>
                <Box
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleSection(ref.section)}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleSection(ref.section);
                    }
                  }}
                  aria-label={`${EVALUATABLE_SECTION_LABELS[ref.section]}${saved ? ` — ${saved.name}` : ''}`}
                  aria-expanded={!isCollapsed}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    mb: 1,
                    p: 0,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left',
                    color: 'text.primary',
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 600, flex: 1 }}
                  >
                    {EVALUATABLE_SECTION_LABELS[ref.section]}
                    {saved && ` — ${saved.name}`}
                  </Typography>
                  <IconButton size="small" tabIndex={-1} aria-hidden>
                    {isCollapsed ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
                  </IconButton>
                </Box>
                {error && (
                  <Typography variant="body2" color="error" sx={{ mb: 1 }}>
                    {error}
                  </Typography>
                )}
                {!saved && (
                  <Typography variant="body2" color="warning.main" sx={{ mb: 1 }}>
                    Referenced saved filter has been deleted.
                  </Typography>
                )}
                {!isCollapsed && (
                  <>
                    {data ? (
                      renderEvaluationCard(ref.section, data)
                    ) : !error ? (
                      <Typography variant="body2" color="text.secondary">
                        No evaluation data available.
                      </Typography>
                    ) : null}
                  </>
                )}
              </Box>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
