import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  driver: 'postgres' | 'sqljs';
  host: string;
  username: string;
  password: string;
  port: number;
  database: string;
  ssl: boolean;
  file: string;
}

export default registerAs(
  'database',
  (): DatabaseConfig => ({
    driver:
      process.env.DATABASE_DRIVER?.toLowerCase() === 'sqljs'
        ? 'sqljs'
        : 'postgres',
    host: process.env.POSTGRES_HOST || 'localhost',
    username: process.env.POSTGRES_USERNAME || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'gym_management',
    ssl: process.env.POSTGRES_SSL === 'true',
    file: process.env.DATABASE_FILE || '.data/gym-management.sqlite',
  }),
);
