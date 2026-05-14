export function parseBooleanFlag(
  value: string | boolean | undefined | null,
  defaultValue = false,
): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value == null || value === '') {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}
