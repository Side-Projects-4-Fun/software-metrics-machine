import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

export type CsvDelimiter = ',' | ';';

export function detectCsvDelimiter(headerLine: string): CsvDelimiter {
  const semicolons = (headerLine.match(/;/g) || []).length;
  const commas = (headerLine.match(/,/g) || []).length;
  return semicolons > commas ? ';' : ',';
}

export function parseCsvRows(
  content: string,
  options: { delimiter?: CsvDelimiter; trim?: boolean } = {}
): string[][] {
  return parse(content, {
    delimiter: options.delimiter ?? ',',
    bom: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: options.trim ?? false,
  }) as string[][];
}

export function parseCsvRecords(
  content: string,
  delimiter: CsvDelimiter = ','
): Array<Record<string, string>> {
  return parse(content, {
    delimiter,
    bom: true,
    columns: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<Record<string, string>>;
}

export function stringifyCsv(rows: string[][], eof = true): string {
  return stringify(rows, { eof });
}
