import { format, parseISO } from 'date-fns';

export function datetimeToLocal(date: string): string {
  try {
    const dt = parseISO(date);
    return format(dt, 'dd MMM yyyy, HH:mm');
  } catch (error) {
    console.warn(`Failed to parse date: ${date}`, error);
    return date;
  }
}

export function getCurrentDateISO(): string {
  return new Date().toISOString();
}

export function parseISODate(date: string): Date {
  return parseISO(date);
}

export function formatToISO(date: Date): string {
  return date.toISOString();
}
