class TypedDictEncoder {
  encode(value: unknown): string {
    return JSON.stringify(value, this.replacer.bind(this), 2);
  }

  private replacer(_key: string, value: unknown): unknown {
    if (typeof value === 'number') {
      if (!isFinite(value)) {
        return null;
      }
    }
    return value;
  }
}

export function asJsonString(object: unknown): string {
  const encoder = new TypedDictEncoder();
  return encoder.encode(object);
}

export function parseJson<T = unknown>(json: string): T {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    throw new Error(
      `Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return JSON.stringify(
      {
        error: 'Failed to serialize',
        message: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    );
  }
}
