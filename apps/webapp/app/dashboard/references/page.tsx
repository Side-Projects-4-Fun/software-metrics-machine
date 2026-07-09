'use client';

import { useState } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { METRIC_TARGETS, type TargetDefinition, type SourceEntry } from '@/components/charts/targets';

interface MetricCategory {
  label: string;
  description?: string;
  metrics: { key: string; definition: TargetDefinition }[];
}

const CATEGORIES: MetricCategory[] = [
  {
    label: 'Code Analysis',
    metrics: [
      { key: 'pairing-index', definition: METRIC_TARGETS['pairing-index'] },
      { key: 'code-churn', definition: METRIC_TARGETS['code-churn'] },
      { key: 'entity-churn', definition: METRIC_TARGETS['entity-churn'] },
      { key: 'entity-effort', definition: METRIC_TARGETS['entity-effort'] },
      { key: 'ownership', definition: METRIC_TARGETS['ownership'] },
      { key: 'code-coupling', definition: METRIC_TARGETS['code-coupling'] },
      { key: 'big-o-classification', definition: METRIC_TARGETS['big-o-classification'] },
      { key: 'crap-score', definition: METRIC_TARGETS['crap-score'] },
    ],
  },
  {
    label: 'Pipelines',
    metrics: [
      { key: 'deployment-frequency', definition: METRIC_TARGETS['deployment-frequency'] },
      { key: 'pipeline-duration', definition: METRIC_TARGETS['pipeline-duration'] },
      { key: 'job-avg-time', definition: METRIC_TARGETS['job-avg-time'] },
      { key: 'job-reruns', definition: METRIC_TARGETS['job-reruns'] },
      { key: 'jobs-success-rate', definition: METRIC_TARGETS['jobs-success-rate'] },
    ],
  },
  {
    label: 'Pull Requests',
    metrics: [
      { key: 'average-review-time', definition: METRIC_TARGETS['average-review-time'] },
      { key: 'time-to-first-comment', definition: METRIC_TARGETS['time-to-first-comment'] },
      { key: 'prs-by-author', definition: METRIC_TARGETS['prs-by-author'] },
      { key: 'prs-remain-open', definition: METRIC_TARGETS['prs-remain-open'] },
      { key: 'pr-statistics', definition: METRIC_TARGETS['pr-statistics'] },
      { key: 'most-commented-prs', definition: METRIC_TARGETS['most-commented-prs'] },
      { key: 'comments-by-author', definition: METRIC_TARGETS['comments-by-author'] },
      { key: 'open-prs-through-time', definition: METRIC_TARGETS['open-prs-through-time'] },
    ],
  },
  {
    label: 'SonarQube',
    metrics: [
      { key: 'sonarqube-reliability', definition: METRIC_TARGETS['sonarqube-reliability'] },
      { key: 'sonarqube-security', definition: METRIC_TARGETS['sonarqube-security'] },
      { key: 'sonarqube-maintainability', definition: METRIC_TARGETS['sonarqube-maintainability'] },
      { key: 'sonarqube-duplication', definition: METRIC_TARGETS['sonarqube-duplication'] },
      { key: 'sonarqube-coverage', definition: METRIC_TARGETS['sonarqube-coverage'] },
      { key: 'sonarqube-complexity', definition: METRIC_TARGETS['sonarqube-complexity'] },
      { key: 'sonarqube-measurements', definition: METRIC_TARGETS['sonarqube-measurements'] },
    ],
  },
  {
    label: 'Outlier Detection',
    description:
      'SMM flags outliers using the interquartile range (IQR) method. For each metric distribution, values below Q1 - 1.5 x IQR or above Q3 + 1.5 x IQR are flagged so teams can investigate unusual events and potential quality risks.',
    metrics: [
      { key: 'metric-outliers', definition: METRIC_TARGETS['metric-outliers'] },
    ],
  },
];

function formatMetricName(key: string): string {
  return key
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function SourceList({ sources }: { sources: SourceEntry[] }) {
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
        {sources.map((source, idx) => (
          <Box component="li" key={idx} sx={{ mb: 0.75, '&:last-child': { mb: 0 } }}>
            <Link
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                fontSize: '0.875rem',
                color: 'primary.main',
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' },
                lineHeight: 1.5,
              }}
            >
              {source.label}
            </Link>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function MetricCard({ metric }: { metric: { key: string; definition: TargetDefinition } }) {
  const [expanded, setExpanded] = useState(false);
  const { definition } = metric;

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'box-shadow 0.2s',
        '&:hover': {
          boxShadow: 2,
        },
      }}
    >
      <CardHeader
        title={
          definition.sources.length > 0 ? (
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
                {formatMetricName(metric.key)}
              </Typography>
              {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </Box>
          ) : (
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {formatMetricName(metric.key)}
            </Typography>
          )
        }
        sx={{ pb: 0 }}
      />
      <CardContent sx={{ flexGrow: 1, pt: 1 }}>
        <Chip
          label={definition.target}
          size="small"
          color="primary"
          variant="outlined"
          sx={{ mb: 1, fontWeight: 500 }}
        />
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
          {definition.description}
        </Typography>
        {definition.sources.length > 0 && (
          <Collapse in={expanded} timeout="auto">
            <SourceList sources={definition.sources} />
          </Collapse>
        )}
        {!expanded && definition.sources.length > 0 && (
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              mt: 1,
              color: 'text.secondary',
              fontStyle: 'italic',
            }}
          >
            {definition.sources.length} source{definition.sources.length !== 1 ? 's' : ''} available
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

function CategorySection({ category }: { category: MetricCategory }) {
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
        {category.label}
      </Typography>
      {category.description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.7 }}>
          {category.description}
        </Typography>
      )}
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
        {category.metrics.map((metric) => (
          <MetricCard key={metric.key} metric={metric} />
        ))}
      </Box>
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
        The outliers panel is generated from outlier arrays returned by backend metric endpoints. Each outlier row uses the same schema: timestamp, value, lowerBound, upperBound, and item metadata used to label and link the event.
      </Typography>

      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
        Pipeline Data Used
      </Typography>
      <Box component="ul" sx={{ m: 0, mb: 2, pl: 2.5 }}>
        <Box component="li" sx={{ mb: 0.75 }}>
          <Typography variant="body2">Run duration per workflow (runsDuration outliers)</Typography>
        </Box>
        <Box component="li" sx={{ mb: 0.75 }}>
          <Typography variant="body2">Job average time per job (jobsAverageTime outliers)</Typography>
        </Box>
        <Box component="li" sx={{ mb: 0.75 }}>
          <Typography variant="body2">Job average time by day (jobsAverageTimeByDay outliers)</Typography>
        </Box>
        <Box component="li" sx={{ mb: 0.75 }}>
          <Typography variant="body2">Job summary duration aggregates (jobsSummary outliers)</Typography>
        </Box>
        <Box component="li" sx={{ mb: 0.75 }}>
          <Typography variant="body2">Step average time (jobStepsAverageTime outliers)</Typography>
        </Box>
        <Box component="li" sx={{ mb: 0 }}>
          <Typography variant="body2">Step average time by day and step (jobStepsAverageTimeByDay step outliers)</Typography>
        </Box>
      </Box>

      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
        Pull Request Data Used
      </Typography>
      <Box component="ul" sx={{ m: 0, mb: 2, pl: 2.5 }}>
        <Box component="li" sx={{ mb: 0.75 }}>
          <Typography variant="body2">Average review time per author (averageReviewTime outliers)</Typography>
        </Box>
        <Box component="li" sx={{ mb: 0.75 }}>
          <Typography variant="body2">Average open days per period (averageOpenBy outliers)</Typography>
        </Box>
        <Box component="li" sx={{ mb: 0.75 }}>
          <Typography variant="body2">Average comments per PR (averageComments outliers)</Typography>
        </Box>
        <Box component="li" sx={{ mb: 0 }}>
          <Typography variant="body2">Time to first comment per author (firstCommentTime outliers)</Typography>
        </Box>
      </Box>

      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
        Detection And Rendering Flow
      </Typography>
      <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
        <Box component="li" sx={{ mb: 0.75 }}>
          <Typography variant="body2">The backend computes outliers per metric distribution using IQR bounds.</Typography>
        </Box>
        <Box component="li" sx={{ mb: 0.75 }}>
          <Typography variant="body2">Dashboard pages collect outliers from each metric response and convert them with toOutlierRows.</Typography>
        </Box>
        <Box component="li" sx={{ mb: 0.75 }}>
          <Typography variant="body2">Rows are labeled with metric context such as workflow, job, step, period, or author.</Typography>
        </Box>
        <Box component="li" sx={{ mb: 0 }}>
          <Typography variant="body2">The Flagged Outliers card shows value, IQR bounds, timestamp, and item link to support root-cause analysis.</Typography>
        </Box>
      </Box>
    </Box>
  );
}

export default function ReferencesPage() {
  const totalSources = Object.values(METRIC_TARGETS).reduce(
    (acc, def) => acc + def.sources.length,
    0
  );

  return (
    <div className="space-y-6">
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          References & Sources
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.6 }}>
          All academic papers, industry reports, and books used to define metric targets and
          recommendations across the dashboard. Each metric&apos;s target value is backed by
          published research on software engineering best practices.
        </Typography>
        <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
          <Chip
            label={`${Object.keys(METRIC_TARGETS).length} metrics`}
            color="primary"
            variant="filled"
          />
          <Chip
            label={`${totalSources} sources`}
            color="secondary"
            variant="filled"
          />
        </Box>
      </Box>

      <OutlierImplementationDetails />

      {CATEGORIES.map((category) => (
        <CategorySection key={category.label} category={category} />
      ))}
    </div>
  );
}
