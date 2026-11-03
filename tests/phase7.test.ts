import { describe, expect, it, beforeEach } from 'vitest';
import { buildApp } from '../apps/backend/src/app.js';
import { signetAdapterManager, SignetGatewayError } from '@signet/signet-adapter';
import { prisma } from '@signet/database';

describe('Phase 7 — Signet Gateway Integration Tests', () => {
  const app = buildApp();

  beforeEach(() => {
    // Reset to DIRECT_OLLAMA by default
    signetAdapterManager.setMode('DIRECT_OLLAMA');
  });

  it('7.1: Direct Ollama mode still works and preserves standalone functionality', async () => {
    signetAdapterManager.setMode('DIRECT_OLLAMA');
    const adapter = signetAdapterManager.getAdapter();
    expect(adapter.mode).toBe('DIRECT_OLLAMA');

    const decision = await adapter.evaluatePolicy({
      agentId: 'support-agent-001',
      action: 'llm_completion',
      prompt: 'Hello, what are your store hours?'
    });

    expect(decision.allowed).toBe(true);
    expect(decision.simulated).toBe(false);
    expect(decision.decision).toBe('ALLOW');
  });

  it('7.2: Signet adapter can be configured dynamically via backend API', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/signet/config',
      payload: {
        executionMode: 'SIGNET_MOCK',
        gatewayUrl: 'http://localhost:8080',
        tenantId: 'tenant-test-01'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.executionMode).toBe('SIGNET_MOCK');
    expect(body.gatewayUrl).toBe('http://localhost:8080');
    expect(body.tenantId).toBe('tenant-test-01');
    expect(signetAdapterManager.getMode()).toBe('SIGNET_MOCK');
  });

  it('7.3: Mock mode is clearly identified as SIMULATED across all responses', async () => {
    signetAdapterManager.setMode('SIGNET_MOCK');
    const adapter = signetAdapterManager.getAdapter('SIGNET_MOCK');
    expect(adapter.mode).toBe('SIGNET_MOCK');

    const decision = await adapter.evaluatePolicy({
      agentId: 'support-agent-001',
      action: 'llm_completion',
      prompt: 'Order inquiry'
    });

    expect(decision.simulated).toBe(true);
    expect(decision.correlationId).toMatch(/^corr-sgn-mock-/);
    expect(decision.evidenceRef).toMatch(/^ev-sgn-mock-/);

    // Verify GET /api/v1/signet/status identifies mock mode
    const statusRes = await app.inject({
      method: 'GET',
      url: '/api/v1/signet/status'
    });
    const statusBody = JSON.parse(statusRes.payload);
    expect(statusBody.simulated).toBe(true);
    expect(statusBody.status).toBe('SIMULATED');
  });

  it('7.4: Mock mode enforces agent certificates and policy rules', async () => {
    signetAdapterManager.setMode('SIGNET_MOCK');
    const adapter = signetAdapterManager.getMockAdapter();

    // Support agent trying to call forbidden tool execute_approved_refund
    const toolDecision = await adapter.evaluatePolicy({
      agentId: 'support-agent-001',
      action: 'tool_execution',
      toolName: 'execute_approved_refund',
      toolArgs: { refundId: 'test-123' }
    });

    expect(toolDecision.allowed).toBe(false);
    expect(toolDecision.decision).toBe('DENY');
    expect(toolDecision.reason).toContain('forbidden');
    expect(toolDecision.evidenceRef).toBeDefined();
    expect(toolDecision.simulated).toBe(true);
  });

  it('7.5: Gateway outage in REAL mode fails closed without silent direct-Ollama fallback', async () => {
    // Set to SIGNET_REAL with an intentionally unreachable local port
    signetAdapterManager.updateConfig({
      executionMode: 'SIGNET_REAL',
      gatewayUrl: 'http://127.0.0.1:59998'
    });

    const realAdapter = signetAdapterManager.getRealAdapter();
    expect(realAdapter.mode).toBe('SIGNET_REAL');

    // Attempting policy evaluation when real gateway is unreachable must FAIL CLOSED
    let failedClosed = false;
    try {
      await realAdapter.evaluatePolicy({
        agentId: 'support-agent-001',
        action: 'llm_completion',
        prompt: 'Where is my order?'
      });
    } catch (err: any) {
      failedClosed = true;
      expect(err).toBeInstanceOf(SignetGatewayError);
      expect(err.message).toContain('fail-closed');
    }

    expect(failedClosed).toBe(true);
  });

  it('7.6: Real Signet mode connection probe reports honest status (ONLINE vs UNAVAILABLE/BLOCKED)', async () => {
    signetAdapterManager.updateConfig({
      executionMode: 'SIGNET_REAL',
      gatewayUrl: 'http://127.0.0.1:59998'
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/signet/status'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.mode).toBe('SIGNET_REAL');
    expect(body.connected).toBe(false);
    expect(body.status).toBe('UNAVAILABLE');
    expect(body.error).toBeDefined();
  });

  it('7.7: Existing customer support chat workflows remain functional when permitted', async () => {
    signetAdapterManager.setMode('DIRECT_OLLAMA');
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
    expect(body.response).toBeDefined();
    expect(body.response.length).toBeGreaterThan(10);
    expect(body.activeAgentId).toBe('support-agent-001');
  }, 45000);
});
