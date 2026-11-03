import { describe, expect, it } from 'vitest';
import { buildApp } from '../apps/backend/src/app.js';
import { prisma } from '@signet/database';
import { agentRegistry, agentRunner, agentOrchestrator } from '@signet/agents';
import { toolRegistry } from '@signet/tools';
import { OllamaService } from '../apps/backend/src/services/ollama.service.js';

describe('Phase 6 Standalone Functional & Security Test Suite (ST-001 to ST-020)', () => {
  const app = buildApp();

  // ST-001: Customer asks a normal support question
  it('ST-001: Customer asks a normal support question -> answered politely', async () => {
    const customer = await prisma.customer.findFirst();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/chat/message',
      payload: {
        customerId: customer!.id,
        message: 'Hello, what are your customer support operating hours and assistance channels?'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.response.length).toBeGreaterThan(10);
    expect(body.activeAgentId).toBe('support-agent-001');
  }, 45000);

  // ST-002: Customer retrieves own order
  it('ST-002: Customer retrieves own order -> succeeds with order details', async () => {
    const customer = await prisma.customer.findFirst();
    const order = await prisma.order.findFirst({ where: { customerId: customer!.id } });
    expect(order).toBeDefined();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/orders/${order!.id}`,
      headers: {
        'x-user-role': 'CUSTOMER',
        'x-customer-id': customer!.id
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.orderNumber).toBe(order!.orderNumber);
    expect(body.customerId).toBe(customer!.id);
  });

  // ST-003: Customer attempts to retrieve another customer's order
  it('ST-003: Customer attempts to retrieve another customer order -> blocked with 403', async () => {
    const [custA, custB] = await prisma.customer.findMany({ take: 2 });
    const orderB = await prisma.order.findFirst({ where: { customerId: custB.id } });
    expect(orderB).toBeDefined();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/orders/${orderB!.id}`,
      headers: {
        'x-user-role': 'CUSTOMER',
        'x-customer-id': custA.id
      }
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.message).toContain('Access denied');
  });

  // ST-004: Support Agent creates a ticket
  it('ST-004: Support Agent creates a ticket -> saved in PostgreSQL', async () => {
    const customer = await prisma.customer.findFirst();
    const result = await toolRegistry.executeTool('create_support_ticket', {
      customerId: customer!.id,
      subject: 'ST-004 Ticket Creation',
      description: 'Audio cutout issue on right earbud',
      priority: 'MEDIUM'
    }, { agentId: 'support-agent-001' });

    expect(result.success).toBe(true);
    expect(result.ticketNumber).toMatch(/^TICK-/);

    const ticketInDb = await prisma.supportTicket.findUnique({ where: { ticketNumber: result.ticketNumber } });
    expect(ticketInDb).toBeDefined();
    expect(ticketInDb!.status).toBe('OPEN');
  });

  // ST-005: Refund Agent checks eligibility
  it('ST-005: Refund Agent checks refund eligibility -> evaluates 30-day window', async () => {
    const order = await prisma.order.findFirst({ where: { status: 'PAID' }, include: { payments: true } });
    expect(order).toBeDefined();

    // Clean prior requests for clean idempotency
    await prisma.refund.deleteMany({ where: { refundRequest: { orderId: order!.id } } });
    await prisma.refundRequest.deleteMany({ where: { orderId: order!.id } });
    await prisma.order.update({
      where: { id: order!.id },
      data: { createdAt: new Date() }
    });

    let payment = order!.payments.find((p) => p.status === 'COMPLETED');
    if (!payment) {
      await prisma.payment.create({
        data: {
          orderId: order!.id,
          amount: order!.totalAmount,
          currency: order!.currency,
          status: 'COMPLETED',
          paymentMethod: 'CREDIT_CARD',
          maskedCard: '****-****-****-4242',
          transactionRef: `TXN-${Date.now()}`
        }
      });
    }

    const eligibility = await toolRegistry.executeTool('check_refund_eligibility', {
      orderNumber: order!.orderNumber,
      reason: 'Slight cosmetic scuff'
    }, { agentId: 'refund-agent-002', authenticatedCustomerId: order!.customerId });

    expect(eligibility.eligible).toBe(true);
    expect(eligibility.orderNumber).toBe(order!.orderNumber);
    expect(eligibility.maxEligibleAmount).toBeGreaterThan(0);
  });

  // ST-006: Refund Agent requests supervisor approval
  it('ST-006: Refund Agent requests supervisor approval for amount > INR 2000', async () => {
    const order = await prisma.order.findFirst({
      where: { status: 'PAID', totalAmount: { gt: 3000 } }
    });
    expect(order).toBeDefined();

    // Clean any prior requests for this order
    await prisma.refund.deleteMany({ where: { refundRequest: { orderId: order!.id } } });
    await prisma.refundRequest.deleteMany({ where: { orderId: order!.id } });

    const req = await toolRegistry.executeTool('create_refund_request', {
      orderNumber: order!.orderNumber,
      amount: 2500,
      reason: 'Supervisor approval test for high-value return'
    }, { agentId: 'refund-agent-002' });

    expect(req.success).toBe(true);
    expect(req.requiresSupervisorApproval).toBe(true);
    expect(req.status).toBe('PENDING');
  });

  // ST-007: Supervisor approves refund
  it('ST-007: Supervisor approves refund -> updates status to APPROVED and issues refund', async () => {
    const pendingReq = await prisma.refundRequest.findFirst({
      where: { status: 'PENDING' }
    });
    expect(pendingReq).toBeDefined();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/refunds/${pendingReq!.id}/approve`
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.request.status).toBe('APPROVED');
    expect(body.refund.status).toBe('COMPLETED');
  });

  // ST-008: Supervisor rejects refund
  it('ST-008: Supervisor rejects refund -> records rejection reason', async () => {
    // Create a temporary pending request to reject
    const order = await prisma.order.findFirst({ where: { status: 'PAID' } });
    expect(order).toBeDefined();

    await prisma.refund.deleteMany({ where: { refundRequest: { orderId: order!.id } } });
    await prisma.refundRequest.deleteMany({ where: { orderId: order!.id } });

    const req = await prisma.refundRequest.create({
      data: {
        tenantId: order!.tenantId,
        orderId: order!.id,
        customerId: order!.customerId,
        amount: 2500,
        reason: 'Test request to reject',
        status: 'PENDING',
        requiresSupervisorApproval: true
      }
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/refunds/${req.id}/reject`,
      payload: { reason: 'Customer failed to return product accessories within window' }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.request.status).toBe('REJECTED');
    expect(body.request.rejectedReason).toContain('failed to return product');
  });

  // ST-009: Duplicate refund is rejected
  it('ST-009: Duplicate refund request is rejected with 409 Conflict', async () => {
    const activeReq = await prisma.refundRequest.findFirst({
      where: { status: { in: ['PENDING', 'APPROVED'] } }
    });
    expect(activeReq).toBeDefined();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/refunds/request',
      payload: {
        orderId: activeReq!.orderId,
        customerId: activeReq!.customerId,
        amount: 500,
        reason: 'Attempting duplicate refund'
      }
    });

    expect(res.statusCode).toBe(409);
  });

  // ST-010: Order Agent tracks shipment
  it('ST-010: Order Agent tracks shipment -> returns carrier milestones', async () => {
    const shipment = await prisma.shipment.findFirst();
    expect(shipment).toBeDefined();

    const order = await prisma.order.findUnique({ where: { id: shipment!.orderId } });
    const tracking = await toolRegistry.executeTool('track_shipment', {
      orderNumber: order!.orderNumber
    }, { agentId: 'order-agent-003', authenticatedCustomerId: order!.customerId });

    expect(tracking.tracked).toBe(true);
    expect(tracking.trackingNumber).toBe(shipment!.trackingNumber);
    expect(tracking.carrier).toBeDefined();
  });

  // ST-011: Order Agent requests cancellation
  it('ST-011: Order Agent requests cancellation -> updates order status to CANCELLED', async () => {
    const preDispatchOrder = await prisma.order.findFirst({
      where: { status: { in: ['PENDING', 'PAID'] } }
    });
    expect(preDispatchOrder).toBeDefined();

    const cancelResult = await toolRegistry.executeTool('request_order_cancellation', {
      orderNumber: preDispatchOrder!.orderNumber,
      reason: 'Customer placed duplicate order'
    }, { agentId: 'order-agent-003', authenticatedCustomerId: preDispatchOrder!.customerId });

    expect(cancelResult.success).toBe(true);
    expect(cancelResult.newStatus).toBe('CANCELLED');

    const inDb = await prisma.order.findUnique({ where: { id: preDispatchOrder!.id } });
    expect(inDb!.status).toBe('CANCELLED');
  });

  // ST-012: Escalation Agent creates escalation
  it('ST-012: Escalation Agent creates escalation -> marks ticket URGENT', async () => {
    const ticket = await prisma.supportTicket.findFirst();
    expect(ticket).toBeDefined();

    const escResult = await toolRegistry.executeTool('create_escalation', {
      ticketId: ticket!.id,
      reason: 'Repeated hardware failures after multiple replacements',
      severity: 'URGENT'
    }, { agentId: 'escalation-agent-004' });

    expect(escResult.success).toBe(true);
    expect(escResult.status).toBe('ESCALATED_TO_SUPERVISOR');

    const updated = await prisma.supportTicket.findUnique({ where: { id: ticket!.id } });
    expect(updated!.priority).toBe('URGENT');
  });

  // ST-013: Agent-to-agent handoff succeeds
  it('ST-013: Agent-to-agent handoff succeeds and is logged in PostgreSQL', async () => {
    const customer = await prisma.customer.findFirst();

    // Start with Support Agent
    const conv = await prisma.conversation.create({
      data: {
        customerId: customer!.id,
        title: 'ST-013 Handoff Test',
        activeAgentId: 'support-agent-001'
      }
    });

    // Send order query -> triggers handoff to Order Agent
    const result = await agentOrchestrator.dispatchMessage({
      conversationId: conv.id,
      customerId: customer!.id,
      userMessage: 'Where is my order ORD-1005?',
      modelService: {
        generateResponse: async () => ({
          content: 'Your order ORD-1005 is currently in transit.',
          toolCalls: [],
          tokenUsage: { promptTokens: 30, completionTokens: 10, totalTokens: 40 }
        })
      }
    });

    expect(result.activeAgentId).toBe('order-agent-003');
    expect(result.handoff).toBeDefined();
    expect(result.handoff!.from).toBe('support-agent-001');
    expect(result.handoff!.to).toBe('order-agent-003');

    // Verify in database
    const handoffInDb = await prisma.agentHandoff.findFirst({
      where: { conversationId: conv.id },
      orderBy: { createdAt: 'desc' }
    });
    expect(handoffInDb).toBeDefined();
    expect(handoffInDb!.toAgentId).toBe('order-agent-003');
  });

  // ST-014: Forbidden tool call is rejected
  it('ST-014: Forbidden tool call is rejected by agent authorization', () => {
    // Support agent cannot execute financial refunds
    const isAllowed = agentRegistry.isToolAllowed('support-agent-001', 'execute_approved_refund');
    expect(isAllowed).toBe(false);

    // Escalation agent cannot manipulate database directly
    const isEscAllowed = agentRegistry.isToolAllowed('escalation-agent-004', 'direct_database_manipulation');
    expect(isEscAllowed).toBe(false);
  });

  // ST-015: Agent execution history is stored
  it('ST-015: Agent execution history is stored in PostgreSQL', async () => {
    const countBefore = await prisma.agentExecution.count();

    await agentRunner.run({
      agentId: 'support-agent-001',
      userMessage: 'ST-015 History Test',
      modelService: {
        generateResponse: async () => ({
          content: 'Stored execution test',
          toolCalls: [],
          tokenUsage: { promptTokens: 20, completionTokens: 5, totalTokens: 25 }
        })
      }
    });

    const countAfter = await prisma.agentExecution.count();
    expect(countAfter).toBe(countBefore + 1);
  });

  // ST-016: Ollama becomes unavailable
  it('ST-016: Ollama becomes unavailable -> gracefully handles error', async () => {
    const deadOllamaService = new OllamaService('http://localhost:59999', 'beam:cloud', 1500);

    const health = await deadOllamaService.checkHealth();
    expect(health.healthy).toBe(false);
    expect(health.error).toBeDefined();

    // Verify AgentRunner reports clean error rather than unhandled exception
    await expect(
      agentRunner.run({
        agentId: 'support-agent-001',
        userMessage: 'Test message with dead model',
        modelService: deadOllamaService
      })
    ).rejects.toThrow();
  });

  // ST-017: Invalid tool arguments are rejected
  it('ST-017: Invalid tool arguments are rejected by strict Zod schema', async () => {
    await expect(
      toolRegistry.executeTool('create_support_ticket', {
        customerId: 'not-a-uuid',
        subject: '',
        description: 'short'
      }, { agentId: 'support-agent-001' })
    ).rejects.toThrow();
  });

  // ST-018: Conversation history survives restart
  it('ST-018: Conversation history survives restart through PostgreSQL persistence', async () => {
    const customer = await prisma.customer.findFirst();
    const conv = await prisma.conversation.create({
      data: {
        customerId: customer!.id,
        title: 'ST-018 Restart Survival Test',
        messages: {
          create: [
            { sender: 'CUSTOMER', text: 'Persistent message A' },
            { sender: 'AGENT', agentId: 'support-agent-001', text: 'Persistent message B' }
          ]
        }
      },
      include: { messages: true }
    });

    // Query in fresh transaction
    const fetched = await prisma.conversation.findUnique({
      where: { id: conv.id },
      include: { messages: true }
    });

    expect(fetched).toBeDefined();
    expect(fetched!.messages.length).toBe(2);
    expect(fetched!.messages[0].text).toBe('Persistent message A');
  });

  // ST-019: Database transaction rollback works
  it('ST-019: Database transaction rollback works on error', async () => {
    const customer = await prisma.customer.findFirst();
    const countBefore = await prisma.supportTicket.count();

    try {
      await prisma.$transaction(async (tx) => {
        await tx.supportTicket.create({
          data: {
            tenantId: customer!.tenantId,
            ticketNumber: 'TICK-ROLLBACK-TEST',
            customerId: customer!.id,
            subject: 'Rollback Subject',
            description: 'Rollback Description'
          }
        });
        throw new Error('Simulated atomic failure for rollback');
      });
    } catch {
      // expected error
    }

    const countAfter = await prisma.supportTicket.count();
    expect(countAfter).toBe(countBefore);
  });

  // ST-020: Concurrent refund requests do not create duplicate refunds
  it('ST-020: Concurrent refund requests do not create duplicate refunds', async () => {
    const order = await prisma.order.findFirst({
      where: { status: 'PAID' }
    });
    expect(order).toBeDefined();

    // Clean prior requests
    await prisma.refund.deleteMany({ where: { refundRequest: { orderId: order!.id } } });
    await prisma.refundRequest.deleteMany({ where: { orderId: order!.id } });

    // Launch 3 concurrent requests simultaneously
    const results = await Promise.allSettled([
      app.inject({
        method: 'POST',
        url: '/api/v1/refunds/request',
        payload: { orderId: order!.id, customerId: order!.customerId, amount: 1000, reason: 'Concurrent request 1' }
      }),
      app.inject({
        method: 'POST',
        url: '/api/v1/refunds/request',
        payload: { orderId: order!.id, customerId: order!.customerId, amount: 1000, reason: 'Concurrent request 2' }
      }),
      app.inject({
        method: 'POST',
        url: '/api/v1/refunds/request',
        payload: { orderId: order!.id, customerId: order!.customerId, amount: 1000, reason: 'Concurrent request 3' }
      })
    ]);

    const statusCodes = results.map((r) => r.status === 'fulfilled' ? JSON.parse(r.value.payload) : null);
    const activeRequestsInDb = await prisma.refundRequest.findMany({
      where: { orderId: order!.id }
    });

    // Exactly 1 refund request must be created, remaining blocked
    expect(activeRequestsInDb.length).toBe(1);
  });
});
