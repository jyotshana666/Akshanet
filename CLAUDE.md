# Akshanet — CLAUDE.md

## What This Project Is

Akshanet is an APAAR ID-based student data management and verification platform
for AICTE-approved technical institutions in India.
PS: SIH26263 | Org: AICTE | Theme: Smart Automation

The chain: Institution → Student → Validation Engine → AICTE → Regulatory Bodies → Employer

APAAR ID (12-digit national academic identity) is the PRIMARY KEY for every student record.
No student record is valid without a verified APAAR ID.

See @docs/architecture.md for system diagram.
See @docs/domain.md for full domain glossary.
See @AGENTS.md for multi-agent coordination rules.

## Monorepo Structure

```

akshanet/ ├── apps/ │   ├── api/            Node.js + Express 5 — backend microservices │   ├── web/            React 18 + Vite — institution + AICTE portal │   ├── student-pwa/    React PWA — student portal │   ├── employer/       React — employer portal │   └── ml-service/     Python 3.11 + FastAPI — anomaly scoring ├── packages/ │   └── shared/         Zod schemas, state machine, types, constants ├── docker-compose.yml └── CLAUDE.md
