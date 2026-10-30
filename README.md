# Akshanet

[![Tests](https://img.shields.io/badge/tests-229%2B%20passing-brightgreen)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()

**APAAR ID-based student data management and verification platform for AICTE-approved technical institutions in India.**

> SIH26263 | Organization: AICTE | Theme: Smart Automation

## Architecture

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Institution  │  │  Student    │  │   AICTE     │  │  Employer   │
│   Portal     │  │    PWA      │  │  Dashboard  │  │   Portal    │
│  :3001       │  │  :3002      │  │  :3003      │  │  :3004      │
└──────┬───────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                 │                │                │
       └────────────┬────┴────────┬───────┘                │
                    │             │                         │
              ┌─────▼─────────────▼─────────────────────────▼──┐
              │              Nginx Reverse Proxy                │
              └──────────────────┬─────────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Express 5 API (:3000) │
                    │   JWT Auth · RBAC       │
                    │   State Machine         │
                    │   BullMQ Queues         │
                    └──┬──────┬──────┬────────┘
                       │      │      │
              ┌────────▼┐ ┌──▼────┐ ┌▼────────┐
              │Postgres │ │ Redis │ │  MinIO   │
              │  16     │ │   7   │ │ (S3)     │
              └─────────┘ └───────┘ └─────────┘
                       │
              ┌────────▼────────┐
              │  ML Service     │
              │  FastAPI :8000  │
              │  Anomaly Scoring│
              └─────────────────┘
```

## Key Features

- **APAAR ID as primary key** — 12-digit national academic identity for every student record
- **ELT Pipeline** — CSV upload → column mapping → validation → batch processing
- **17-state verification machine** — draft → submitted → verified → approved (with fraud/anomaly paths)
- **ML anomaly scoring** — real-time fraud detection via FastAPI microservice
- **Consent-based verification** — employers request student data access, students approve/deny
- **AICTE regulatory dashboard** — national overview, APH compliance checks, letter generation
- **Multi-tenant** — institution data isolated via JWT claims on every query

## Monorepo Structure

```
akshanet/
├── apps/
│   ├── api/              Express 5 + Prisma — backend microservices
│   ├── web/              React 18 + Vite — institution portal
│   ├── student-pwa/      React PWA — student mobile portal
│   ├── aicte-dashboard/  React — AICTE officer dashboard
│   ├── employer/         React — employer consent portal
│   ├── ml-service/       Python 3.11 + FastAPI — anomaly scoring
│   └── nginx/            Reverse proxy configuration
├── packages/
│   └── shared/           Zod schemas, state machine, types, constants
├── test/
│   ├── integration/      Smoke tests
│   └── fixtures/         Sample CSV data
├── docker-compose.yml
├── DEMO.md               Judge walkthrough
└── CLAUDE.md             AI agent instructions
```

## Quick Start

### Prerequisites

- Docker Desktop
- Node.js 18+ and pnpm 9+

### One-command launch

```bash
cp .env.example .env
docker compose up --build
```

### Seed demo data

```bash
docker compose exec api npx prisma db seed
```

### Access the portals

| Portal             | URL                  | Demo Login                |
| ------------------ | -------------------- | ------------------------- |
| Institution Portal | http://localhost:3001 | admin@demo-inst.ac.in     |
| Student PWA        | http://localhost:3002 | student@demo.in           |
| AICTE Dashboard    | http://localhost:3003 | officer@aicte.gov.in      |
| Employer Portal    | http://localhost:3004 | hr@demo-corp.com          |

> All demo accounts use OTP: `000000`

## Development

```bash
pnpm install
pnpm dev          # Start all services in dev mode
pnpm dev:api      # API only (port 3000)
pnpm dev:web      # Institution portal only (port 3000)
```

### Testing

```bash
pnpm --filter api test         # 229+ unit/integration tests
pnpm --filter api type-check   # TypeScript strict mode
pnpm --filter web test         # Institution portal tests
pnpm --filter student-pwa test # Student PWA tests
pnpm --filter aicte-dashboard test # AICTE dashboard tests
pnpm --filter employer test    # Employer portal tests
pnpm test:smoke                # Integration smoke tests (requires running services)
```

### Database

```bash
pnpm db:migrate   # Run Prisma migrations
pnpm db:generate  # Regenerate Prisma client
pnpm db:studio    # Open Prisma Studio GUI
```

## Security

- No raw Aadhaar/PII stored — SHA-256 hashes only
- JWT in httpOnly + Secure + SameSite=Strict cookies
- Multi-tenant isolation on every database query
- RBAC with role-based middleware on all protected routes
- Input validation via Zod schemas at API boundary

## Tech Stack

| Layer      | Technology                           |
| ---------- | ------------------------------------ |
| Frontend   | React 18, Vite 6, Tailwind CSS 3    |
| Backend    | Express 5, Prisma ORM, BullMQ       |
| Database   | PostgreSQL 16, Redis 7, MinIO       |
| ML         | Python 3.11, FastAPI, scikit-learn   |
| Infra      | Docker Compose, Nginx               |
| Testing    | Vitest, Testing Library, supertest   |
| Language   | TypeScript 5.7 (strict)             |

## License

MIT
