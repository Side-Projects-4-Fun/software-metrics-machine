export type DurationUnit = 'minutes' | 'hours' | 'days';

const MINUTES_PER_UNIT: Record<DurationUnit, number> = {
  minutes: 1,
  hours: 60,
  days: 1440,
};

export function formatDuration(value: number, unit: DurationUnit): string {
  const totalMinutes = value * MINUTES_PER_UNIT[unit];

  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) {
    return '—';
  }

  if (totalMinutes === 0) {
    return '0 min';
  }

  if (totalMinutes < 1) {
    return '< 1 min';
  }

  const totalRoundedMinutes = Math.round(totalMinutes);

  if (totalRoundedMinutes < 60) {
    return `${totalRoundedMinutes} min`;
  }

  const hours = Math.floor(totalRoundedMinutes / 60);
  const mins = totalRoundedMinutes % 60;

  if (hours < 24) {
    return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  return remainingHours === 0 ? `${days}d` : `${days}d ${remainingHours}h`;
}

const DURATION_UNITS: ReadonlySet<string> = new Set(['minutes', 'hours', 'days']);

export function formatMetricValue(value: number | null, unit: string): string {
  if (value === null || !Number.isFinite(value)) {
    return 'N/A';
  }

  if (DURATION_UNITS.has(unit)) {
    return formatDuration(value, unit as DurationUnit);
  }

  const rounded = Number.isInteger(value) ? value.toString() : value.toFixed(2);
  if (unit === '%' || unit === 'percentage') {
    return `${rounded}%`;
  }
  return unit ? `${rounded} ${unit}` : rounded;
}
