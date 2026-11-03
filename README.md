# Customer Support AI Agents

Four agents run directly against Ollama: Customer Support Assistant, Refund Specialist, Order Management Assistant, and Escalation Coordinator. PostgreSQL stores the existing customers, orders, payments, refunds, tickets, conversations, agent state, and execution logs.

Use Node.js 22+ and npm. Run `npm install`, then `npm run dev`. The frontend runs at http://localhost:5173 and the backend at http://localhost:3001/api/v1. Configure `DATABASE_URL`, `API_SECRET_KEY`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, and, when needed, `OLLAMA_API_KEY` in `.env`. Existing database configuration and data are retained; do not reseed an existing database. For a new database, use `npm run db:migrate` followed by `npm run db:seed`.

Sign in with the existing admin login. The agent dashboard includes run, tracking, pause, stop, and activation controls. External clients use the same REST API with the `x-api-key` header set to `API_SECRET_KEY`. Endpoint payloads and behavior are defined in [agentRoutes](apps/backend/src/routes/agents.ts).

Pause and stop cancel current model requests and prevent subsequent tool calls and new requests. A tool operation already submitted can finish; its effects are not rolled back. Activation permits new requests; it does not resume a cancelled execution. State is checked in PostgreSQL before model/tool operations and every 250 ms during inference. Existing database columns are retained for compatibility, including historical execution metadata. No gateway or governance service is required.

Run `npm run build`, `npm test`, and `npm run test:e2e` to verify the application. Integration tests use the configured PostgreSQL and Ollama services and may create business records. The browser authentication test requires the running frontend and backend.
