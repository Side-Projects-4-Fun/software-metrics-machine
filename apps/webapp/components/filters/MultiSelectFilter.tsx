'use client';

import React from 'react';
import { Autocomplete, TextField, Chip } from '@mui/material';

interface MultiSelectFilterProps {
  label: string;
  values: string[];
  options: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
}

export default function MultiSelectFilter({
  label,
  values,
  options,
  onChange,
  disabled = false,
}: MultiSelectFilterProps) {
  const handleChange = (_event: React.SyntheticEvent, newValue: string[]) => {
    onChange(newValue);
  };

  return (
    <Autocomplete
      disablePortal
      multiple
      options={options}
      value={values}
      onChange={handleChange}
      disabled={disabled}
      sx={{ m: 1, minWidth: 250 }}
      renderInput={(params) => <TextField {...params} label={label} />}
      renderValue={(value, getItemProps) =>
        value.map((option, index) => {
          const { key, ...tagProps } = getItemProps({ index });
          return <Chip label={option} size="small" {...tagProps} key={key} />;
        })
      }
    />
  );
}
