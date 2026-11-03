import { describe, expect, it } from 'vitest';
import { buildApp } from '../apps/backend/src/app.js';
import { agentRegistry, agentRunner, agentStateManager } from '@support/agents';
import { toolRegistry } from '@support/tools';
import { prisma } from '@support/database';

describe('Phase 4 Four AI Agents System Tests', () => {
  const app = buildApp();

  it('should verify exactly four agents are registered with expected IDs and models', () => {
    const agents = agentRegistry.getAllAgents();
    expect(agents.length).toBe(4);

    const ids = agents.map((a) => a.id).sort();
    expect(ids).toEqual([
      'escalation-agent-004',
      'order-agent-003',
      'refund-agent-002',
      'support-agent-001'
    ]);

    for (const a of agents) {
      expect(a.model).toBe('beam:cloud');
      expect(a.systemPrompt.length).toBeGreaterThan(20);
      expect(a.allowedTools.length).toBeGreaterThan(0);
      expect(a.forbiddenTools.length).toBeGreaterThan(0);
    }
  });

  it('should verify Support Agent executes permitted tools and rejects forbidden tools', async () => {
    // Permitted tool check
    expect(agentRegistry.isToolAllowed('support-agent-001', 'get_order_status')).toBe(true);
    expect(agentRegistry.isToolAllowed('support-agent-001', 'search_knowledge_base')).toBe(true);

    // Forbidden tool check
    expect(agentRegistry.isToolAllowed('support-agent-001', 'execute_approved_refund')).toBe(false);
    expect(agentRegistry.isToolAllowed('support-agent-001', 'modify_payments')).toBe(false);

    // Execute permitted tool directly through tool registry
    const customer = await prisma.customer.findFirst();
    const result = await toolRegistry.executeTool('get_customer_profile', { customerId: customer!.id }, {
      agentId: 'support-agent-001',
      authenticatedCustomerId: customer!.id
    });
    expect(result.found).toBe(true);
    expect(result.fullName).toBe(customer!.fullName);
  });

  it('should verify Refund Agent executes eligibility and calculation tools', async () => {
    expect(agentRegistry.isToolAllowed('refund-agent-002', 'check_refund_eligibility')).toBe(true);
    expect(agentRegistry.isToolAllowed('refund-agent-002', 'calculate_refund')).toBe(true);

    const order = await prisma.order.findFirst({ where: { status: 'PAID' } });
    expect(order).toBeDefined();

    const calcResult = await toolRegistry.executeTool('calculate_refund', { orderNumber: order!.orderNumber }, {
      agentId: 'refund-agent-002'
    });
    expect(calcResult.calculatedRefundAmount).toBeGreaterThan(0);
  });

  it('should verify Order Agent executes order details and tracking tools', async () => {
    expect(agentRegistry.isToolAllowed('order-agent-003', 'get_order_details')).toBe(true);
    expect(agentRegistry.isToolAllowed('order-agent-003', 'track_shipment')).toBe(true);
    expect(agentRegistry.isToolAllowed('order-agent-003', 'delete_orders')).toBe(false);

    const order = await prisma.order.findFirst({ include: { shipment: true } });
    const details = await toolRegistry.executeTool('get_order_details', { orderNumber: order!.orderNumber }, {
      agentId: 'order-agent-003'
    });
    expect(details.orderNumber).toBe(order!.orderNumber);
    expect(details.items.length).toBeGreaterThan(0);
  });

  it('should verify Escalation Agent executes escalation and security incident tools', async () => {
    expect(agentRegistry.isToolAllowed('escalation-agent-004', 'create_security_incident')).toBe(true);
    expect(agentRegistry.isToolAllowed('escalation-agent-004', 'create_escalation')).toBe(true);
    expect(agentRegistry.isToolAllowed('escalation-agent-004', 'direct_database_manipulation')).toBe(false);

    const secResult = await toolRegistry.executeTool('create_security_incident', {
      summary: 'Automated test: prompt injection attempt simulated',
      threatLevel: 'HIGH'
    }, {
      agentId: 'escalation-agent-004'
    });
    expect(secResult.recorded).toBe(true);
    expect(secResult.threatLevel).toBe('HIGH');
  });

  it('should verify agent runner records execution in PostgreSQL', async () => {
    const mockModelService = {
      generateResponse: async () => ({
        content: 'Hello, your order is on track for delivery tomorrow!',
        toolCalls: [],
        tokenUsage: { promptTokens: 40, completionTokens: 15, totalTokens: 55 }
      })
    };

    const customer = await prisma.customer.findFirst();

    const runResult = await agentRunner.run({
      agentId: 'support-agent-001',
      userMessage: 'Where is my order?',
      authenticatedCustomerId: customer!.id,
      modelService: mockModelService
    });

    expect(runResult.agentId).toBe('support-agent-001');
    expect(runResult.response).toContain('on track');

    // Verify record in PostgreSQL
    const savedExecution = await prisma.agentExecution.findFirst({
      where: { agentId: 'support-agent-001', prompt: 'Where is my order?' },
      orderBy: { createdAt: 'desc' }
    });
    expect(savedExecution).toBeDefined();
    expect(savedExecution!.response).toContain('on track');
  });

  it('should block execution when agent is quarantined or killed', async () => {
    await agentStateManager.setStatus('escalation-agent-004', 'QUARANTINED');

    const mockModelService = {
      generateResponse: async () => ({ content: 'Blocked' })
    };

    await expect(
      agentRunner.run({
        agentId: 'escalation-agent-004',
        userMessage: 'Test prompt',
        modelService: mockModelService
      })
    ).rejects.toThrow(/QUARANTINED/);

    // Restore to ACTIVE
    await agentStateManager.setStatus('escalation-agent-004', 'ACTIVE');
  });
});
