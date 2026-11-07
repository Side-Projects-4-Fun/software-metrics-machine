import type { TimeZoneProvider } from '../../infrastructure/timezone-provider';

export type JiraCsvComment = {
  createdAt: string;
  author?: string;
  body: string;
};

export type JiraCsvRecord = {
  key: string;
  id: string;
  title: string;
  description?: string;
  status: string;
  assignee?: string;
  createdAt: string;
  updatedAt?: string;
  closedAt?: string;
  labels: string[];
  issueType?: string;
  projectKey?: string;
  comments: JiraCsvComment[];
};

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

/**
 * Parses a Jira CSV export into rows of cells.
 *
 * Supports quoted fields, escaped quotes (`""`) and embedded newlines. The
 * export contains duplicate headers (`Labels`, `Comment`), so callers must
 * address columns by index rather than by object keys.
 */
export function parseCsv(content: string): string[][] {
  const text = content.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let index = 0;

  while (index < text.length) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        inQuotes = false;
        index += 1;
        continue;
      }

      if (char === '\r' && text[index + 1] === '\n') {
        field += '\n';
        index += 2;
        continue;
      }

      field += char;
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      index += 1;
      continue;
    }

    if (char === ',') {
      row.push(field);
      field = '';
      index += 1;
      continue;
    }

    if (char === '\r') {
      index += 1;
      continue;
    }

    if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      index += 1;
      continue;
    }

    field += char;
    index += 1;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/**
 * Parses the date format used by Jira CSV exports, e.g. `09/Oct/26 12:15 PM`.
 *
 * CSV timestamps carry no timezone. When a `TimeZoneProvider` is supplied, the
 * wall-clock value is interpreted in that timezone; otherwise UTC is used.
 * ISO-like values with an explicit offset are accepted as a fallback.
 */
export function parseJiraCsvDate(
  value: string,
  timeZoneProvider?: TimeZoneProvider
): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const match = trimmed.match(
    /^(\d{1,2})\/([A-Za-z]{3})\/(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i
  );

  if (!match) {
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }

  const day = Number(match[1]);
  const month = MONTHS[match[2].toLowerCase()];
  const rawYear = Number(match[3]);
  const year = match[3].length === 2 ? (rawYear < 70 ? 2000 + rawYear : 1900 + rawYear) : rawYear;
  const minutes = Number(match[5]);
  const seconds = match[6] ? Number(match[6]) : 0;
  const meridiem = match[7]?.toUpperCase();

  let hours = Number(match[4]);
  if (meridiem === 'AM' && hours === 12) {
    hours = 0;
  } else if (meridiem === 'PM' && hours !== 12) {
    hours += 12;
  }

  if (
    month === undefined ||
    day < 1 ||
    day > 31 ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return undefined;
  }

  const wallTimeAsUtc = new Date(Date.UTC(year, month, day, hours, minutes, seconds));
  if (
    Number.isNaN(wallTimeAsUtc.getTime()) ||
    wallTimeAsUtc.getUTCFullYear() !== year ||
    wallTimeAsUtc.getUTCMonth() !== month ||
    wallTimeAsUtc.getUTCDate() !== day
  ) {
    return undefined;
  }

  if (timeZoneProvider) {
    return timeZoneProvider.toUtcIsoFromWallTime({
      year,
      month,
      day,
      hours,
      minutes,
      seconds,
    });
  }

  return wallTimeAsUtc.toISOString();
}

function buildHeaderIndex(header: string[]): Map<string, number[]> {
  const indexes = new Map<string, number[]>();

  header.forEach((name, index) => {
    const key = name.trim();
    const existing = indexes.get(key) ?? [];
    existing.push(index);
    indexes.set(key, existing);
  });

  return indexes;
}

function readCell(row: string[], header: Map<string, number[]>, name: string): string {
  const index = header.get(name)?.[0];
  return index === undefined ? '' : (row[index] ?? '').trim();
}

function readCells(row: string[], header: Map<string, number[]>, name: string): string[] {
  return (header.get(name) ?? [])
    .map((index) => (row[index] ?? '').trim())
    .filter((value) => value.length > 0);
}

function parseComment(
  value: string,
  timeZoneProvider?: TimeZoneProvider
): JiraCsvComment | undefined {
  const firstSeparator = value.indexOf(';');
  const secondSeparator = value.indexOf(';', firstSeparator + 1);

  if (firstSeparator < 0 || secondSeparator < 0) {
    return undefined;
  }

  const createdAt = parseJiraCsvDate(value.slice(0, firstSeparator), timeZoneProvider);
  if (!createdAt) {
    return undefined;
  }

  const author = value.slice(firstSeparator + 1, secondSeparator).trim();

  return {
    createdAt,
    author: author || undefined,
    body: value.slice(secondSeparator + 1).trim(),
  };
}

/**
 * Maps a Jira CSV export into provider-neutral issue records.
 *
 * The export repeats `Labels` and `Comment` headers; every occurrence is read
 * so issues with multiple labels or comments are preserved. When a
 * `TimeZoneProvider` is supplied, timestamp columns are interpreted in that
 * timezone.
 */
export function parseJiraCsv(
  content: string,
  timeZoneProvider?: TimeZoneProvider
): JiraCsvRecord[] {
  const rows = parseCsv(content);
  if (rows.length === 0) {
    return [];
  }

  const header = buildHeaderIndex(rows[0]);

  return rows
    .slice(1)
    .filter((row) => row.some((cell) => cell.trim().length > 0))
    .map((row) => {
      const key = readCell(row, header, 'Issue key');
      const labels = readCells(row, header, 'Labels')
        .flatMap((value) => value.split(','))
        .map((label) => label.trim())
        .filter((label) => label.length > 0);

      const comments = readCells(row, header, 'Comment')
        .map((value) => parseComment(value, timeZoneProvider))
        .filter((comment): comment is JiraCsvComment => comment !== undefined);

      return {
        key,
        id: key,
        title: readCell(row, header, 'Summary'),
        description: readCell(row, header, 'Description') || undefined,
        status: readCell(row, header, 'Status') || 'UNKNOWN',
        assignee: readCell(row, header, 'Assignee') || 'Unassigned',
        createdAt: parseJiraCsvDate(readCell(row, header, 'Created'), timeZoneProvider) ?? '',
        updatedAt: parseJiraCsvDate(readCell(row, header, 'Updated'), timeZoneProvider),
        closedAt: parseJiraCsvDate(readCell(row, header, 'Resolved'), timeZoneProvider),
        labels,
        issueType: readCell(row, header, 'Issue Type') || undefined,
        projectKey: readCell(row, header, 'Project key') || undefined,
        comments,
      };
    })
    .filter((record) => record.key.length > 0);
}
