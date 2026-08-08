/**
 * Duration formatting for chart tooltips, axis tick formatters, and evaluation cards.
 *
 * This is a self-contained utility (no @smmachine/utils import) because
 * it runs in the browser. The webapp must not import any Node.js-dependent
 * packages.
 *
 * For all other duration displays, the REST API provides pre-formatted
 * strings via `_formatted` fields in the response.
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

/**
 * Convenience wrapper for formatting minutes (used by pipeline chart components).
 */
export function formatDurationMinutes(value: number): string {
  return formatDuration(value, 'minutes');
}
