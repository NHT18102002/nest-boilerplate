import type { ValueTransformer } from 'typeorm';
import type { Location } from '@/commons/interfaces/app.interface';

export const PointTransformer: ValueTransformer = {
  /**
   * Deserialize the value from the database.
   * PostgreSQL returns 'point' as a string like "(lng,lat)".
   */
  from: (value: unknown): Location | null => {
    if (!value) {
      return null;
    }
    if (typeof value === 'string') {
      // PostgreSQL returns point as "(lng,lat)"
      const match = value.match(/\(([^,]+),([^)]+)\)/);
      if (!match) {
        return null;
      }
      return {
        longitude: parseFloat(match[1]),
        latitude: parseFloat(match[2]),
      };
    }
    if (typeof value === 'object' && value !== null) {
      const obj = value as Record<string, unknown>;
      // Handle case where pg driver natively parsed it as {x, y} or it's from memory
      if ('x' in obj && 'y' in obj) {
        return {
          longitude: obj.x as number,
          latitude: obj.y as number,
        };
      }
      if ('longitude' in obj && 'latitude' in obj) {
        return {
          longitude: obj.longitude as number,
          latitude: obj.latitude as number,
        };
      }
    }
    return null;
  },

  /**
   * Serialize the value to the database.
   * PostgreSQL expects 'point' as a string like "(lng,lat)".
   */
  to: (value: Location | null): string | null => {
    if (!value) {
      return null;
    }
    return `(${value.longitude},${value.latitude})`;
  },
};
