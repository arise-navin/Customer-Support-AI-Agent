# Signet Customer Support AI Agent Lab

[![Node.js](https://img.shields.io/badge/Node.js-v24.13.0-green.svg)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19.0.0-blue.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.3-blue.svg)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18.4-blue.svg)](https://www.postgresql.org)
[![Ollama](https://img.shields.io/badge/Ollama-beam%3Acloud-orange.svg)](https://ollama.com)
[![Vitest](https://img.shields.io/badge/Vitest-3.2.7-yellow.svg)](https://vitest.dev)
[![Tests Passing](https://img.shields.io/badge/Tests-48%2F48%20Passing-brightgreen.svg)](docs/STANDALONE_TEST_REPORT.md)

A complete, production-ready multi-agent Customer Support AI application built from scratch to demonstrate, benchmark, and validate autonomous customer support workflows and cryptographic AI governance with Signet.

---

## Architecture & Technology Stack

- **Monorepo:** Configured with `npm workspaces` (`apps/*`, `packages/*`).
- **Backend:** Fastify on Node.js 24+, TypeScript, Zod request/schema validation, Pino structured logging, Server-Sent Events (SSE).
- **Frontend:** React 19, Vite, Tailwind CSS, Lucide Icons, TanStack Query, Recharts, dark/light themes.
- **Database:** PostgreSQL 18+ via Prisma ORM and automated migrations.
- **Local AI Engine:** Ollama running `beam:cloud` (with native function calling, streaming tokens, and chain-of-thought thinking).
- **Four Autonomous AI Agents:**
  1. **Customer Support Assistant** (`support-agent-001`, Risk: T3)
  2. **Refund Specialist** (`refund-agent-002`, Risk: T2, Human-in-the-Loop)
  3. **Order Management Assistant** (`order-agent-003`, Risk: T2)
  4. **Escalation Coordinator** (`escalation-agent-004`, Risk: T2)
- **Signet Governance Layer:** Modular adapter layer supporting three execution modes:
  - `DIRECT_OLLAMA`: Standalone baseline without governance overhead.
  - `SIGNET_MOCK`: Offline deterministic policy and DLP simulation (`simulated: true`).
  - `SIGNET_REAL`: Live Signet Gateway integration with **strict fail-closed semantics** (zero silent fallback).

---

## Quick Start

### 1. Prerequisites
- Node.js 22+ (tested on Node.js v24.13.0)
- npm 10+
- Ollama running locally on port 11434 (`ollama serve`) with model `beam:cloud`
- Embedded PostgreSQL runner is provided out of the box (no Docker or administrative access required)

### 2. Setup & Installation
```bash
# Clone and enter workspace
git clone <repository_url>
cd "Customer Support AI Agent"

# Install all workspace dependencies
npm install

# Start embedded PostgreSQL daemon (background on port 5432)
npm run db:start

# Apply Prisma database migrations
npm run db:migrate

# Seed synthetic database (100 customers, 250 products, 500 orders, 100 tickets, 30 KB articles)
npm run db:seed
```

### 3. Launch Development Servers
```bash
# Start backend and frontend simultaneously
npm run dev
```

### 4. Access Points
- **Frontend SPA:** [http://localhost:5173](http://localhost:5173)
- **Backend REST API:** [http://localhost:3001/api/v1](http://localhost:3001/api/v1)
- **System Health Check:** [http://localhost:3001/api/v1/health](http://localhost:3001/api/v1/health)
- **Ollama Engine Health:** [http://localhost:3001/api/v1/ollama/health](http://localhost:3001/api/v1/ollama/health)

---

## Comprehensive Test Suites

Execute all 48 unit, integration, and security tests:

```bash
# Run all Vitest suites across monorepo
npx vitest run

# Run Phase 6 Standalone functional suite (ST-001 to ST-020)
npx vitest run tests/standalone.test.ts

# Run Phase 7 Signet Adapter acceptance suite
npx vitest run tests/phase7.test.ts

# Run Phase 8 Signet Governance & Security suite (SG-001 to SG-020)
npx vitest run tests/governance.test.ts
```

---

## Complete Project Documentation

Detailed technical documentation is maintained under the [`docs/`](docs/) directory:

- [**System Architecture (`docs/ARCHITECTURE.md`)**](docs/ARCHITECTURE.md): Multi-tier swarm orchestration, fail-closed gateway, and monorepo design.
- [**Database Schema (`docs/DATABASE_SCHEMA.md`)**](docs/DATABASE_SCHEMA.md): Complete PostgreSQL schema, entity relationships, indexes, and concurrency locks.
- [**AI Agent Design (`docs/AGENT_DESIGN.md`)**](docs/AGENT_DESIGN.md): Detailed personas, risk tiers, allowed tools, system prompts, and handoff sequences.
- [**Ollama Setup Guide (`docs/OLLAMA_SETUP.md`)**](docs/OLLAMA_SETUP.md): Local LLM daemon installation, model verification (`beam:cloud`), and timeouts.
- [**API Reference (`docs/API_REFERENCE.md`)**](docs/API_REFERENCE.md): REST endpoints, SSE streams, payload schemas, and headers.
- [**Standalone Test Report (`docs/STANDALONE_TEST_REPORT.md`)**](docs/STANDALONE_TEST_REPORT.md): Certified Phase 6 standalone checkpoint with baseline metrics.
- [**Signet Integration Guide (`docs/SIGNET_INTEGRATION.md`)**](docs/SIGNET_INTEGRATION.md): Gateway client, execution modes, workload certificates, and fail-closed rules.
- [**Signet Test Report (`docs/SIGNET_TEST_REPORT.md`)**](docs/SIGNET_TEST_REPORT.md): Certified Phase 8 governance report covering SG-001 through SG-020.
- [**Troubleshooting & Diagnostics (`docs/TROUBLESHOOTING.md`)**](docs/TROUBLESHOOTING.md): PostgreSQL port conflicts, encoding issues, kill switch recovery, and diagnostics.
