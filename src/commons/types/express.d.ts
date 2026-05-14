import 'express';
import type { User } from '@/modules/auth/entities/user.entity';

declare global {
  namespace Express {
    interface Request {
      /** Unique correlation ID for tracing requests across logs */
      correlationId: string;

      /** Authenticated user info (populated by auth guard) */
      user?: User;

      /** Rate limit info (populated by rate limit guard) */
      rateLimit?: {
        limit: number;
        current: number;
        remaining: number;
        resetTime: number;
      };
    }
  }
}

export {};
