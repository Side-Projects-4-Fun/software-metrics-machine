export class TimeZoneProvider {
  readonly timezone: string;

  constructor(timezone: string = 'UTC') {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
    } catch {
      throw new Error(`Invalid IANA timezone identifier: "${timezone}"`);
    }
    this.timezone = timezone;
  }

  getDateKey(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-CA', { timeZone: this.timezone });
  }

  getMonthKey(date: string | Date): string {
    const key = this.getDateKey(date);
    return key.substring(0, 7);
  }

  getWeekKey(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;

    const parts = this.getDateParts(d);
    const { year, month, day } = parts;

    const localUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

    const dayOfWeek = localUtc.getUTCDay();
    const monday = new Date(localUtc);
    monday.setUTCDate(localUtc.getUTCDate() - ((dayOfWeek + 6) % 7));

    const thursday = new Date(monday);
    thursday.setUTCDate(monday.getUTCDate() + 3);
    const isoYear = thursday.getUTCFullYear();

    const jan4 = new Date(Date.UTC(isoYear, 0, 4, 12, 0, 0));
    const week1Monday = new Date(jan4);
    week1Monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));

    const weekNumber = Math.floor((monday.getTime() - week1Monday.getTime()) / 604800000) + 1;

    return `${isoYear}-W${String(weekNumber).padStart(2, '0')}`;
  }

  getIntervalKey(dateString: string | undefined, interval: 'day' | 'week' | 'month'): string {
    if (!dateString) return 'unknown';

    if (interval === 'day') return this.getDateKey(dateString);
    if (interval === 'month') return this.getMonthKey(dateString);
    return this.getWeekKey(dateString);
  }

  getStartOfDayBoundary(dateStr: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return new Date(dateStr);
    }

    const [year, month, day] = dateStr.split('-').map(Number);

    const noonUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const offsetMinutes = this.getUTCOffsetMinutes(noonUtc);

    const midnightUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
    return new Date(midnightUtc - offsetMinutes * 60 * 1000);
  }

  getEndOfDayBoundary(dateStr: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return new Date(dateStr);
    }

    const [year, month, day] = dateStr.split('-').map(Number);

    const noonUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const offsetMinutes = this.getUTCOffsetMinutes(noonUtc);

    const endOfDayUtc = Date.UTC(year, month - 1, day, 23, 59, 59, 999);
    return new Date(endOfDayUtc - offsetMinutes * 60 * 1000);
  }

  toUtcIsoFromWallTime(parts: {
    year: number;
    month: number;
    day: number;
    hours: number;
    minutes: number;
    seconds?: number;
  }): string {
    const seconds = parts.seconds ?? 0;
    const wallTimeAsUtc = Date.UTC(
      parts.year,
      parts.month,
      parts.day,
      parts.hours,
      parts.minutes,
      seconds
    );

    const firstGuess = new Date(wallTimeAsUtc);
    const firstOffset = this.getUTCOffsetMinutes(firstGuess);
    const adjusted = wallTimeAsUtc - firstOffset * 60 * 1000;
    const secondOffset = this.getUTCOffsetMinutes(new Date(adjusted));

    return new Date(wallTimeAsUtc - secondOffset * 60 * 1000).toISOString();
  }

  isSameDay(date1: string | Date, date2: string | Date): boolean {
    return this.getDateKey(date1) === this.getDateKey(date2);
  }

  private getDateParts(date: Date): { year: number; month: number; day: number } {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '01';
    return {
      year: Number(get('year')),
      month: Number(get('month')),
      day: Number(get('day')),
    };
  }

  private getUTCOffsetMinutes(date: Date): number {
    const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' });
    const tzStr = date.toLocaleString('en-US', { timeZone: this.timezone });
    const utcDate = new Date(utcStr);
    const tzDate = new Date(tzStr);
    return Math.round((tzDate.getTime() - utcDate.getTime()) / (1000 * 60));
  }
}
