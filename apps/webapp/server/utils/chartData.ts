type WrappedResult = {
  result: unknown;
};

function hasWrappedResult(data: unknown): data is WrappedResult {
  return typeof data === 'object' && data !== null && 'result' in data;
}

export function ensureArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) {
    return data;
  }
  if (hasWrappedResult(data)) {
    if (Array.isArray(data.result)) {
      return data.result;
    }

    return Array.isArray(data.result) ? data.result : [];
  }
  if (data === null || data === undefined) {
    return [];
  }

  return [];
}
