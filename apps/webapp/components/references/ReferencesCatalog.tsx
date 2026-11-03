'use client';

import { useState, type ReactNode } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import type { SxProps, Theme } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { OUTLIER_REFERENCE } from '@/lib/metrics/outlier-references';
import { formatMetricNotation } from '@/lib/metrics/metric-catalog';
import type {
  MetricCatalogEntry,
  MetricCatalogSource,
  MetricNamespace,
} from '@/lib/metrics/metric-catalog';

const NAMESPACE_LABELS: Record<MetricNamespace, string> = {
  cr: 'Change Requests',
  pl: 'Pipelines',
  code: 'Source Code',
  arch: 'Architecture',
  sq: 'SonarQube',
  issue: 'Issues',
  eh: 'Engineering Health',
};

const NAMESPACE_ORDER: MetricNamespace[] = ['pl', 'cr', 'code', 'sq', 'arch', 'issue', 'eh'];

type SummaryPanel = 'documented' | 'sources' | 'catalogued';

interface AggregatedSource {
  label: string;
  url: string;
  metricLabels: string[];
}

function hasReferences(entry: MetricCatalogEntry): boolean {
  return Boolean(entry.target) || (entry.sources?.length ?? 0) > 0;
}

function groupByNamespace(
  entries: MetricCatalogEntry[]
): Array<[MetricNamespace, MetricCatalogEntry[]]> {
  return NAMESPACE_ORDER.map((namespace) => [
    namespace,
    entries.filter((entry) => entry.definition.namespace === namespace),
  ]).filter(([, group]) => group.length > 0) as Array<[MetricNamespace, MetricCatalogEntry[]]>;
}

function aggregateSources(entries: MetricCatalogEntry[]): AggregatedSource[] {
  const byUrl = new Map<string, AggregatedSource>();

  entries.forEach((entry) => {
    (entry.sources ?? []).forEach((source) => {
      const existing = byUrl.get(source.url);
      if (existing) {
        if (!existing.metricLabels.includes(entry.definition.label)) {
          existing.metricLabels.push(entry.definition.label);
        }
        return;
      }
      byUrl.set(source.url, {
        label: source.label,
        url: source.url,
        metricLabels: [entry.definition.label],
      });
    });
  });

  return [...byUrl.values()].sort((left, right) => left.label.localeCompare(right.label));
}

function externalLinkSx(): SxProps<Theme> {
  return {
    fontSize: '0.875rem',
    color: 'primary.main',
    textDecoration: 'none',
    '&:hover': { textDecoration: 'underline' },
    lineHeight: 1.5,
  };
}

function SourceList({ sources }: { sources: readonly MetricCatalogSource[] }) {
  if (sources.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mt: 1.5 }}>
      <Typography
        variant="caption"
        sx={{
          fontWeight: 600,
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        Sources
      </Typography>
      <Box component="ul" sx={{ mt: 0.5, pl: 2, listStyleType: 'none' }}>
        {sources.map((source) => (
          <Box
            component="li"
            key={`${source.label}-${source.url}`}
            sx={{ mb: 0.75, '&:last-child': { mb: 0 } }}
          >
            <Link href={source.url} target="_blank" rel="noopener noreferrer" sx={externalLinkSx()}>
              {source.label}
            </Link>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function MetricReferenceCard({ entry }: { entry: MetricCatalogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const sources = entry.sources ?? [];
  const target = entry.target?.description;

  return (
    <Card
      id={`metric-${entry.id}`}
      variant="outlined"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'box-shadow 0.2s',
        // Keep anchored cards clear of the sticky dashboard tab bar.
        scrollMarginTop: { xs: 104, sm: 112 },
        '&:hover': {
          boxShadow: 2,
        },
        '&:target': {
          borderColor: 'primary.main',
          boxShadow: 3,
        },
      }}
    >
      <CardHeader
        title={
          sources.length > 0 ? (
            <Box
              component="button"
              onClick={() => setExpanded(!expanded)}
              sx={{
                background: 'none',
                border: 'none',
                p: 0,
                m: 0,
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                color: 'inherit',
                fontFamily: 'inherit',
                '&:hover': {
                  color: 'primary.main',
                },
              }}
              aria-label={expanded ? 'collapse sources' : 'expand sources'}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }}>
                {entry.definition.label}
              </Typography>
              {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </Box>
          ) : (
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {entry.definition.label}
            </Typography>
          )
        }
        subheader={
          <Box component="code" sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
            {entry.id}
          </Box>
        }
        sx={{ pb: 0 }}
      />
      <CardContent sx={{ flexGrow: 1, pt: 1 }}>
        {target ? (
          <Chip
            label={target}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ mb: 1, fontWeight: 500 }}
          />
        ) : null}
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
          {entry.definition.description}
        </Typography>
        <Box
          sx={{
            mt: 1.5,
            pt: 1.5,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              mb: 0.5,
              fontWeight: 600,
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            How it is computed
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
              Evidence:{' '}
            </Box>
            {entry.definition.computation.evidence}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6, mt: 0.5 }}>
            <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
              Formula:{' '}
            </Box>
            {entry.definition.computation.formula}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6, mt: 0.5 }}>
            <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
              Notation:{' '}
            </Box>
            <Box
              component="code"
              sx={{ display: 'block', fontSize: '0.8rem', whiteSpace: 'pre-line' }}
            >
              {formatMetricNotation(entry.definition.computation.notation)}
            </Box>
          </Typography>
        </Box>
        {sources.length > 0 && (
          <>
            <Collapse in={expanded} timeout="auto">
              <SourceList sources={sources} />
            </Collapse>
            <Box
              aria-hidden="true"
              sx={{
                display: 'none',
                '@media print': { display: 'block' },
              }}
            >
              <SourceList sources={sources} />
            </Box>
            {!expanded && (
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  mt: 1,
                  color: 'text.secondary',
                  fontStyle: 'italic',
                }}
              >
                {sources.length} source{sources.length !== 1 ? 's' : ''} available
              </Typography>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function NamespaceSection({
  namespace,
  entries,
}: {
  namespace: MetricNamespace;
  entries: MetricCatalogEntry[];
}) {
  return (
    <Box sx={{ mb: 4 }}>
      <Typography
        variant="h5"
        sx={{
          mb: 2,
          fontWeight: 600,
          color: 'text.primary',
          borderBottom: '2px solid',
          borderColor: 'primary.main',
          pb: 1,
        }}
      >
        {NAMESPACE_LABELS[namespace]}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: 'repeat(2, 1fr)',
            lg: 'repeat(3, 1fr)',
          },
          gap: 2,
        }}
      >
        {entries.map((entry) => (
          <MetricReferenceCard key={entry.id} entry={entry} />
        ))}
      </Box>
    </Box>
  );
}

function MetricIndexList({
  groups,
  showStatus,
}: {
  groups: Array<[MetricNamespace, MetricCatalogEntry[]]>;
  showStatus: boolean;
}) {
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}>
      {groups.map(([namespace, entries]) => (
        <Box key={namespace}>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              mb: 0.5,
              fontWeight: 700,
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {NAMESPACE_LABELS[namespace]}
          </Typography>
          <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
            {entries.map((entry) => {
              const documented = hasReferences(entry);
              return (
                <Box
                  component="li"
                  key={entry.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'baseline',
                    flexWrap: 'wrap',
                    gap: 1,
                    py: 0.25,
                  }}
                >
                  {documented ? (
                    <Link href={`#metric-${entry.id}`} sx={{ fontSize: '0.875rem' }}>
                      {entry.definition.label}
                    </Link>
                  ) : (
                    <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                      {entry.definition.label}
                    </Typography>
                  )}
                  <Box component="code" sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                    {entry.id}
                  </Box>
                  {showStatus ? (
                    <Chip
                      size="small"
                      variant="outlined"
                      color={documented ? 'primary' : 'default'}
                      label={documented ? 'documented' : 'no source'}
                      sx={{ height: 20, fontSize: '0.65rem' }}
                    />
                  ) : null}
                </Box>
              );
            })}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function SummaryPanelBox({
  id,
  testId,
  title,
  description,
  children,
}: {
  id: string;
  testId: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Box
      id={id}
      data-testid={testId}
      role="region"
      aria-label={title}
      sx={{
        mb: 3,
        p: 2,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'background.paper',
      }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        {description}
      </Typography>
      {children}
    </Box>
  );
}

function OutlierImplementationDetails() {
  return (
    <Box
      sx={{
        mb: 4,
        p: 2,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'background.paper',
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
        How Outliers Work In SMM
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.7 }}>
        The outliers panel is generated from outlier arrays returned by backend metric endpoints.
        Each outlier row uses the same schema: timestamp, value, lowerBound, upperBound, and item
        metadata used to label and link the event.
      </Typography>

      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
        Pipeline Data Used
      </Typography>
      <Box component="ul" sx={{ m: 0, mb: 2, pl: 2.5 }}>
        <Box component="li" sx={{ mb: 0.75 }}>
          <Typography variant="body2">Run duration per workflow (runsDuration outliers)</Typography>
        </Box>
        <Box component="li" sx={{ mb: 0.75 }}>
          <Typography variant="body2">Job time per job (jobsTime outliers)</Typography>
        </Box>
        <Box component="li" sx={{ mb: 0.75 }}>
          <Typography variant="body2">Job time by day (jobsTimeByDay outliers)</Typography>
        </Box>
        <Box component="li" sx={{ mb: 0.75 }}>
          <Typography variant="body2">
            Job summary duration aggregates (jobsSummary outliers)
          </Typography>
        </Box>
        <Box component="li" sx={{ mb: 0.75 }}>
          <Typography variant="body2">Step time (jobStepsTime outliers)</Typography>
        </Box>
        <Box component="li" sx={{ mb: 0 }}>
          <Typography variant="body2">
            Step time by day and step (jobStepsTimeByDay step outliers)
          </Typography>
        </Box>
      </Box>

      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
        Change Request Data Used
      </Typography>
      <Box component="ul" sx={{ m: 0, mb: 2, pl: 2.5 }}>
        <Box component="li" sx={{ mb: 0.75 }}>
          <Typography variant="body2">Review time per author (reviewTime outliers)</Typography>
        </Box>
        <Box component="li" sx={{ mb: 0.75 }}>
          <Typography variant="body2">Open days per period (openTime outliers)</Typography>
        </Box>
        <Box component="li" sx={{ mb: 0.75 }}>
          <Typography variant="body2">
            Comments per change request (commentsData outliers)
          </Typography>
        </Box>
        <Box component="li" sx={{ mb: 0 }}>
          <Typography variant="body2">
            Time to first comment per author (firstCommentTime outliers)
          </Typography>
        </Box>
      </Box>

      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
        Detection And Rendering Flow
      </Typography>
      <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
        <Box component="li" sx={{ mb: 0.75 }}>
          <Typography variant="body2">
            The backend computes outliers per metric distribution using IQR bounds.
          </Typography>
        </Box>
        <Box component="li" sx={{ mb: 0.75 }}>
          <Typography variant="body2">
            Dashboard pages collect outliers from each metric response and convert them with
            toOutlierRows.
          </Typography>
        </Box>
        <Box component="li" sx={{ mb: 0.75 }}>
          <Typography variant="body2">
            Rows are labeled with metric context such as workflow, job, step, period, or author.
          </Typography>
        </Box>
        <Box component="li" sx={{ mb: 0 }}>
          <Typography variant="body2">
            The Flagged Outliers card shows value, IQR bounds, timestamp, and item link to support
            root-cause analysis.
          </Typography>
        </Box>
      </Box>

      <Box sx={{ mt: 2 }}>
        <SourceList sources={OUTLIER_REFERENCE.sources} />
      </Box>
    </Box>
  );
}

function SummaryChip({
  label,
  panel,
  activePanel,
  controls,
  color,
  variant,
  onToggle,
}: {
  label: string;
  panel: SummaryPanel;
  activePanel: SummaryPanel | null;
  controls: string;
  color: 'primary' | 'secondary' | 'default';
  variant: 'filled' | 'outlined';
  onToggle: (panel: SummaryPanel) => void;
}) {
  const expanded = activePanel === panel;

  return (
    <Chip
      label={label}
      color={color}
      variant={variant}
      onClick={() => onToggle(panel)}
      component="button"
      type="button"
      aria-expanded={expanded}
      aria-controls={controls}
      icon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
      sx={{ fontWeight: 500 }}
    />
  );
}

export default function ReferencesCatalog({
  entries,
  error,
}: {
  entries: MetricCatalogEntry[];
  error: string | null;
}) {
  const [activePanel, setActivePanel] = useState<SummaryPanel | null>(null);

  const documented = entries.filter(hasReferences);
  const groups = groupByNamespace(documented);
  const allGroups = groupByNamespace(entries);
  const totalSources = documented.reduce((total, entry) => total + (entry.sources?.length ?? 0), 0);
  const aggregatedSources = aggregateSources(documented);

  const togglePanel = (panel: SummaryPanel) => {
    setActivePanel((current) => (current === panel ? null : panel));
  };

  return (
    <div className="space-y-6">
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          References &amp; Sources
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.6 }}>
          Academic papers, industry reports and books behind every catalogued metric target. Each
          metric id is owned by the core metric catalog; this page reads that catalog from the REST
          API, so it stays in sync with the CLI, the MCP server and the dashboard.
        </Typography>
        {error ? (
          <Typography variant="body2" color="error" sx={{ mt: 2 }}>
            {error}
          </Typography>
        ) : null}
        <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <SummaryChip
            label={`${documented.length} documented metrics`}
            panel="documented"
            activePanel={activePanel}
            controls="references-documented-panel"
            color="primary"
            variant="filled"
            onToggle={togglePanel}
          />
          <SummaryChip
            label={`${totalSources} sources`}
            panel="sources"
            activePanel={activePanel}
            controls="references-sources-panel"
            color="secondary"
            variant="filled"
            onToggle={togglePanel}
          />
          <SummaryChip
            label={`${entries.length} catalogued metrics`}
            panel="catalogued"
            activePanel={activePanel}
            controls="references-catalogued-panel"
            color="default"
            variant="outlined"
            onToggle={togglePanel}
          />
        </Box>

        <Collapse in={activePanel === 'documented'} timeout="auto" unmountOnExit>
          <Box sx={{ mt: 2 }}>
            <SummaryPanelBox
              id="references-documented-panel"
              testId="references-documented-panel"
              title="Documented metrics"
              description={`${documented.length} metric${documented.length === 1 ? '' : 's'} with at least one published source or target. Select one to jump to its card.`}
            >
              <MetricIndexList groups={groups} showStatus={false} />
            </SummaryPanelBox>
          </Box>
        </Collapse>

        <Collapse in={activePanel === 'sources'} timeout="auto" unmountOnExit>
          <Box sx={{ mt: 2 }}>
            <SummaryPanelBox
              id="references-sources-panel"
              testId="references-sources-panel"
              title="Sources"
              description={`${totalSources} citation${totalSources === 1 ? '' : 's'} across ${aggregatedSources.length} unique source${aggregatedSources.length === 1 ? '' : 's'}, with the metrics that reference each one.`}
            >
              <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
                {aggregatedSources.map((source) => (
                  <Box component="li" key={source.url} sx={{ mb: 1.25, '&:last-child': { mb: 0 } }}>
                    <Link
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={externalLinkSx()}
                    >
                      {source.label}
                    </Link>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Cited by {source.metricLabels.join(', ')}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </SummaryPanelBox>
          </Box>
        </Collapse>

        <Collapse in={activePanel === 'catalogued'} timeout="auto" unmountOnExit>
          <Box sx={{ mt: 2 }}>
            <SummaryPanelBox
              id="references-catalogued-panel"
              testId="references-catalogued-panel"
              title="Catalogued metrics"
              description={`All ${entries.length} metrics known to the core catalog. Metrics marked "no source" do not have a published reference yet.`}
            >
              <MetricIndexList groups={allGroups} showStatus />
            </SummaryPanelBox>
          </Box>
        </Collapse>
      </Box>

      <OutlierImplementationDetails />

      {groups.map(([namespace, group]) => (
        <NamespaceSection key={namespace} namespace={namespace} entries={group} />
      ))}

      {documented.length === 0 && !error ? (
        <Typography variant="body2" color="text.secondary">
          No catalogued metric carries a published reference yet.
        </Typography>
      ) : null}
    </div>
  );
}
