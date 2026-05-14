import type { TransformFnParams } from 'class-transformer';

type JsonParser<T> = (value: unknown) => T | null;

export const trimTransform = ({ value }: TransformFnParams): unknown => {
  if (typeof value === 'string') {
    return value.trim();
  }

  return value;
};

export const parseJsonTransform = <T>(parser: JsonParser<T>) => {
  return ({ value }: TransformFnParams): T | null => {
    if (value === null || value === undefined) {
      return null;
    }
    let parsed: unknown = value;
    if (typeof value === 'string') {
      try {
        parsed = JSON.parse(value) as unknown;
      } catch {
        return value as unknown as T;
      }
    }
    if (parsed !== null && typeof parsed === 'object') {
      return parser(parsed);
    }
    return parsed as T;
  };
};

export const emptyToUndefinedTransform = ({ value }: TransformFnParams): unknown => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (value === 'null') {
    return undefined;
  }
  return value;
};
