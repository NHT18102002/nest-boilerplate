export const toArray = (value: unknown): string[] | undefined => {
  // 1) Handle empty input
  if (value === undefined || value === null) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  if (value === '') {
    return [];
  }
  if (typeof value === 'string') {
    // 2) Support JSON arrays and comma-delimited strings
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item));
      }
    } catch {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }
  }
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    // 3) Normalize primitive scalars
    return [String(value)];
  }
  return undefined;
};

export const toBoolean = (value: unknown): unknown => {
  // 1) Handle empty input
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  // 2) Normalize common truthy/falsey representations
  if (value === 'true' || value === true || value === 1 || value === '1') {
    return true;
  }
  if (value === 'false' || value === false || value === 0 || value === '0') {
    return false;
  }
  return value;
};

export const toNumber = (value: unknown): number | undefined => {
  // 1) Handle empty input
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  // 2) Convert to number for validation
  return Number(value);
};

export const parseBoolean = (value: unknown): boolean | undefined => {
  // 1) Handle empty input
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  // 2) Normalize common truthy/falsey representations
  if (value === 'true' || value === true || value === 1 || value === '1') {
    return true;
  }
  if (value === 'false' || value === false || value === 0 || value === '0') {
    return false;
  }
  return undefined;
};
