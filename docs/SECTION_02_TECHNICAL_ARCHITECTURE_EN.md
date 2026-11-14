# Section 02 — Technical and Engineering Architecture

**Authoritative reference:** Section 2 of `docs/MASTER_REQUIREMENTS_EN.md`, read together with Section 1 and `docs/ARCHITECTURE_DECISIONS.md`.
**Purpose:** Establish an implementable, testable architecture; prevent documentation/code drift; distinguish implemented components from planned integrations.
**Evidence rule:** A dependency, configuration file, or architecture diagram does not prove that a service is integrated or production-ready.

## 1. Adopted architecture

The current system uses a **modular monolith**: one NestJS application organized into domain modules, one Flutter multiplatform client, and a central PostgreSQL database. Do not split into microservices without a demonstrated operational need. Module boundaries and internal contracts should permit future extraction without duplicating business rules.

System layers:
1. Client applications: Flutter/Dart for Android, iOS, and Flutter Web, with role- and viewport-aware responsive layouts.
2. Service API: NestJS REST API under `/api/v1`, with DTO validation and OpenAPI/Swagger.
3. Live events: Socket.IO/WebSocket for authorized events while a client is connected.
4. Durable data: PostgreSQL is the source of truth; transactions use a centralized connection layer.
5. Ephemeral data and jobs: Redis for ephemeral workloads and queues only after each integration is implemented and tested; it is never the sole durable record store.
6. Files: S3-compatible object storage with short-lived signed URLs when the file module is implemented; sensitive files must not be public.
7. External notifications: FCM for supported Android/web clients, APNs for iOS, and Web Push for supported browsers when integrated. WebSocket is not a Push substitute.
8. Operations: Docker/Compose for development and builds, and CI for change validation. Render is deferred to the final release gate; this section creates no production resources.

## 2. Actual repository decisions

| Area | Adopted decision | Evidence currently in the repository | Current boundary |
|---|---|---|---|
| Client | Flutter/Dart + Riverpod + GoRouter | `client/`, `pubspec.yaml`, Android/iOS/Web platform files | Platform folders do not prove real-device validation |
| Backend | NestJS + TypeScript modular monolith | `backend/src/app.module.ts` and domain modules | No separate service per domain without an ADR |
| API | Versioned REST at `/api/v1` with DTO validation | `main.ts`, Swagger, global ValidationPipe | OpenAPI must track every endpoint |
| Database | PostgreSQL via `pg` (node-postgres) | `DatabaseService`, Pool, explicit transactions | Prisma and TypeORM are not currently used |
| Schema changes | Numbered SQL migrations with SHA-256 checksums and advisory lock | `database/migrations/` and migration runner | Continue clean-database and existing-database upgrade tests |
| Cache/queue | Redis 7 and ioredis when needed | Redis service in Docker Compose and ioredis dependency | Do not claim queue guarantees before workers and tests exist |
| Realtime | Socket.IO through NestJS WebSocket Gateway | Dependencies and current event modules | Authentication, authorization, branch scoping, and reconnect behavior need proof |
| Files | S3-compatible object storage | Architecture decision only in this revision | No production storage integration is proven; never commit sensitive files |
| Push | FCM + APNs + Web Push | Requirements and architecture decision | No proof of delivery while the app is closed |
| Containers | Docker image and Docker Compose | `backend/Dockerfile` and `backend/docker-compose.yml` | A successful image build is not a production environment |
| CI | Backend, Flutter Web/Android, and test checks | GitHub Actions | iOS archive/device and real Push need separate validation |
| Hosting | Render as final hosting option | No deployment in this change | Deferred until security, acceptance, and owner approval |

## 3. Cross-layer integration contracts

- Protected requests pass authentication, permission, and server-side resource/branch-scope checks. Flutter route guards improve UX; they are not a security boundary.
- The server never treats client-supplied `company_id` or `branch_id` as trusted truth. Scope is derived from authenticated identity and memberships; resource ownership is checked in the service and transaction.
- The database uses appropriate FK, UNIQUE, CHECK constraints, and indexes, plus RLS or a proven equivalent within transaction scope before branch isolation can be marked complete.
- Multi-step operations use one PostgreSQL transaction; audit records are written in that transaction where required.
- Sensitive time comes from the server; timestamps use `timestamptz` and are displayed in `Asia/Amman`.
- JOD amounts use three decimal places and `NUMERIC`; floating-point arithmetic is prohibited for financial calculations.
- Every Socket.IO event verifies session identity, membership, permission, and room scope at connection and operation time; never trust a room name supplied by the client.
- Files are returned only after permission and branch-scope checks, using short-lived signed URLs. Do not use client-provided file names or paths directly on the filesystem.
- Offline operations remain pending and non-final until server confirmation, with an idempotency key and conflict policy. Do not enable offline operation for sensitive workflows before sync tests pass.
- Push requires delivery records, retry handling, invalid-token cleanup, and deduplication. WebSocket must never be described as a notification channel that works while the app is closed.

## 4. Platform boundaries

- Android: Debug/Release builds and permission, notification, and deep-link tests on appropriate devices/emulators.
- iOS: macOS build, Bundle ID and signing, APNs through the owner's account, and real-device validation. Flutter Analyze or Web success does not prove iOS readiness.
- Web: Release build and RTL/LTR, responsive layout, session handling, and Web Push tests in supported browsers.
- Tablet/Desktop: wide-layout and management-dashboard tests, not merely scaling a phone layout.
- Platform differences must be handled through documented adapters; never claim a capability unsupported on a given platform.

## 5. Security and operations

- Runtime secrets belong in environment variables/secret management, with separate development, staging, and production settings.
- TLS is mandatory outside localhost; CORS uses exact allowed origins; production security headers are enabled.
- Health endpoints distinguish liveness from readiness; readiness checks PostgreSQL and required dependencies.
- Structured logs must not contain passwords, tokens, or unnecessary personal data.
- Migrations are immutable after application; create a new migration instead of editing an applied one.
- The Docker runtime uses a non-root user, includes a healthcheck, and excludes secret environment files.
- Do not enable bulk delivery, real Push, or production deployment before integration tests, owner approval, and owner-provided accounts.

## 6. Section 02 acceptance gate

Section 02 cannot be marked complete until the applicable evidence exists:
1. Arabic and English architecture documentation matches code and ADR decisions.
2. Backend build/format/tests, Flutter analyze/tests, Web Release, and Android Debug pass on one identified commit.
3. iOS build/signing validation runs on macOS before iOS release support is claimed.
4. Migrations apply to a clean database and upgrade an existing database without data loss; backup/restore is tested.
5. API and WebSocket integration tests prove authentication, permissions, and branch scope.
6. Redis/Queue, S3, FCM/APNs/Web Push have real integration tests before any is claimed as integrated.
7. RTL/LTR and responsive behavior are tested on phone, tablet, and browser.
8. OpenAPI, ERD, and traceability are updated; CI evidence refers to the same SHA.
9. Environment configuration and rollback are documented; Render is not deployed at this gate.

## 7. Current status

**Status: Partial — core decisions are documented and parts of the architecture exist, but platform integrations, external services, and operational verification are incomplete.**

This section is not production-ready. Confirmed gaps include iOS validation on macOS and a real device, S3 integration, real Push delivery, proven queue workers, database isolation within transaction scope, and comprehensive cross-platform integration tests.

## 8. Change log

- 2026-11-14: Aligned architecture documentation with the actual implementation and selected PostgreSQL via `pg`, removing the inaccurate Prisma/TypeORM reference.
- 2026-11-14: Documented Redis, WebSocket, Push, S3, platform boundaries, and evidence-based acceptance criteria.
