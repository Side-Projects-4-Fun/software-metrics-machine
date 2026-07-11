'use client';

import React from 'react';
import { Autocomplete, TextField } from '@mui/material';

interface SelectFilterProps {
  label: string;
  value?: string | null;
  options: string[];
  onChange: (value: string | undefined) => void;
  disabled?: boolean;
}

export default function SelectFilter({ label, value, options, onChange, disabled = false }: SelectFilterProps) {
  const handleChange = (_event: React.SyntheticEvent, newValue: string | null) => {
    onChange(newValue === null ? undefined : newValue);
  };

  return (
    <Autocomplete
      disablePortal
      options={options}
      value={value || null}
      onChange={handleChange}
      disabled={disabled}
      sx={{ m: 0, minWidth: 200 }}
      renderInput={(params) => <TextField {...params} label={label} />}
    />
  );
}
