'use client';

import { Box, Slider, Typography } from '@mui/material';

interface SliderFilterProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}

export default function SliderFilter({ 
  label, 
  value, 
  onChange, 
  min = 1,
  max = 100,
  step = 1,
  disabled = false 
}: SliderFilterProps) {
  return (
    <Box sx={{ m: 1, minWidth: 200 }}>
      <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>
        {label}: {value}
      </Typography>
      <Slider
        value={value}
        onChange={(_, newValue) => onChange(newValue as number)}
        min={min}
        max={max}
        step={step}
        marks
        valueLabelDisplay="auto"
        disabled={disabled}
      />
    </Box>
  );
}
