import { NestFactory, Reflector } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import {
  ClassSerializerInterceptor,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import * as compression from 'compression';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

import {
  API_GLOBAL_PREFIX,
  APP_NAME,
  DEFAULT_PORT,
} from './commons/constants/app.constants';
import * as path from 'path';
import * as fs from 'fs';
import { LoggerService } from './commons/logger/logger.service';
import { correlationIdMiddleware } from './commons/middlewares/correlation-id.middleware';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(LoggerService));
  app.set('query parser', 'extended');

  // Configure CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Register correlation ID middleware - Must be before all other middleware for proper tracking
  app.use(correlationIdMiddleware);

  // Configure global guards
  const reflector = app.get<Reflector>(Reflector);

  // Configure cookie parser
  app.use(cookieParser());
  // Compress responses
  app.use(compression());
  // Configure global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  // Configure global interceptors
  app.useGlobalInterceptors(new ClassSerializerInterceptor(reflector));
  // Configure global prefix
  app.setGlobalPrefix(API_GLOBAL_PREFIX, {
    exclude: ['/'],
  });

  // Show Swagger UI in development: http://localhost:3000/api/docs
  const config = new DocumentBuilder()
    .setTitle(APP_NAME)
    .setDescription('API documentation for the Gym Management backend.')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'bearer',
    )
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`${API_GLOBAL_PREFIX}/docs`, app, documentFactory, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const pathOutputOpenApi = './open-api.json';

  // Create directory if it doesn't exist
  const directoryPath = path.dirname(pathOutputOpenApi);
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }

  fs.writeFileSync(pathOutputOpenApi, JSON.stringify(documentFactory()));

  const configService = app.get(ConfigService);
  const storageDriver = configService
    .get<string>('STORAGE_DRIVER', 's3')
    ?.toLowerCase();

  if (storageDriver === 'local') {
    app.useStaticAssets(path.join(process.cwd(), 'uploads'), {
      prefix: '/uploads/',
    });
  }

  const port = configService.get<number>('APP_PORT') ?? DEFAULT_PORT;
  await app.listen(port);
  const logger = new Logger('Application');
  logger.log(`Application is running on url http://localhost:${port}`);
}
void bootstrap();
