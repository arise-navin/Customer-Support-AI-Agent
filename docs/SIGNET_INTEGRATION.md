# Signet Gateway Integration & Adapter Specification

**Integration Spec:** Signet Product & Engineering Blueprint  
**Package:** `@signet/signet-adapter`  
**Configuration Flag:** `AI_EXECUTION_MODE` (`DIRECT_OLLAMA` | `SIGNET_MOCK` | `SIGNET_REAL`)  

---

## 1. Adapter Architecture Overview

The Signet integration is built as a decoupled adapter layer around the application's core business logic and four autonomous agents. Neither the database models nor the customer support workflow logic are altered when governance is toggled.

```
+-------------------------------------------------------------+
|                     Fastify Backend API                     |
|                                                             |
|   +-----------------------------------------------------+   |
|   |                  AgentRunner                        |   |
|   +-----------------------------------------------------+   |
|                              |                              |
|                              v                              |
|   +-----------------------------------------------------+   |
|   |              SignetAdapterManager                   |   |
|   +-----------------------------------------------------+   |
|             |                     |                 |       |
|             v                     v                 v       |
|    [DirectOllamaAdapter]  [MockSignetAdapter] [RealSignetAdapter]
|             |                     |                 |       |
|             v                     v                 v       |
|       Local Ollama          Deterministic    Signet Gateway |
|       (beam:cloud)           Simulation      (/v1/decide)   |
+-------------------------------------------------------------+
```

---

## 2. Execution Modes

### Mode 1: DIRECT_OLLAMA
- Bypasses Signet Gateway.
- All requests run against local Ollama directly.
- Used to establish clean latency and error rate baselines.

### Mode 2: SIGNET_MOCK
- Deterministically evaluates policy rules, DLP signatures, rate limits, and certificate states.
- All responses are explicitly flagged with `simulated: true` and `source: 'SIGNET_MOCK'`.
- Produces valid simulation evidence tokens (`ev-sgn-mock-...`).

### Mode 3: SIGNET_REAL
- All model and tool traffic proxies through the live Signet Gateway at `SIGNET_GATEWAY_URL`.
- Attaches cryptographic certificate headers:
  - `x-signet-agent-cert`: Agent certificate ID
  - `x-signet-workload-id`: SPIFFE identity URI
  - `x-signet-tenant-id`: Tenant identifier
- **Critical Policy:** **Fail-Closed**. In the event of gateway network timeouts, HTTP 502/503 errors, or malformed responses, the request fails immediately. **Direct Ollama fallback is strictly forbidden.**

---

## 3. Cryptographic Agent Certificate Mappings

```json
{
  "support-agent-001": {
    "workloadIdentity": "spiffe://signet.internal/ns/support/sa/support-agent-001",
    "certificateId": "cert-sgn-support-001-v1",
    "riskTier": "T3",
    "autonomyLevel": "L2",
    "allowedModel": "beam:cloud",
    "allowedTools": ["get_customer_profile", "get_order_status", "search_knowledge_base", "create_support_ticket"],
    "dataClasses": ["PUBLIC_KB", "CUSTOMER_BASIC", "ORDER_STATUS"],
    "limits": { "maxRequestsPerMinute": 60, "maxTokensPerTurn": 4096 }
  },
  "refund-agent-002": {
    "workloadIdentity": "spiffe://signet.internal/ns/finance/sa/refund-agent-002",
    "certificateId": "cert-sgn-refund-002-v1",
    "riskTier": "T2",
    "autonomyLevel": "L1",
    "allowedModel": "beam:cloud",
    "allowedTools": ["get_payment_status", "check_refund_eligibility", "calculate_refund", "create_refund_request", "execute_approved_refund"],
    "dataClasses": ["FINANCIAL_DATA", "PAYMENT_RECORDS", "CUSTOMER_BILLING"],
    "limits": { "maxRequestsPerMinute": 30, "maxTokensPerTurn": 4096 }
  },
  "order-agent-003": {
    "workloadIdentity": "spiffe://signet.internal/ns/logistics/sa/order-agent-003",
    "certificateId": "cert-sgn-order-003-v1",
    "riskTier": "T2",
    "autonomyLevel": "L2",
    "allowedModel": "beam:cloud",
    "allowedTools": ["get_order_details", "track_shipment", "request_order_cancellation", "update_delivery_preference"],
    "dataClasses": ["ORDER_DETAILS", "SHIPPING_CARRIER_DATA"],
    "limits": { "maxRequestsPerMinute": 45, "maxTokensPerTurn": 4096 }
  },
  "escalation-agent-004": {
    "workloadIdentity": "spiffe://signet.internal/ns/security/sa/escalation-agent-004",
    "certificateId": "cert-sgn-escalation-004-v1",
    "riskTier": "T2",
    "autonomyLevel": "L2",
    "allowedModel": "beam:cloud",
    "allowedTools": ["create_escalation", "create_security_incident", "request_supervisor_review", "get_ticket_history"],
    "dataClasses": ["SECURITY_INCIDENTS", "TICKET_AUDIT", "ESCALATIONS"],
    "limits": { "maxRequestsPerMinute": 30, "maxTokensPerTurn": 4096 }
  }
}
```

---

## 4. Gateway Endpoint Compatibility

The adapter integrates with the five blueprint endpoints:

1. **`GET /v1/health`:** Heartbeat and latency verification.
2. **`POST /v1/decide`:** Evaluates agent certificate, tool permissions, DLP signatures, and risk policies.
3. **`POST /v1/llm/openai/chat/completions`:** Proxies LLM generation with input/output guardrails.
4. **`POST /v1/tools/http/:tool`:** Invokes external HTTP tools under Signet supervision.
5. **`POST /v1/a2a/:agentId`:** Enforces agent-to-agent delegation boundaries.
