import { describe, expect, it } from 'vitest';
import { buildApp } from '../apps/backend/src/app.js';
import { prisma } from '@support/database';

describe('Phase 5 Multi-Agent Customer Chat & Orchestration Tests', () => {
  const app = buildApp();

  it('Workflow A: Customer asks about order status -> routes to Order Agent and retrieves PostgreSQL order', async () => {
    const customer = await prisma.customer.findFirst();
    const order = await prisma.order.findFirst({ where: { customerId: customer!.id } });
    expect(order).toBeDefined();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/chat/message',
      payload: {
        customerId: customer!.id,
        message: `Where is my order ${order!.orderNumber}?`
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.conversationId).toBeDefined();
    expect(body.activeAgentId).toBe('order-agent-003');
    expect(body.response).toBeDefined();

    // Check handoff was recorded
    const handoff = await prisma.agentHandoff.findFirst({
      where: { conversationId: body.conversationId },
      orderBy: { createdAt: 'desc' }
    });
    expect(handoff).toBeDefined();
    expect(handoff!.toAgentId).toBe('order-agent-003');
  }, 45000);

  it('Workflow B: Customer asks for refund -> routes to Refund Agent', async () => {
    const customer = await prisma.customer.findFirst();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/chat/message',
      payload: {
        customerId: customer!.id,
        message: 'My product arrived damaged. I want a refund for my order.'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.activeAgentId).toBe('refund-agent-002');
    expect(body.response).toBeDefined();

    // Verify conversation message saved in DB
    const savedMsg = await prisma.conversationMessage.findFirst({
      where: { conversationId: body.conversationId, sender: 'AGENT' },
      orderBy: { createdAt: 'desc' }
    });
    expect(savedMsg).toBeDefined();
    expect(savedMsg!.agentId).toBe('refund-agent-002');
  }, 45000);

  it('Workflow C: Customer asks for supervisor -> routes to Escalation Agent', async () => {
    const customer = await prisma.customer.findFirst();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/chat/message',
      payload: {
        customerId: customer!.id,
        message: 'I want to speak to a supervisor immediately regarding an unresolved complaint.'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.activeAgentId).toBe('escalation-agent-004');
    expect(body.response).toBeDefined();
  }, 45000);

  it('should persist conversation history and return messages on retrieval', async () => {
    const customer = await prisma.customer.findFirst();
    const conv = await prisma.conversation.findFirst({ where: { customerId: customer!.id } });
    expect(conv).toBeDefined();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/chat/conversations/${conv!.id}`
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.id).toBe(conv!.id);
    expect(body.messages.length).toBeGreaterThan(0);
    expect(body.handoffs).toBeDefined();
  });
});
