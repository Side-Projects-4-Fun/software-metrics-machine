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

export function formatDurationMinutes(value: number): string {
  return formatDuration(value, 'minutes');
}
