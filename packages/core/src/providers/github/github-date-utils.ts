import type { TimeZoneProvider } from '../../infrastructure/timezone-provider';

/**
 * Attempts to extract year, month, day from a date string in common formats.
 * Returns `null` if the format is not recognised.
 *
 * Supported formats (with `-` or `/` as separators):
 *   - YYYY-MM-DD           (ISO 8601 date-only)
 *   - YYYY-MM-DDThh:mm:ssZ (ISO 8601 with time)
 *   - YYYY-MM-DDThh:mm:ss±hh:mm (ISO 8601 with timezone)
 *   - MM-DD-YYYY           (US)
 *   - M-D-YYYY             (short US)
 *   - YYYY/MM/DD
 *   - MM/DD/YYYY
 *
 * @returns `[year, month, day]` as zero-padded strings, or `null`
 */
function extractDateParts(dateStr: string): [string, string, string] | null {
  const trimmed = dateStr.trim();

  // ISO 8601 date-time: 2025-01-01T00:00:00Z or 2025-01-01T00:00:00+00:00
  const isoWithTime = trimmed.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/
  );
  if (isoWithTime) {
    return [isoWithTime[1], isoWithTime[2].padStart(2, '0'), isoWithTime[3].padStart(2, '0')];
  }

  // YYYY-MM-DD or YYYY/MM/DD (ISO date-only)
  const iso = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) {
    return [iso[1], iso[2].padStart(2, '0'), iso[3].padStart(2, '0')];
  }

  // MM-DD-YYYY or M-D-YYYY (US), or MM/DD/YYYY
  const us = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (us) {
    return [us[3], us[1].padStart(2, '0'), us[2].padStart(2, '0')];
  }

  return null;
}

/**
 * Normalizes a date string to ISO 8601 format with explicit time boundaries.
 *
 * Accepts various input formats (YYYY-MM-DD, MM-DD-YYYY, MM/DD/YYYY, etc.)
 * and returns a string:
 *   - `start` boundary:  YYYY-MM-DDT00:00:00Z
 *   - `end` boundary:    YYYY-MM-DDT23:59:59Z
 *
 * When a `TimeZoneProvider` is supplied, boundaries are calculated in the
 * configured timezone and converted to UTC, ensuring date-only inputs like
 * "2025-03-15" map to the correct UTC range for that timezone.
 *
 * If the input is already a full ISO 8601 timestamp (with time), it is
 * returned as-is — no boundary adjustment needed since a precise time
 * is already specified.
 *
 * @param dateStr  - Date string (e.g. "2025-01-01" or "2025-01-01T15:30:00Z")
 * @param boundary - "start" → beginning of day, "end" → end of day
 * @param tz       - Optional timezone provider for timezone-aware boundaries
 * @returns ISO 8601 string, or the original input if format is not recognised
 */
export function toISODateString(
  dateStr: string,
  boundary: 'start' | 'end',
  tz?: TimeZoneProvider
): string {
  // If the input is already a full timestamp with time, return as-is.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(dateStr.trim())) {
    return dateStr;
  }

  // If a timezone provider is given and the input is a date-only string,
  // use timezone-aware boundary calculation.
  if (tz && /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
    const d =
      boundary === 'start' ? tz.getStartOfDayBoundary(dateStr) : tz.getEndOfDayBoundary(dateStr);
    return d.toISOString();
  }

  const parts = extractDateParts(dateStr);

  if (!parts) {
    return dateStr;
  }

  const [yyyy, mm, dd] = parts;

  if (boundary === 'start') {
    return `${yyyy}-${mm}-${dd}T00:00:00Z`;
  }

  return `${yyyy}-${mm}-${dd}T23:59:59Z`;
}

/**
 * Builds a GitHub-compatible `created` filter from optional start/end dates.
 * Each date string is normalized to ISO 8601 (UTC) before joining with `..`.
 *
 * When a `TimeZoneProvider` is supplied, date-only inputs are interpreted in
 * the configured timezone before converting to UTC boundaries.
 *
 * Returns `undefined` when both dates are absent so the caller can omit the param.
 *
 * @param startDate - Start date string (optional)
 * @param endDate   - End date string (optional)
 * @param tz        - Optional timezone provider for timezone-aware boundaries
 * @returns A `created` filter string like ">2025-06-10T00:00:00Z",
 *          "2025-01-01T00:00:00Z..2026-01-06T23:59:59Z",
 *          or `undefined` if neither date is provided.
 */
export function buildCreatedFilter(
  startDate?: string,
  endDate?: string,
  tz?: TimeZoneProvider
): string | undefined {
  if (!startDate && !endDate) {
    return undefined;
  }

  if (startDate && endDate) {
    const start = toISODateString(startDate, 'start', tz);
    const end = toISODateString(endDate, 'end', tz);
    return `${start}..${end}`;
  }

  if (startDate) {
    const start = toISODateString(startDate, 'start', tz);
    return `>${start}`;
  }

  const end = toISODateString(endDate!, 'end', tz);
  return `<${end}`;
}
