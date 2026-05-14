# Gym Management API

Base backend project built with NestJS 11 for the gym management domain.

This repository is intended to be used as a starting point for service-based backend development. It already includes the common foundation needed for a real API project: application bootstrap, configuration management, auth, shared guards/filters, database integration, file storage, mail integration, logging, Swagger docs, and a local-first development setup.

## What This Base Project Includes

- NestJS 11 application structure
- Config-driven environment setup with `@nestjs/config`
- JWT authentication with login and protected routes
- User registration flow with OTP verification
- TypeORM integration
- Local database mode with `sql.js` for development
- Optional PostgreSQL mode for server environments
- Redis service with in-memory fallback for local development
- Mail service with template support
- File storage service with:
  - local file storage for development
  - S3-compatible storage support for deployment
- Swagger UI at `/api/docs`
- Health check endpoint at `/api/health`
- Centralized logger, exception filters, guards, DTOs, and shared utilities

## Local Development Defaults

The project is currently configured to run locally with minimal external dependencies.

Default local behavior from `.env`:

- `DATABASE_DRIVER=sqljs`
- `REDIS_ENABLED=false`
- `MAIL_ENABLED=false`
- `STORAGE_DRIVER=local`

That means:

- data is stored in a local file database
- Redis is replaced by in-memory fallback
- OTP emails are not sent to a real mailbox
- uploaded files are written to the local `uploads/` folder

When `MAIL_ENABLED=false`, OTP is logged in the server console instead of being sent by SMTP.

## Project Structure

```text
src/
  app.module.ts          root Nest module
  main.ts                bootstrap entrypoint

  commons/               shared cross-cutting code
    constants/           app constants
    decorators/          route and request decorators
    docs/                Swagger helpers
    dtos/                shared DTOs
    entities/            shared base entities
    exceptions/          business and custom exceptions
    filters/             global exception filters
    guards/              auth and rate-limit guards
    interceptors/        response/request interceptors
    logger/              Winston-based logger
    middlewares/         app middlewares
    types/               shared typings

  database/              database config and providers

  modules/               business modules
    auth/                login and auth entities
    root/                health endpoint
    users/               profile, registration, avatar, OTP flow
    combine.module.ts    aggregates feature modules

  services/              infrastructure services
    mail/                mail transport and templates
    redis/               Redis wrapper and lock helpers
    storage/             file upload and storage abstraction

  utils/                 shared utility helpers
```

## Folder And File Responsibilities

### Root application files

- `src/main.ts`
  - application bootstrap entrypoint
  - starts Nest app
  - configures middleware, validation pipe, interceptors, Swagger, static assets, and listen port

- `src/app.module.ts`
  - root Nest module
  - wires global config, database, shared services, and combined feature modules
  - registers global guards and exception filters

- `src/modules/combine.module.ts`
  - central place to aggregate business modules
  - when adding a new feature module, this is usually where you import it

### `src/commons`

- `constants/`
  - app-wide constants such as prefixes, ports, shared values

- `decorators/`
  - reusable decorators like `@Public()`, `@CurrentUser()`, `@Roles()`, `@RateLimit()`

- `docs/`
  - Swagger helpers to keep controller documentation consistent

- `dtos/`
  - shared DTOs reused by multiple modules

- `entities/`
  - shared base entities such as the base model with `id`, `createdAt`, `updatedAt`

- `enums/`
  - shared enums like role, status, and app-level states

- `exceptions/`
  - business exceptions and custom error code mapping

- `filters/`
  - global exception handling and API error formatting

- `guards/`
  - JWT auth guard, role guard, rate-limit guard

- `interceptors/`
  - request/response transformation and enrichment

- `interfaces/`
  - shared TypeScript interfaces

- `logger/`
  - logging module and logger service

- `middlewares/`
  - middleware such as correlation ID and app-level request processing

- `types/`
  - shared application and Express typings

### `src/database`

- `database.config.ts`
  - maps environment variables into database configuration
  - supports both local `sqljs` mode and `postgres` mode

- `database.module.ts`
  - creates TypeORM connection
  - exposes DB providers to the app

- `database.service.ts`
  - thin wrapper around the data source

### `src/modules`

Each folder inside `src/modules` is a business feature module.

- `auth/`
  - `auth.module.ts`: registers auth-specific providers and JWT config
  - `auth.controller.ts`: auth endpoints such as login and current user
  - `auth.service.ts`: auth business logic
  - `dtos/`: request DTOs for auth endpoints
  - `entities/`: auth-related entities

- `users/`
  - `users.module.ts`: wires users feature dependencies
  - `users.controller.ts`: user-facing endpoints
  - `users.service.ts`: profile, avatar, registration, OTP, admin sync logic
  - `dtos/`: request/response DTOs for user flows

- `root/`
  - health and root-level public endpoints

### `src/services`

This layer contains infrastructure integrations that can be reused by many business modules.

- `services.module.ts`
  - shared infrastructure module aggregator

- `mail/`
  - `mail.module.ts`: mail provider configuration
  - `mail.service.ts`: send OTP, verification, password reset emails
  - `templates/`: Handlebars mail templates

- `redis/`
  - `redis.module.ts`: Redis provider registration
  - `redis.service.ts`: Redis abstraction with local in-memory fallback
  - `distributed-lock.service.ts`: lock helper built on top of Redis

- `storage/`
  - `storage.module.ts`: storage provider registration
  - `storage.service.ts`: file upload and storage logic
  - `storage.enums.ts`: storage path definitions
  - `entities/media.entity.ts`: media metadata model

- `kafka/`
  - legacy or optional integration folder if still present in the repository
  - not part of the active local bootstrap when it is not imported into `services.module.ts`

### `src/utils`

- generic helper functions
- keep utility logic here only if it is not business-specific and not tied to a single module

## How To Add A New Feature

Recommended flow when you want to add a new business function:

### 1. Create a new module folder

Example:

```text
src/modules/members/
  members.module.ts
  members.controller.ts
  members.service.ts
  dtos/
  entities/
```

### 2. Add the core files

- `*.module.ts`
  - wires dependencies for the feature
  - imports `TypeOrmModule.forFeature([...])` when using entities

- `*.controller.ts`
  - defines routes
  - should stay thin
  - delegates business logic to service

- `*.service.ts`
  - contains business logic
  - talks to repositories and shared services

- `dtos/`
  - define request validation and response shapes

- `entities/`
  - define database models for the feature when needed

### 3. Register the module

Import the new module into:

- `src/modules/combine.module.ts`

If the feature is infrastructure, put it under `src/services` and register it through:

- `src/services/services.module.ts`

### 4. Reuse shared base components

When building a new feature, prefer using existing shared layers instead of rewriting them:

- use `commons/decorators` for auth/public/current-user helpers
- use `commons/docs` for Swagger docs
- use `commons/exceptions` for business errors
- use `commons/guards` for auth/roles/rate-limit
- use `services/mail`, `services/redis`, `services/storage` for integrations

### 5. Expose API documentation

For each new controller method:

- add Swagger metadata with the existing `@Doc()` helper
- define DTOs clearly
- keep request/response contracts explicit

### 6. Add tests if the feature is important

Minimum recommendation:

- service-level unit tests for business logic
- e2e test when the endpoint is important or has auth/validation side effects

### 7. Update configuration only when needed

Only add new environment variables if the feature truly depends on external configuration.

Keep the base behavior:

- local mode should remain runnable with minimal setup
- production-only dependencies should stay optional and config-driven

## Current Functional Scope

At the moment, the base project already covers:

- login with JWT access token
- get current authenticated user
- register user with OTP verification flow
- resend OTP
- update user profile
- upload/update user avatar
- admin bootstrap from environment variables

This makes it suitable as a base for:

- gym/member management APIs
- internal admin backends
- service marketplaces with auth and media upload
- any NestJS project that needs a production-style foundation

## Getting Started

Install dependencies:

```bash
npm install
```

Start local development server:

```bash
npm run start:dev
```

Build the project:

```bash
npm run build
```

Run tests:

```bash
npm run test
npm run test:e2e
```

## Local URLs

- API: `http://localhost:3100`
- Swagger: `http://localhost:3100/api/docs`
- Health check: `http://localhost:3100/api/health`

## Environment Notes

Important variables in local mode:

- `APP_PORT`: application port
- `JWT_SECRET`: JWT signing secret
- `DATABASE_DRIVER`: `sqljs` or `postgres`
- `DATABASE_FILE`: local database file path when using `sqljs`
- `REDIS_ENABLED`: enable real Redis or use fallback
- `MAIL_ENABLED`: enable real SMTP or log OTP locally
- `STORAGE_DRIVER`: `local` or `s3`
- `LOCAL_STORAGE_PUBLIC_URL`: public base URL for local uploaded files

Default local database file:

```text
.data/gym-management.sqlite
```

Default local uploads folder:

```text
uploads/
```

## Optional Infrastructure for Deployment

The project still supports external infrastructure for non-local environments:

- PostgreSQL
- Redis
- SMTP mail server
- S3-compatible object storage
- OpenSearch
- Fluent Bit
- SeaweedFS

These services can be enabled through environment configuration and Docker Compose depending on the target environment.

## Docker

Start the bundled stack:

```bash
docker compose up -d --build
```

Main exposed ports in the compose setup:

- API: `3100`
- PostgreSQL host port: `5434`
- Redis host port: `6380`
- OpenSearch host port: `9201`
- OpenSearch Dashboards host port: `5602`
- SeaweedFS S3 host port: `8334`

## Notes for Extending the Base

Recommended extension pattern:

- add new business features under `src/modules`
- keep infrastructure code under `src/services`
- place shared cross-cutting logic under `src/commons`
- keep DTOs and response serialization explicit
- prefer config-driven behavior over hardcoded environment assumptions

If you want this base to behave more like production locally, switch the environment flags in `.env` and point them to real infrastructure.
