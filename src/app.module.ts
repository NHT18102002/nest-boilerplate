import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { resolve } from 'path';

import { LoggerModule } from './commons/logger/logger.module';
import {
  AllExceptionsFilter,
  CustomExceptionFilter,
  HttpExceptionFilter,
} from './commons/filters';
import { CustomRateLimitGuard } from './commons/guards/rate-limit.guard';
import { DatabaseModule } from './database/database.module';
import databaseConfig from './database/database.config';
import { CombineModule } from './modules/combine.module';
import { ServicesModule } from './services/services.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: resolve(__dirname, '..', '.env'),
      isGlobal: true,
      load: [databaseConfig],
    }),
    LoggerModule,
    DatabaseModule,
    ServicesModule,
    CombineModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: CustomRateLimitGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: CustomExceptionFilter,
    },
  ],
})
export class AppModule {}
