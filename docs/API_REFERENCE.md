# Fastify REST API Reference Specification

**Base URL:** `http://localhost:3001/api/v1`  
**Protocol:** HTTP/1.1 with JSON payloads & SSE streaming  
**Authentication:** Header `x-user-role` (`ADMIN` | `SUPERVISOR` | `AGENT` | `CUSTOMER`), `x-customer-id`  

---

## 1. System & Health

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Full system health check (API, PostgreSQL, Ollama) |
| `GET` | `/dashboard/metrics` | Live operational and governance metrics for UI dashboard |

---

## 2. Customer Domain

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/customers` | List customers with search, pagination, and tier filtering |
| `GET` | `/customers/:id` | Retrieve customer profile and delivery addresses |

---

## 3. Orders & Logistics

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/orders` | List customer orders (strictly isolated by customer ownership) |
| `GET` | `/orders/:id` | Order details with line items and payment records |
| `GET` | `/orders/:id/tracking` | Carrier shipment checkpoints and milestone tracking |

---

## 4. Financial Returns & Approvals

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/refunds` | List refund requests with optional status filter |
| `POST` | `/refunds/request` | Submit new refund request (atomic concurrency control) |
| `POST` | `/refunds/:id/approve` | Supervisor authorization and simulated payment release |
| `POST` | `/refunds/:id/reject` | Supervisor rejection with audited justification |

---

## 5. Support Tickets & Knowledge Base

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/tickets` | List support tickets with priority and status filters |
| `POST` | `/tickets` | Create a new formal support ticket |
| `PATCH` | `/tickets/:id` | Update ticket status, priority, or assigned agent |
| `GET` | `/knowledge-base` | List published store articles and FAQs |
| `GET` | `/knowledge-base/search`| Search policies by keyword and category |

---

## 6. Multi-Agent Swarm & Chat

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/agents` | List the four autonomous agent personas and permissions |
| `GET` | `/agents/:id` | Retrieve individual agent configuration |
| `POST` | `/agents/:id/run` | Execute direct prompt on specific agent |
| `PATCH` | `/agents/:id/status` | Update agent status (`ACTIVE`, `QUARANTINED`, `KILLED`) |
| `POST` | `/chat/message` | Send message to Agent Orchestrator with auto-handoff |
| `GET` | `/chat/conversations` | Retrieve customer conversation history |

---

## 7. Signet AI Governance & Test Lab

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/signet/config` | Read active execution mode, gateway URL, and certificates |
| `PATCH`| `/signet/config` | Switch mode (`DIRECT_OLLAMA`, `SIGNET_MOCK`, `SIGNET_REAL`) |
| `GET` | `/signet/status` | Real-time connectivity and latency probe |
| `GET` | `/signet/certificates` | List agent cryptographic workload certificates |
| `PATCH`| `/signet/certificates/:agentId/status` | Update certificate status for simulation tests |
| `POST` | `/signet/decide` | Direct invocation of `/v1/decide` policy evaluation |
| `POST` | `/signet/kill-switch` | Instant agent termination with measured propagation |
| `GET` | `/signet/governance-scenarios` | Run and inspect matrix of all 20 governance scenarios |
| `POST` | `/signet/run-scenario` | Execute specific scenario (`SG-001` to `SG-020`) |
| `GET` | `/signet/dlp-events` | Stream of sensitive data redactions and card masks |
| `GET` | `/signet/evidence` | Multi-tier cryptographic evidence ledger |
