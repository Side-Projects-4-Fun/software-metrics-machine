'use client';

import { useEffect, useState } from 'react';
import { Autocomplete, TextField } from '@mui/material';
import { getSavedFiltersBySection } from '@/components/filters/saved-filters-actions';
import type { SavedFilterEntry } from '@/components/filters/saved-filters-store';
import type { EvaluatableSection } from './reports-store';

interface SavedFilterSelectProps {
  section: EvaluatableSection;
  repository: string;
  value?: string | string[];
  label?: string;
  multiple?: boolean;
  onChange: (savedFilterId: string | string[] | undefined) => void;
}

export default function SavedFilterSelect({
  section,
  repository,
  value,
  label = 'Saved Filter',
  multiple = false,
  onChange,
}: SavedFilterSelectProps) {
  const [filters, setFilters] = useState<SavedFilterEntry[]>([]);

  useEffect(() => {
    getSavedFiltersBySection(section, repository)
      .then(setFilters)
      .catch(() => setFilters([]));
  }, [section, repository]);

  const options = filters.map((f) => f.name);

  if (multiple) {
    const selectedIds = Array.isArray(value) ? value : [];
    const selected = filters.filter((f) => selectedIds.includes(f.id));

    return (
      <Autocomplete
        multiple
        disablePortal
        options={options}
        value={selected.map((f) => f.name)}
        onChange={(_event, newValues) => {
          const ids = newValues
            .map((name) => filters.find((f) => f.name === name)?.id)
            .filter((id): id is string => id !== undefined);
          onChange(ids);
        }}
        isOptionEqualToValue={(option, val) => option === val}
        sx={{ minWidth: 260 }}
        renderInput={(params) => <TextField {...params} label={label} placeholder="None" />}
        noOptionsText="No saved filters for this section"
      />
    );
  }

  const selected = filters.find((f) => f.id === value);

  return (
    <Autocomplete
      disablePortal
      options={options}
      value={selected?.name ?? null}
      onChange={(_event, newValue) => {
        if (newValue === null) {
          onChange(undefined);
          return;
        }
        const match = filters.find((f) => f.name === newValue);
        onChange(match?.id);
      }}
      isOptionEqualToValue={(option, val) => option === val}
      sx={{ minWidth: 260 }}
      renderInput={(params) => <TextField {...params} label={label} placeholder="None" />}
      noOptionsText="No saved filters for this section"
    />
  );
}
