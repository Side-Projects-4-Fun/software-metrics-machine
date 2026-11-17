import type { TimeZoneProvider } from '../../infrastructure/timezone-provider';

function extractDateParts(dateStr: string): [string, string, string] | null {
  const trimmed = dateStr.trim();

  const isoWithTime = trimmed.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/
  );
  if (isoWithTime) {
    return [isoWithTime[1], isoWithTime[2].padStart(2, '0'), isoWithTime[3].padStart(2, '0')];
  }

  const iso = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) {
    return [iso[1], iso[2].padStart(2, '0'), iso[3].padStart(2, '0')];
  }

  const us = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (us) {
    return [us[3], us[1].padStart(2, '0'), us[2].padStart(2, '0')];
  }

  return null;
}

export function toISODateString(
  dateStr: string,
  boundary: 'start' | 'end',
  tz?: TimeZoneProvider
): string {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(dateStr.trim())) {
    return dateStr;
  }

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
