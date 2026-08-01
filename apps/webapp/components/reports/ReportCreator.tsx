'use client';

import { useMemo, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import SavedFilterSelect from './SavedFilterSelect';
import { StandaloneDateRangePicker } from '@/components/filters/DateRangePicker';
import type { EvaluatableSection, ReportSectionRef, ReportDateWindow } from './reports-store';
import {
  EVALUATABLE_SECTIONS,
  EVALUATABLE_SECTION_LABELS,
  defaultReportName,
} from './reports-store';

type WindowInterval = 'weekly' | 'bi-weekly' | 'monthly' | 'manual';

const INTERVAL_DAYS: Record<WindowInterval, number> = {
  weekly: 7,
  'bi-weekly': 14,
  monthly: 28,
  manual: 0,
};

const INTERVAL_LABELS: Record<WindowInterval, string> = {
  weekly: 'Weekly',
  'bi-weekly': 'Bi-weekly',
  monthly: 'Monthly',
  manual: 'Manual',
};

interface ReportCreatorProps {
  open: boolean;
  repository: string;
  onClose: () => void;
  onSave: (
    name: string,
    sections: ReportSectionRef[],
    startDateOverride?: string,
    endDateOverride?: string,
    dateWindows?: ReportDateWindow[],
  ) => Promise<void>;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatShort(iso: string): string {
  if (!iso) { return ''; }
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function generateWindows(
  baseStart: string,
  baseEnd: string,
  interval: WindowInterval,
  count: number,
): ReportDateWindow[] {
  const days = INTERVAL_DAYS[interval];
  const windows: ReportDateWindow[] = [];

  // Compute the most recent window
  let currentStart = baseStart;
  let currentEnd = baseEnd;

  // If only one date is set, compute the other
  if (currentStart && !currentEnd) {
    currentEnd = addDays(currentStart, days);
  } else if (!currentStart && currentEnd) {
    currentStart = addDays(currentEnd, -days);
  }

  for (let i = 0; i < count; i++) {
    windows.unshift({
      startDate: currentStart || '',
      endDate: currentEnd || '',
      label: `${formatShort(currentStart || '')} – ${formatShort(currentEnd || '')}`,
    });
    // Move backward
    currentStart = currentStart ? addDays(currentStart, -days) : '';
    currentEnd = currentEnd ? addDays(currentEnd, -days) : '';
  }

  return windows;
}

export default function ReportCreator({
  open,
  repository,
  onClose,
  onSave,
}: ReportCreatorProps) {
  const [name, setName] = useState(defaultReportName());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selections, setSelections] = useState<
    Record<EvaluatableSection, string | undefined>
  >({
    pipelines: undefined,
    'pull-requests': undefined,
    'source-code': undefined,
    architecture: undefined,
    sonarqube: undefined,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [multiWindow, setMultiWindow] = useState(false);
  const [windowInterval, setWindowInterval] = useState<WindowInterval>('weekly');
  const [windowCount, setWindowCount] = useState(4);
  const [manualWindows, setManualWindows] = useState<
    Array<{ startDate: string; endDate: string }>
  >([]);

  const autoPreview = useMemo(() => {
    if (!multiWindow || !startDate) { return []; }
    return generateWindows(startDate, endDate, windowInterval, windowCount);
  }, [multiWindow, startDate, endDate, windowInterval, windowCount]);

  const previewWindows = useMemo(() => {
    if (!multiWindow) { return []; }
    if (windowInterval === 'manual') {
      return manualWindows.map((w) => ({
        startDate: w.startDate,
        endDate: w.endDate,
        label: `${formatShort(w.startDate)} – ${formatShort(w.endDate)}`,
      }));
    }
    return autoPreview;
  }, [multiWindow, windowInterval, manualWindows, autoPreview]);

  const handleClose = () => {
    setName(defaultReportName());
    setStartDate('');
    setEndDate('');
    setSelections({
      pipelines: undefined,
      'pull-requests': undefined,
      'source-code': undefined,
      architecture: undefined,
      sonarqube: undefined,
    });
    setError(null);
    setMultiWindow(false);
    setWindowInterval('weekly');
    setWindowCount(4);
    setManualWindows([]);
    onClose();
  };

  const hasSelection = Object.values(selections).some((v) => v !== undefined);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Report name is required.');
      return;
    }
    if (!hasSelection) {
      setError('Select at least one saved filter.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const sections: ReportSectionRef[] = EVALUATABLE_SECTIONS.filter(
        (section) => selections[section] !== undefined,
      ).map((section) => ({
        section,
        savedFilterId: selections[section]!,
      }));

      let activeDateWindows: ReportDateWindow[] | undefined;
      if (multiWindow && startDate) {
        if (windowInterval === 'manual') {
          const filled = manualWindows.filter((w) => w.startDate || w.endDate);
          if (filled.length > 0) {
            activeDateWindows = filled.map((w) => ({
              startDate: w.startDate,
              endDate: w.endDate,
              label: `${formatShort(w.startDate)} – ${formatShort(w.endDate)}`,
            }));
          }
        } else {
          activeDateWindows = generateWindows(startDate, endDate, windowInterval, windowCount);
        }
      }

      await onSave(
        name.trim(),
        sections,
        startDate.trim() || undefined,
        endDate.trim() || undefined,
        activeDateWindows,
      );
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save report.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>New Report</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <TextField
            autoFocus
            label="Report name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            placeholder="e.g. Sprint 42"
          />

          <StandaloneDateRangePicker
            label="Date range"
            startDate={startDate}
            endDate={endDate}
            onStartChange={setStartDate}
            onEndChange={setEndDate}
          />

          <FormControlLabel
            control={
              <Switch
                checked={multiWindow}
                onChange={(_, checked) => setMultiWindow(checked)}
              />
            }
            label="Multi-window timeline"
          />

          {multiWindow && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <Typography variant="body2" sx={{ minWidth: 60 }}>
                  Interval
                </Typography>
                <Select
                  size="small"
                  value={windowInterval}
                  onChange={(e) => {
                    const next = e.target.value as WindowInterval;
                    if (next === 'manual' && windowInterval !== 'manual') {
                      // Seed manual windows from current auto preview
                      setManualWindows(
                        autoPreview.map((w) => ({
                          startDate: w.startDate,
                          endDate: w.endDate,
                        })),
                      );
                    }
                    setWindowInterval(next);
                  }}
                >
                  {(Object.keys(INTERVAL_LABELS) as WindowInterval[]).map((key) => (
                    <MenuItem key={key} value={key}>
                      {INTERVAL_LABELS[key]}
                    </MenuItem>
                  ))}
                </Select>
              </Stack>

              {windowInterval !== 'manual' && (
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ minWidth: 60 }}>
                    Windows
                  </Typography>
                  <TextField
                    size="small"
                    type="number"
                    value={windowCount}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      if (n >= 1 && n <= 52) { setWindowCount(n); }
                    }}
                    slotProps={{ htmlInput: { min: 1, max: 52, style: { width: 60 } } }}
                  />
                </Stack>
              )}

              {windowInterval === 'manual' && (
                <Stack spacing={1.5}>
                  <Typography variant="body2" color="text.secondary">
                    Enter each window&apos;s date range manually:
                  </Typography>
                  {manualWindows.map((w, i) => (
                    <Stack key={i} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <TextField
                        size="small"
                        type="date"
                        label="Start"
                        value={w.startDate}
                        onChange={(e) =>
                          setManualWindows((prev) =>
                            prev.map((mw, j) =>
                              j === i ? { ...mw, startDate: e.target.value } : mw,
                            ),
                          )
                        }
                        slotProps={{ inputLabel: { shrink: true } }}
                        sx={{ flex: 1 }}
                      />
                      <TextField
                        size="small"
                        type="date"
                        label="End"
                        value={w.endDate}
                        onChange={(e) =>
                          setManualWindows((prev) =>
                            prev.map((mw, j) =>
                              j === i ? { ...mw, endDate: e.target.value } : mw,
                            ),
                          )
                        }
                        slotProps={{ inputLabel: { shrink: true } }}
                        sx={{ flex: 1 }}
                      />
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() =>
                          setManualWindows((prev) => prev.filter((_, j) => j !== i))
                        }
                        aria-label={`Remove window ${i + 1}`}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  ))}
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() =>
                      setManualWindows((prev) => [
                        ...prev,
                        { startDate: '', endDate: '' },
                      ])
                    }
                  >
                    Add window
                  </Button>
                </Stack>
              )}

              {previewWindows.length > 0 && (
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    Preview ({previewWindows.length} windows):
                  </Typography>
                  <div className="max-h-32 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-2">
                    {previewWindows.map((w, i) => (
                      <Typography key={i} variant="caption" sx={{ display: 'block' }}>
                        {w.label ?? `${w.startDate} – ${w.endDate}`}
                      </Typography>
                    ))}
                  </div>
                </Stack>
              )}
            </Stack>
          )}

          {EVALUATABLE_SECTIONS.map((section) => (
            <SavedFilterSelect
              key={section}
              section={section}
              repository={repository}
              label={EVALUATABLE_SECTION_LABELS[section]}
              value={selections[section]}
              onChange={(id) =>
                setSelections((prev) => ({ ...prev, [section]: id }))
              }
            />
          ))}

          {EVALUATABLE_SECTIONS.filter((s) => selections[s]).length > 0 && (
            <Typography variant="caption" color="text.secondary">
              Selected:{' '}
              {EVALUATABLE_SECTIONS.filter((s) => selections[s])
                .map((s) => EVALUATABLE_SECTION_LABELS[s])
                .join(', ')}
            </Typography>
          )}

          {error && (
            <Typography variant="caption" color="error">
              {error}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!hasSelection || saving}
        >
          {saving ? 'Saving...' : 'Save Report'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
