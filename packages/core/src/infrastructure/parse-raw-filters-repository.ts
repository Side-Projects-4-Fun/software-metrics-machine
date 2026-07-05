export type RawFilter = {
  key: string;
  values: string[];
};

export abstract class ParseRawFiltersRepository {
  protected parseRawFilters(rawFilters?: string): RawFilter[] {
    if (!rawFilters) {
      return [];
    }

    return this.splitRawFilterEntries(rawFilters).reduce<RawFilter[]>((filters, entry) => {
      const trimmedEntry = entry.trim();
      if (!trimmedEntry) {
        return filters;
      }

      const separatorIndex = trimmedEntry.indexOf('=');
      if (separatorIndex <= 0) {
        return filters;
      }

      const key = trimmedEntry.slice(0, separatorIndex).trim();
      const value = trimmedEntry.slice(separatorIndex + 1).trim();
      if (!key || !value) {
        return filters;
      }

      filters.push({
        key,
        values: value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      });
      return filters;
    }, []);
  }

  protected matchesRawFilters(entity: unknown, rawFilters: RawFilter[]): boolean {
    return rawFilters.every((filter) => {
      const actualValues = this.collectRawFilterValues(entity, filter.key);
      if (actualValues.length === 0) {
        return false;
      }

      const expectedValues = filter.values.map((value) => value.toLowerCase());
      return actualValues.some((value) => expectedValues.includes(String(value).toLowerCase()));
    });
  }

  protected collectRawFilterValues(source: unknown, key: string): unknown[] {
    const segments = key
      .split('.')
      .map((segment) => segment.trim())
      .filter(Boolean);
    if (segments.length === 0) {
      return [];
    }

    return this.collectPathValues(source, segments);
  }

  private splitRawFilterEntries(rawFilters: string): string[] {
    if (rawFilters.includes('|')) {
      return rawFilters.split('|');
    }

    return rawFilters.split(/,(?=[^,|=]+=)/);
  }

  private collectPathValues(source: unknown, segments: string[]): unknown[] {
    if (source === undefined || source === null) {
      return [];
    }

    if (segments.length === 0) {
      return Array.isArray(source)
        ? source.flatMap((item) => this.collectPathValues(item, []))
        : [source];
    }

    if (Array.isArray(source)) {
      return source.flatMap((item) => this.collectPathValues(item, segments));
    }

    if (typeof source !== 'object') {
      return [];
    }

    const [segment, ...rest] = segments;
    const record = source as Record<string, unknown>;
    return this.keyVariants(segment).flatMap((variant) => {
      if (!Object.prototype.hasOwnProperty.call(record, variant)) {
        return [];
      }

      return this.collectPathValues(record[variant], rest);
    });
  }

  private keyVariants(key: string): string[] {
    return Array.from(new Set([key, this.toCamelCase(key), this.toSnakeCase(key)]));
  }

  private toCamelCase(value: string): string {
    return value.replace(/[_-]([a-zA-Z0-9])/g, (_, char: string) => char.toUpperCase());
  }

  private toSnakeCase(value: string): string {
    return value.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
  }
}
