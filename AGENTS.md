# Akshanet — AGENTS.md

This file defines how multiple Claude Code agents should divide and coordinate work
on this project. Each agent should claim one workstream and not modify files owned
by another agent without explicit coordination.

## Workstream Ownership

| Agent | Workstream | Files Owned |
| --- | --- | --- |
| Agent-Auth | Auth + Security | apps/api/src/services/auth/, apps/api/src/middleware/, apps/api/src/lib/jwt.ts |
| Agent-Upload | ELT Pipeline | apps/api/src/services/upload/, apps/web/src/pages/institution/upload/ |
| Agent-Validation | APAAR + Duplicate + Intake | apps/api/src/services/apaar/, apps/api/src/lib/apaar.ts, apps/api/src/lib/stateMachine.ts |
| Agent-Student | Student portal + Consent | apps/student-pwa/, apps/api/src/services/student/ |
| Agent-AICTE | AICTE dashboard + Approvals | apps/web/src/pages/aicte/, apps/api/src/services/aicte/ |
| Agent-ML | Anomaly + Fraud scoring | apps/ml-service/, apps/api/src/lib/mlClient.ts |

## Shared Files — Coordinate Before Editing

These files are shared. If you need to change them, announce in a comment at top of task:
- packages/shared/src/schema/ — announce schema change, rebuild shared after
- apps/api/prisma/schema.prisma — coordinate migrations, never two agents migrate simultaneously
- apps/api/src/lib/audit.ts — read-only for all agents; only Agent-Auth may modify
- docker-compose.yml — only Agent-Auth / DevOps agent modifies

## Coordination Rules

1. Never create a new Zod schema locally. Add to packages/shared/src/schema/ and rebuild.
2. Never change the state machine constants in packages/shared/src/states.ts without
   notifying all agents — every service depends on these.
3. DB migrations: only one agent runs `prisma migrate dev` at a time.
   After migration: commit migration file immediately before any other agent runs.
4. If you add a new BullMQ queue: register it in /apps/api/src/lib/queues.ts (central registry).
5. If you add a new API route: update /docs/api.md with the route, method, auth, body, response.

## Task Handoff Protocol

When finishing a task that another agent depends on:
1. Write a comment at the top of the relevant file: `// READY: <what is available>`
2. Run tests for your workstream: `pnpm --filter api test --testPathPattern=<service>`
3. Commit with: `feat(<workstream>): <description> [ready-for:<next-agent>]`

## Testing Before Handoff

Each agent must pass before marking ready:
- Unit tests for all service functions written
- API routes tested with supertest
- No TypeScript errors: `pnpm --filter api type-check`
- No lint errors: `pnpm lint`
