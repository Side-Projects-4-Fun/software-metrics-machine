'use client';

import { Box, Paper, Typography, Divider, Button, Stack, FormControlLabel } from "@mui/material";
import { useFilters } from "@/components/filters/FiltersContext";
import { usePathname } from "next/navigation";
import DateRangePicker, { FilterDateRangePicker } from "@/components/filters/DateRangePicker";
import SelectFilter from "@/components/filters/SelectFilter";
import MultiSelectFilter from "@/components/filters/MultiSelectFilter";
import TextInputFilter from "@/components/filters/TextInputFilter";
import SliderFilter from "@/components/filters/SliderFilter";
import { DashboardFilters } from "@/components/filters/DashboardFilters";
import { useCallback, useEffect, useMemo, useState } from "react";
import { pipelineAPI, pullRequestAPI, sourceCodeAPI } from "@/server/api";
import { DashboardSection, dashboardSectionFromPathname, SavedFilterEntry } from './saved-filters-store';
import SavedFiltersSection from './SavedFiltersSection';

interface WorkflowOption {
  name?: string;
  path?: string;
}

const TOP_ENTRIES_MAX = 400;
const MIN_TOP_ENTRIES = 1;
const STEP = 5;

const COMMON_FILTER_KEYS: (keyof DashboardFilters)[] = ['startDate', 'endDate', 'timezone'];

const SECTION_FILTER_KEYS: Record<DashboardSection, (keyof DashboardFilters)[]> = {
  insights: ['aggregateMetric'],
  pipelines: [
    'workflowSelector',
    'workflowStatus',
    'workflowConclusions',
    'jobSelector',
    'branch',
    'event',
    'weekends',
    'outlierMode',
  ],
  'pull-requests': [
    'authorSelect',
    'excludeAuthorSelect',
    'excludeCommenterSelect',
    'labelSelector',
    'pullRequestStatus',
    'aggregateBy',
    'weekends',
    'outlierMode',
  ],
  'source-code': [
    'ignorePatternFiles',
    'includePatternFiles',
    'authorSelectSourceCode',
    'topEntries',
    'typeChurn',
  ],
  architecture: [
    'ignorePatternFiles',
    'includePatternFiles',
  ],
  sonarqube: [
    'ignorePatternFiles',
    'includePatternFiles',
    'sonarqubeRemoveFolders',
    'topEntries',
  ],
  'engineering-health': [
    'metric',
    'category',
    'labelSelector',
    'compareStartDate',
    'compareEndDate',
    'rawFilters',
    'period',
    'weekends',
    'outlierMode',
  ],
};

const ENGINEERING_HEALTH_METRICS = [
  'deployment-frequency',
  'lead-time',
  'pipeline-duration',
  'failure-rate',
  'complexity',
  'duplication',
  'coverage',
  'review-time',
  'review-participation',
  'pair-programming',
  'knowledge-distribution',
  'coupling',
  'ownership',
  'components',
];

const ENGINEERING_HEALTH_CATEGORIES = [
  'delivery',
  'quality',
  'collaboration',
  'architecture',
];

function areFiltersEqualForSection(
  left: DashboardFilters,
  right: DashboardFilters,
  section: DashboardSection,
): boolean {
  const keys = [...COMMON_FILTER_KEYS, ...SECTION_FILTER_KEYS[section]];

  return keys.every((key) => JSON.stringify(left[key]) === JSON.stringify(right[key]));
}

export default function FiltersContainer({ repository }: { repository: string }) {
  const { filters, updateFilter, applyFilters, resetFilters } = useFilters();
  const pathname = usePathname();
  const activeSection = useMemo(() => dashboardSectionFromPathname(pathname), [pathname]);
  const [savedFilters, setSavedFilters] = useState<SavedFilterEntry[]>([]);
  const [workflowOptions, setWorkflowOptions] = useState<string[]>([]);
  const [jobOptions, setJobOptions] = useState<string[]>([]);
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [conclusionOptions, setConclusionOptions] = useState<string[]>([]);
  const [branchOptions, setBranchOptions] = useState<string[]>([]);
  const [eventOptions, setEventOptions] = useState<string[]>([]);
  const [authorOptions, setAuthorOptions] = useState<string[]>([]);
  const [commenterOptions, setCommenterOptions] = useState<string[]>([]);
  const [authorSourceCodeOptions, setAuthorSourceCodeOptions] = useState<string[]>([]);
  const [labelOptions, setLabelOptions] = useState<string[]>([]);

  // Fetch all filter options on component mount
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const pipelineOptions = await pipelineAPI.getFilterOptions().catch(() => ({
          workflows: [],
          statuses: [],
          conclusions: [],
          branches: [],
          events: [],
          jobs: [],
        }));

        setWorkflowOptions([
          ...pipelineOptions.workflows
            .map((w: WorkflowOption) => w.path || w.name)
            .filter(Boolean) as string[],
        ]);
        setStatusOptions(
          pipelineOptions.statuses.length > 0
            ? pipelineOptions.statuses
            : ['completed', 'in_progress', 'queued']
        );
        setConclusionOptions(
          pipelineOptions.conclusions.length > 0
            ? pipelineOptions.conclusions
            : ['success', 'failure', 'cancelled', 'timed_out']
        );
        setBranchOptions(pipelineOptions.branches);
        setEventOptions(
          pipelineOptions.events.length > 0
            ? pipelineOptions.events
            : ['push', 'pull_request', 'schedule', 'manual']
        );
        setJobOptions(pipelineOptions.jobs.map((j) => j.name).filter(Boolean) as string[]);

        const pullRequestOptions = await pullRequestAPI.getFilterOptions().catch(() => ({
          authors: [],
          commenters: [],
          labels: [],
        }));
        setAuthorOptions(pullRequestOptions.authors);
        setCommenterOptions(pullRequestOptions.commenters || []);

        const sourceCodeAuthors = await sourceCodeAPI.getAuthors().catch(() => []);
        setAuthorSourceCodeOptions(sourceCodeAuthors);

        setLabelOptions(pullRequestOptions.labels);
      } catch (error) {
        console.warn('Some filter options could not be loaded:', error);
      }
    };

    fetchFilterOptions();
  }, [pathname]);

  // Fetch jobs when workflow changes (only in pipelines section)
  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const params = filters.workflowSelector ? { workflow_path: filters.workflowSelector } : undefined;
        const options = await pipelineAPI.getFilterOptions(params).catch(() => ({ jobs: [] }));
        setJobOptions(options.jobs.map((j) => j.name).filter(Boolean) as string[]);
      } catch (error) {
        console.warn('Failed to load jobs:', error);
        setJobOptions([]);
      }
    };

    if (activeSection === 'pipelines') {
      fetchJobs();
    }
  }, [filters.workflowSelector, activeSection]);

  const handleSavedFilterChange = (savedFilterName: string | undefined) => {
    if (!savedFilterName) {
      resetFilters();
      return;
    }

    const selectedSavedFilter = savedFilters.find((entry) => entry.name === savedFilterName);
    if (!selectedSavedFilter) {
      return;
    }

    applyFilters(selectedSavedFilter.filters);
  };

  const handleSavedFiltersLoaded = useCallback((entries: SavedFilterEntry[]) => {
    setSavedFilters(entries);
  }, []);

  const selectedSavedFilterName = useMemo(
    () => savedFilters.find((entry) => areFiltersEqualForSection(entry.filters, filters, activeSection))?.name,
    [activeSection, filters, savedFilters],
  );

  const selectedSavedFilter = useMemo(
    () => savedFilters.find((entry) => entry.name === selectedSavedFilterName),
    [savedFilters, selectedSavedFilterName],
  );

  const handleResetFilters = useCallback(() => {
    resetFilters();
  }, [resetFilters]);

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Box sx={{ mb: 2 }}>
        <SelectFilter
          label="Saved Filters"
          value={selectedSavedFilterName}
          options={savedFilters.map((entry) => entry.name)}
          onChange={handleSavedFilterChange}
          disabled={savedFilters.length === 0}
        />
      </Box>
      <Box sx={{ mb: 2 }}>
        <SavedFiltersSection
          activeSection={activeSection}
          pathname={pathname}
          repository={repository}
          selectedSavedFilter={selectedSavedFilter}
          onSavedFiltersLoaded={handleSavedFiltersLoaded}
        />
      </Box>

      <Typography variant="h6" sx={{ mb: 2 }}>
        Filters
      </Typography>

      <Divider sx={{ mb: 2 }} />

      {/* Date Range - Always Show */}
      <Box sx={{ mb: 3 }}>
        <DateRangePicker />
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* Insights Tab - Date Range Only */}
      {activeSection === 'insights' && (
        <Box sx={{ mb: 3 }} />
      )}

      {/* Pipelines Tab - Pipeline Filters */}
      {activeSection === 'pipelines' && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            Pipeline Filters
          </Typography>
          <Stack direction="column" spacing={2} flexWrap="wrap">
            <SelectFilter
              label="Pipeline"
              value={filters.workflowSelector}
              options={workflowOptions}
              onChange={(value) => updateFilter('workflowSelector', value)}
            />
            <MultiSelectFilter
              label="Pipeline Status"
              values={filters.workflowStatus}
              options={statusOptions}
              onChange={(values) => updateFilter('workflowStatus', values)}
            />
            <MultiSelectFilter
              label="Pipeline Conclusion"
              values={filters.workflowConclusions}
              options={conclusionOptions}
              onChange={(values) => updateFilter('workflowConclusions', values)}
            />
            <MultiSelectFilter
              label="Jobs"
              values={filters.jobSelector}
              options={jobOptions}
              onChange={(values) => updateFilter('jobSelector', values)}
            />
            <MultiSelectFilter
              label="Branch"
              values={filters.branch}
              options={branchOptions}
              onChange={(values) => updateFilter('branch', values)}
            />
            <MultiSelectFilter
              label="Event"
              values={filters.event}
              options={eventOptions}
              onChange={(values) => updateFilter('event', values)}
            />
            <SelectFilter
              label="Weekends"
              value={filters.weekends}
              options={['include', 'exclude', 'weekends_only']}
              onChange={(value) =>
                updateFilter('weekends', value as 'include' | 'exclude' | 'weekends_only')
              }
            />
            <SelectFilter
              label="Outliers"
              value={filters.outlierMode}
              options={['include', 'flag', 'exclude']}
              onChange={(value) =>
                updateFilter('outlierMode', value as 'include' | 'flag' | 'exclude')
              }
            />
          </Stack>
        </Box>
      )}

      {/* Pull Request Tab - Pull Request Filters */}
      {activeSection === 'pull-requests' && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            Pull Request Filters
          </Typography>
          <Stack direction="column" spacing={2} flexWrap="wrap">
            <MultiSelectFilter
              label="Authors"
              values={filters.authorSelect}
              options={authorOptions}
              onChange={(values) => updateFilter('authorSelect', values)}
            />
            <MultiSelectFilter
              label="Exclude Authors"
              values={filters.excludeAuthorSelect}
              options={authorOptions}
              onChange={(values) => updateFilter('excludeAuthorSelect', values)}
            />
            <MultiSelectFilter
              label="Exclude Commenters"
              values={filters.excludeCommenterSelect}
              options={commenterOptions}
              onChange={(values) => updateFilter('excludeCommenterSelect', values)}
            />
            <MultiSelectFilter
              label="Labels"
              values={filters.labelSelector}
              options={labelOptions}
              onChange={(values) => updateFilter('labelSelector', values)}
            />
            <SelectFilter
              label="Status"
              value={filters.pullRequestStatus}
              options={['open', 'closed', 'merged', 'draft']}
              onChange={(value) => updateFilter('pullRequestStatus', value as 'open' | 'closed' | 'merged' | 'draft')}
            />
            <SelectFilter
              label="Aggregate By"
              value={filters.aggregateBy}
              options={['day', 'week', 'month']}
              onChange={(value) => updateFilter('aggregateBy', value)}
            />
            <SelectFilter
              label="Weekends"
              value={filters.weekends}
              options={['include', 'exclude', 'weekends_only']}
              onChange={(value) =>
                updateFilter('weekends', value as 'include' | 'exclude' | 'weekends_only')
              }
            />
            <SelectFilter
              label="Outliers"
              value={filters.outlierMode}
              options={['include', 'flag', 'exclude']}
              onChange={(value) =>
                updateFilter('outlierMode', value as 'include' | 'flag' | 'exclude')
              }
            />
          </Stack>
        </Box>
      )}


      {/* Source Code / SonarQube Tab - Source Code-like Filters */}
      {(activeSection === 'source-code' || activeSection === 'architecture') && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            {activeSection === 'architecture' ? 'Architecture Filters' : 'Source Code Filters'}
          </Typography>
          <Stack direction="column" spacing={2} flexWrap="wrap">
            <TextInputFilter
              label="Ignore Pattern Files"
              value={filters.ignorePatternFiles}
              onChange={(value) => updateFilter('ignorePatternFiles', value)}
              placeholder="e.g., *.test.ts, node_modules/*, *.json"
            />
            <TextInputFilter
              label="Include Pattern Files"
              value={filters.includePatternFiles}
              onChange={(value) => updateFilter('includePatternFiles', value)}
              placeholder="e.g., *.ts, src/**"
            />
            {activeSection === 'source-code' && (
              <>
            <MultiSelectFilter
              label="Authors (Source Code)"
              values={filters.authorSelectSourceCode}
              options={authorSourceCodeOptions}
              onChange={(values) => updateFilter('authorSelectSourceCode', values)}
            />
            <SelectFilter
              label="Type Churn"
              value={filters.typeChurn}
              options={['added', 'deleted']}
              onChange={(value) => updateFilter('typeChurn', value)}
            />
            <SliderFilter
              label="Top Entries"
              value={filters.topEntries}
              onChange={(value) => updateFilter('topEntries', value)}
              min={MIN_TOP_ENTRIES}
              max={TOP_ENTRIES_MAX}
              step={STEP}
            />
              </>
            )}
          </Stack>
        </Box>
      )}

      {activeSection === 'sonarqube' && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            SonarQube Filters
          </Typography>
          <Stack direction="column" spacing={2} flexWrap="wrap">
            <TextInputFilter
              label="Ignore Pattern Files"
              value={filters.ignorePatternFiles}
              onChange={(value) => updateFilter('ignorePatternFiles', value)}
              placeholder="e.g., *.test.ts, node_modules/*, *.json"
            />
            <TextInputFilter
              label="Include Pattern Files"
              value={filters.includePatternFiles}
              onChange={(value) => updateFilter('includePatternFiles', value)}
              placeholder="e.g., *.ts, src/**, app/**"
            />
            <FormControlLabel
              classes={{ label: 'pl-2' }}
              control={
                <Box
                  component="input"
                  type="checkbox"
                  checked={filters.sonarqubeRemoveFolders}
                  onChange={(e) => updateFilter('sonarqubeRemoveFolders', e.target.checked)}
                  sx={{ cursor: 'pointer' }}
                />}
              label="Remove Folders"
            />
            <SliderFilter
              label="Top Entries"
              value={filters.topEntries}
              onChange={(value) => updateFilter('topEntries', value)}
              min={MIN_TOP_ENTRIES}
              max={TOP_ENTRIES_MAX}
              step={STEP}
            />
          </Stack>
        </Box>
      )}

      {activeSection === 'engineering-health' && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            Engineering Health Filters
          </Typography>
          <Stack direction="column" spacing={2} flexWrap="wrap">
            <SelectFilter
              label="Metric"
              value={filters.metric}
              options={ENGINEERING_HEALTH_METRICS}
              onChange={(value) => updateFilter('metric', value)}
            />
            <SelectFilter
              label="Category"
              value={filters.category}
              options={ENGINEERING_HEALTH_CATEGORIES}
              onChange={(value) => updateFilter('category', value)}
            />
            <MultiSelectFilter
              label="PR Labels"
              values={filters.labelSelector}
              options={labelOptions}
              onChange={(values) => updateFilter('labelSelector', values)}
            />
            <TextInputFilter
              label="Raw Filters"
              value={filters.rawFilters}
              onChange={(value) => updateFilter('rawFilters', value)}
              placeholder="e.g., workflow_path=ci.yml"
            />
            <FilterDateRangePicker
              label="Compare date range"
              startKey="compareStartDate"
              endKey="compareEndDate"
              startInputLabel="Compare start"
              endInputLabel="Compare end"
            />
            <SelectFilter
              label="Period"
              value={filters.period}
              options={['day', 'week', 'month']}
              onChange={(value) => updateFilter('period', (value as 'day' | 'week' | 'month') || 'week')}
            />
            <SelectFilter
              label="Weekends"
              value={filters.weekends}
              options={['include', 'exclude', 'weekends_only']}
              onChange={(value) =>
                updateFilter('weekends', value as 'include' | 'exclude' | 'weekends_only')
              }
            />
            <SelectFilter
              label="Outliers"
              value={filters.outlierMode}
              options={['include', 'flag', 'exclude']}
              onChange={(value) => updateFilter('outlierMode', value as 'include' | 'flag' | 'exclude')}
            />
          </Stack>
        </Box>
      )}

      {/* Action Buttons */}
      <Stack direction="column" spacing={2} sx={{ mt: 2 }}>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            size="small"
            onClick={handleResetFilters}
          >
            Reset Filters
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
}
