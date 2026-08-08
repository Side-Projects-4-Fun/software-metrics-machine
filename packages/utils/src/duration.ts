/**
 * Duration Formatting Utilities
 *
 * Converts raw duration values (in minutes, hours, or days) into human-readable
 * strings with smart unit selection. Used by both the CLI and webapp so that
 * duration displays are consistent across all surfaces.
 *
 * Examples:
 *   formatDuration(42, 'minutes')   → "42 min"
 *   formatDuration(0.7, 'hours')    → "42 min"
 *   formatDuration(2.5, 'days')     → "2d 12h"
 *   formatDuration(0.001, 'days')   → "< 1 min"
 */

export type DurationUnit = 'minutes' | 'hours' | 'days';

const MINUTES_PER_UNIT: Record<DurationUnit, number> = {
  minutes: 1,
  hours: 60,
  days: 1440,
};

/**
 * Format a duration value into a human-readable string.
 *
 * The output unit is chosen automatically based on the magnitude:
 * - Less than 1 minute  → "< 1 min"
 * - 1–59 minutes         → "X min"
 * - 1–23 hours           → "Xh Ym" (or "Xh" if on the hour)
 * - 1+ days              → "Xd Yh" (or "Xd" if on the day)
 *
 * @param value - The numeric duration value.
 * @param unit  - The unit the value is expressed in.
 * @returns A human-readable duration string.
 */
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

/**
 * Format a metric value that may or may not be a duration.
 *
 * Duration units (`minutes`, `hours`, `days`) delegate to {@link formatDuration}.
 * Other units are rendered with a compact numeric representation and the unit
 * appended as a suffix (e.g. `"85%"`, `"3 deployments/week"`, `"42 components"`).
 *
 * @param value - The raw numeric value (or null when no data is available).
 * @param unit  - The unit the value is expressed in.
 * @returns A human-readable value string.
 */
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
