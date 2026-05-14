import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseService } from './database.service';
import { ConfigService } from '@nestjs/config';
import { DatabaseConfig } from './database.config';
import * as fs from 'fs';
import * as path from 'path';

import { Pool } from 'pg';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbConfig = configService.get<DatabaseConfig>('database');
        if (!dbConfig) {
          throw new Error('Database configuration is missing');
        }

        if (dbConfig.driver === 'sqljs') {
          const databaseFile = path.resolve(process.cwd(), dbConfig.file);
          fs.mkdirSync(path.dirname(databaseFile), { recursive: true });

          return {
            type: 'sqljs' as const,
            location: databaseFile,
            autoSave: true,
            entities: [__dirname + '/../**/**/*.entity{.ts,.js}'],
            synchronize: configService.get<string>('NODE_ENV') !== 'production',
          };
        }

        return {
          type: 'postgres',
          host: dbConfig.host,
          port: dbConfig.port,
          username: dbConfig.username,
          password: dbConfig.password,
          database: dbConfig.database,
          ssl: dbConfig.ssl,
          entities: [__dirname + '/../**/**/*.entity{.ts,.js}'],
          synchronize: configService.get<string>('NODE_ENV') !== 'production',
        };
      },
    }),
  ],
  providers: [
    DatabaseService,
    {
      provide: 'PG_POOL',
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Pool | null => {
        const dbConfig = configService.get<DatabaseConfig>('database');
        if (!dbConfig) {
          throw new Error('Database configuration is missing');
        }

        if (dbConfig.driver !== 'postgres') {
          return null;
        }

        return new Pool({
          host: dbConfig.host,
          port: dbConfig.port,
          user: dbConfig.username,
          password: dbConfig.password,
          database: dbConfig.database,
          ssl: dbConfig.ssl,
        });
      },
    },
  ],
  exports: [DatabaseService, 'PG_POOL'],
})
export class DatabaseModule {}
