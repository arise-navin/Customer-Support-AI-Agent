# PostgreSQL Database Schema & Relational Model

**Database Engine:** PostgreSQL 16+ (running on embedded PostgreSQL 18.4)  
**ORM:** Prisma Client with declarative migrations  
**Primary Keys:** Universally Unique Identifiers (UUID v4)  
**Isolation:** Multi-tenant support via `tenantId` across all entities  

---

## 1. Entity Relationship Overview

The schema is partitioned into seven logical domains:

1. **Authentication & Identity:** `User`, `Role`, `UserSession`
2. **Customer Domain:** `Customer`, `CustomerAddress`
3. **Product Catalog:** `ProductCategory`, `Product`
4. **Order & Logistics:** `Order`, `OrderItem`, `Shipment`
5. **Billing & Financials:** `Payment`, `RefundRequest`, `Refund`
6. **Support & Knowledge:** `SupportTicket`, `TicketMessage`, `KnowledgeBaseArticle`
7. **AI Agent Operations & Audit:** `AiAgent`, `AgentConfiguration`, `AgentToolPermission`, `AgentExecution`, `AgentToolCall`, `Conversation`, `ConversationMessage`, `AgentHandoff`, `ToolExecutionLog`, `ApplicationAuditLog`

---

## 2. Table Specifications

### Customers & Addresses
- **`customers`:** Primary customer identity. Fields: `id`, `tenantId`, `email`, `fullName`, `phone`, `tier` (`STANDARD` | `SILVER` | `GOLD` | `VIP`), timestamps.
- **`customer_addresses`:** Delivery endpoints. Fields: `id`, `customerId`, `street`, `city`, `state`, `postalCode`, `country`, `isDefault`.

### Orders, Items & Shipments
- **`orders`:** Purchase records. Fields: `id`, `tenantId`, `orderNumber` (indexed unique), `customerId`, `status` (`PENDING` | `PAID` | `PROCESSING` | `SHIPPED` | `DELIVERED` | `CANCELLED` | `REFUNDED`), `currency`, `subtotal`, `taxAmount`, `totalAmount`, timestamps.
- **`order_items`:** Line items. Fields: `id`, `orderId`, `productId`, `productName`, `sku`, `quantity`, `unitPrice`, `totalPrice`.
- **`shipments`:** Carrier tracking. Fields: `id`, `orderId`, `carrier`, `trackingNumber` (indexed unique), `status` (`LABEL_CREATED` | `PICKED_UP` | `IN_TRANSIT` | `OUT_FOR_DELIVERY` | `DELIVERED` | `EXCEPTION`), `estimatedDelivery`, `currentLocation`.

### Payments & Refunds
- **`payments`:** Transaction audit. Fields: `id`, `tenantId`, `orderId`, `amount`, `currency`, `status` (`PENDING` | `COMPLETED` | `FAILED` | `REFUNDED`), `paymentMethod`, `maskedCard`, `transactionRef`.
- **`refund_requests`:** Dispute filings. Fields: `id`, `tenantId`, `orderId`, `customerId`, `amount`, `reason`, `status` (`PENDING` | `APPROVED` | `REJECTED`), `reviewedBy`, `reviewedAt`, `rejectionReason`.
- **`refunds`:** Executed simulated disbursements. Fields: `id`, `tenantId`, `refundRequestId`, `amount`, `currency`, `status`, `referenceId`.

### Support Tickets & Knowledge Base
- **`support_tickets`:** Customer tickets. Fields: `id`, `tenantId`, `ticketNumber` (indexed unique), `customerId`, `subject`, `description`, `status` (`OPEN` | `IN_PROGRESS` | `WAITING_ON_CUSTOMER` | `RESOLVED` | `CLOSED`), `priority` (`LOW` | `MEDIUM` | `HIGH` | `URGENT`), `assignedAgentId`.
- **`ticket_messages`:** Communication logs. Fields: `id`, `ticketId`, `senderType` (`CUSTOMER` | `AGENT` | `SYSTEM`), `senderId`, `message`.
- **`knowledge_base_articles`:** Public policy repo. Fields: `id`, `tenantId`, `title`, `slug`, `category`, `content`, `tags`, `isPublished`.

### Multi-Agent Swarm & Governance Audit
- **`ai_agents`:** Agent registry. Fields: `id`, `name`, `riskTier`, `autonomyLevel`, `status` (`ACTIVE` | `IDLE` | `PAUSED` | `QUARANTINED` | `KILLED`), `model`, `description`.
- **`agent_executions`:** Historical run trace. Fields: `id`, `agentId`, `conversationId`, `prompt`, `response`, `durationMs`, `executionMode`, `promptTokens`, `completionTokens`, `governanceDecision`.
- **`agent_tool_calls`:** Granular tool execution audit. Fields: `id`, `executionId`, `toolName`, `arguments`, `result`, `status`, `durationMs`.
- **`agent_handoffs`:** Swarm routing ledger. Fields: `id`, `conversationId`, `fromAgentId`, `toAgentId`, `reason`, `handoffContext`.
- **`tool_execution_logs`:** Global tool invocations ledger. Fields: `id`, `agentId`, `toolName`, `arguments`, `result`, `durationMs`, `status`, `errorMessage`.

---

## 3. Concurrency & Transactional Guarantees

1. **Duplicate Refund Protection:** `POST /api/v1/refunds/request` wraps status inspection and creation inside an atomic `prisma.$transaction`. Simultaneous requests for the same order are serialized; the second transaction encounters active status and aborts with HTTP 409 Conflict.
2. **Tenant Isolation:** Cross-customer queries enforce `customerId` ownership checks at both the database query predicate and route handler levels.
