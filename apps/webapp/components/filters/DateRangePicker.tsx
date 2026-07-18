'use client';

import { CalendarToday } from '@mui/icons-material';
import {
  Box,
  Button,
  Divider,
  InputAdornment,
  Popover,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateCalendar, LocalizationProvider } from "@mui/x-date-pickers";
import { PickersDay, PickersDayProps } from '@mui/x-date-pickers/PickersDay';
import dayjs, { Dayjs } from "dayjs";
import { useMemo, useState } from 'react';
import { useFilters } from './FiltersContext';
import { DashboardFilters } from './DashboardFilters';

interface PresetRange {
  label: string;
  getRange: () => [Dayjs, Dayjs];
}

interface RangePickersDayProps extends PickersDayProps {
  rangeStart?: Dayjs | null;
  rangeEnd?: Dayjs | null;
  previewEnd?: Dayjs | null;
}

const DATE_TIME_FORMAT = 'YYYY-MM-DDTHH:mm:ssZ';
const DISPLAY_DATE_TIME_FORMAT = 'YYYY-MM-DD HH:mm';
const DATE_TIME_INPUT_FORMAT = 'YYYY-MM-DDTHH:mm';

const presets: PresetRange[] = [
  {
    label: 'Today',
    getRange: () => {
      const today = dayjs();
      return [today.startOf('day'), today];
    },
  },
  {
    label: 'Yesterday',
    getRange: () => {
      const yesterday = dayjs().subtract(1, 'day');
      return [yesterday.startOf('day'), yesterday.endOf('day')];
    },
  },
  {
    label: 'Last 7 days',
    getRange: () => {
      const now = dayjs();
      return [now.subtract(7, 'day'), now];
    },
  },
  {
    label: 'Last 30 days',
    getRange: () => {
      const now = dayjs();
      return [now.subtract(30, 'day'), now];
    },
  },
  {
    label: 'This month',
    getRange: () => {
      const today = dayjs();
      return [today.startOf('month'), today];
    },
  },
  {
    label: 'Last month',
    getRange: () => {
      const lastMonth = dayjs().subtract(1, 'month');
      return [lastMonth.startOf('month'), lastMonth.endOf('month')];
    },
  },
];

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseFilterDate(value: string, boundary: 'start' | 'end'): Dayjs | null {
  if (!value) {
    return null;
  }

  const parsedDate = dayjs(value);
  if (!parsedDate.isValid()) {
    return null;
  }

  if (isDateOnly(value)) {
    return boundary === 'start' ? parsedDate.startOf('day') : parsedDate.endOf('day');
  }

  return parsedDate;
}

function formatDate(value: Dayjs | null): string {
  return value ? value.format(DATE_TIME_FORMAT) : '';
}

function formatDisplayDate(value: Dayjs | null): string {
  return value ? value.format(DISPLAY_DATE_TIME_FORMAT) : '';
}

function formatInputDate(value: Dayjs | null): string {
  return value ? value.format(DATE_TIME_INPUT_FORMAT) : '';
}

function parseInputDate(value: string): Dayjs | null {
  if (!value) {
    return null;
  }

  const parsedDate = dayjs(value);
  return parsedDate.isValid() ? parsedDate.second(0).millisecond(0) : null;
}

function getDisplayValue(startDate: string, endDate: string): string {
  const parsedStartDate = parseFilterDate(startDate, 'start');
  const parsedEndDate = parseFilterDate(endDate, 'end');

  if (parsedStartDate && parsedEndDate) {
    return `${formatDisplayDate(parsedStartDate)} - ${formatDisplayDate(parsedEndDate)}`;
  }

  if (parsedStartDate) {
    return `${formatDisplayDate(parsedStartDate)} -`;
  }

  if (parsedEndDate) {
    return `- ${formatDisplayDate(parsedEndDate)}`;
  }

  return '';
}

function isSameDay(left: Dayjs | null | undefined, right: Dayjs | null | undefined): boolean {
  return Boolean(left && right && left.isSame(right, 'day'));
}

function isDayInRange(day: Dayjs, start: Dayjs | null, end: Dayjs | null): boolean {
  if (!start || !end) {
    return false;
  }

  const currentTime = day.startOf('day').valueOf();
  const startTime = start.startOf('day').valueOf();
  const endTime = end.startOf('day').valueOf();

  return currentTime >= Math.min(startTime, endTime) && currentTime <= Math.max(startTime, endTime);
}

function withDateBoundary(date: Dayjs, boundary: 'start' | 'end'): Dayjs {
  return boundary === 'start' ? date.startOf('day') : date.endOf('day');
}

function RangePickersDay({
  day,
  rangeStart,
  rangeEnd,
  previewEnd,
  selected,
  ...other
}: RangePickersDayProps) {
  const effectiveEnd = rangeEnd || previewEnd || null;
  const isStart = isSameDay(day, rangeStart);
  const isEnd = isSameDay(day, effectiveEnd);
  const isInRange = isDayInRange(day, rangeStart || null, effectiveEnd);
  const isSingleDay = isStart && isEnd;

  return (
    <PickersDay
      {...other}
      day={day}
      selected={selected || isStart || isEnd}
      sx={{
        ...(isInRange && {
          borderRadius: isSingleDay ? '50%' : 0,
          bgcolor: isStart || isEnd ? 'primary.main' : 'primary.light',
          color: isStart || isEnd ? 'primary.contrastText' : 'primary.contrastText',
          opacity: isStart || isEnd ? 1 : 0.55,
          '&:hover, &:focus': {
            bgcolor: isStart || isEnd ? 'primary.dark' : 'primary.main',
          },
        }),
      }}
    />
  );
}

export default function DateRangePicker() {
  return (
    <FilterDateRangePicker
      label="Date range"
      startKey="startDate"
      endKey="endDate"
      startInputLabel="Start"
      endInputLabel="End"
    />
  );
}

interface FilterDateRangePickerProps {
  label: string;
  startKey: keyof DashboardFilters;
  endKey: keyof DashboardFilters;
  startInputLabel?: string;
  endInputLabel?: string;
}

export function FilterDateRangePicker({
  label,
  startKey,
  endKey,
  startInputLabel = 'Start',
  endInputLabel = 'End',
}: FilterDateRangePickerProps) {
  const { filters, updateFilter } = useFilters();
  const startDate = String(filters[startKey] || '');
  const endDate = String(filters[endKey] || '');
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [tempStartDate, setTempStartDate] = useState<Dayjs | null>(parseFilterDate(startDate, 'start'));
  const [tempEndDate, setTempEndDate] = useState<Dayjs | null>(parseFilterDate(endDate, 'end'));
  const [hoveredDate, setHoveredDate] = useState<Dayjs | null>(null);
  const isOpen = Boolean(anchorEl);
  const displayValue = getDisplayValue(startDate, endDate);
  const calendarValue = tempEndDate || tempStartDate || dayjs();

  const activePreset = useMemo(() => presets.find((preset) => {
    if (!startDate || !endDate) {
      return false;
    }

    const [presetStart, presetEnd] = preset.getRange();
    return startDate === formatDate(presetStart) && endDate === formatDate(presetEnd);
  })?.label, [endDate, startDate]);

  const openPicker = (event: React.MouseEvent<HTMLElement>) => {
    setTempStartDate(parseFilterDate(startDate, 'start'));
    setTempEndDate(parseFilterDate(endDate, 'end'));
    setHoveredDate(null);
    setAnchorEl(event.currentTarget);
  };

  const closePicker = () => {
    setAnchorEl(null);
    setHoveredDate(null);
  };

  const applyRange = (nextStartDate: Dayjs | null, nextEndDate: Dayjs | null) => {
    updateFilter(startKey, formatDate(nextStartDate) as DashboardFilters[typeof startKey]);
    updateFilter(endKey, formatDate(nextEndDate) as DashboardFilters[typeof endKey]);
    closePicker();
  };

  const handleCalendarChange = (date: Dayjs | null) => {
    if (!date) {
      return;
    }

    if (!tempStartDate || tempEndDate) {
      setTempStartDate(withDateBoundary(date, 'start'));
      setTempEndDate(null);
      return;
    }

    if (date.isBefore(tempStartDate, 'day')) {
      setTempStartDate(withDateBoundary(date, 'start'));
      setTempEndDate(null);
      return;
    }

    setTempEndDate(withDateBoundary(date, 'end'));
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ my: 1, mx: 'auto', width: { xs: '100%', sm: 520 }, maxWidth: '100%' }}>
        <TextField
          fullWidth
          label={label}
          placeholder="Select date range"
          size="small"
          value={displayValue}
          onClick={openPicker}
          inputProps={{ readOnly: true }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <CalendarToday fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        <Popover
          open={isOpen}
          anchorEl={anchorEl}
          onClose={closePicker}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              width: { xs: 360, sm: 680 },
              maxWidth: '100vw',
            }}
          >
            <Stack
              spacing={0.5}
              sx={{
                width: { xs: '100%', sm: 160 },
                borderRight: { xs: 0, sm: 1 },
                borderBottom: { xs: 1, sm: 0 },
                borderColor: 'divider',
                p: 1,
              }}
            >
              {presets.map((preset) => (
                <Button
                  key={preset.label}
                  color={activePreset === preset.label ? 'primary' : 'inherit'}
                  size="small"
                  sx={{ justifyContent: 'flex-start' }}
                  variant={activePreset === preset.label ? 'contained' : 'text'}
                  onClick={() => {
                    const [nextStartDate, nextEndDate] = preset.getRange();
                    applyRange(nextStartDate, nextEndDate);
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </Stack>

            <Box sx={{ flex: 1, p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Absolute range
              </Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mb: 1 }}>
                <TextField
                  fullWidth
                  label={startInputLabel}
                  size="small"
                  type="datetime-local"
                  value={formatInputDate(tempStartDate)}
                  onChange={(event) => setTempStartDate(parseInputDate(event.target.value))}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ step: 60, 'aria-label': 'Start date and time' }}
                />
                <TextField
                  fullWidth
                  label={endInputLabel}
                  size="small"
                  type="datetime-local"
                  value={formatInputDate(tempEndDate)}
                  onChange={(event) => setTempEndDate(parseInputDate(event.target.value))}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ step: 60, 'aria-label': 'End date and time' }}
                />
              </Stack>

              <DateCalendar
                value={calendarValue}
                onChange={handleCalendarChange}
                showDaysOutsideCurrentMonth
                slots={{ day: RangePickersDay }}
                slotProps={{
                  day: {
                    rangeStart: tempStartDate,
                    rangeEnd: tempEndDate,
                    previewEnd: tempStartDate && !tempEndDate ? hoveredDate : null,
                    onMouseEnter: (_event, day) => setHoveredDate(day as Dayjs),
                  } as Partial<RangePickersDayProps>,
                }}
                sx={{ mx: 'auto' }}
              />

              <Divider sx={{ my: 1 }} />
              <Stack direction="row" spacing={1} justifyContent="space-between">
                <Button
                  size="small"
                  onClick={() => {
                    setTempStartDate(null);
                    setTempEndDate(null);
                    applyRange(null, null);
                  }}
                >
                  Clear
                </Button>
                <Stack direction="row" spacing={1}>
                  <Button size="small" onClick={closePicker}>
                    Cancel
                  </Button>
                  <Button
                    disabled={!tempStartDate || !tempEndDate}
                    size="small"
                    variant="contained"
                    onClick={() => applyRange(tempStartDate, tempEndDate)}
                  >
                    Apply
                  </Button>
                </Stack>
              </Stack>
            </Box>
          </Box>
        </Popover>
      </Box>
    </LocalizationProvider>
  );
}
