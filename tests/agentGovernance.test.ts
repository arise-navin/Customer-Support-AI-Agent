import { describe, expect, it } from 'vitest';
import { buildApp } from '../apps/backend/src/app.js';
import { prisma } from '@signet/database';

describe('AI Agent Credentials, Kill Switch & Tracking Feature Tests', () => {
  const app = buildApp();
  const testAgentId = 'support-agent-001';

  it('1. should generate client ID and client secret for an AI agent', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/agents/${testAgentId}/credentials`
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.clientId).toMatch(/^agt_cli_/);
    expect(body.clientSecret).toMatch(/^agt_sec_/);

    // Verify in database
    const dbAgent = await prisma.aiAgent.findUnique({
      where: { id: testAgentId }
    });
    expect(dbAgent?.clientId).toBe(body.clientId);
    expect(dbAgent?.clientSecret).toBe(body.clientSecret);
  });

  it('2. should list agents with masked client secret and hasCredentials flag', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/agents'
    });

    expect(res.statusCode).toBe(200);
    const agents = JSON.parse(res.payload);
    const target = agents.find((a: any) => a.id === testAgentId);
    expect(target).toBeDefined();
    expect(target.hasCredentials).toBe(true);
    expect(target.clientId).toBeDefined();
    expect(target.clientSecretMasked).toContain('...');
    // Raw secret must not be exposed in public list
    expect(target.clientSecretMasked).not.toBe(target.clientSecret);
  });

  it('3. should track agent telemetry and audit trail', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/agents/${testAgentId}/track`
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.agent).toBeDefined();
    expect(body.agent.id).toBe(testAgentId);
    expect(body.telemetry).toBeDefined();
    expect(typeof body.telemetry.totalExecutions).toBe('number');
    expect(Array.isArray(body.auditTrail)).toBe(true);
  });

  it('4. should reject execution when invalid client credentials are provided', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/agents/${testAgentId}/run`,
      payload: {
        message: 'Hello!',
        clientId: 'fake_client_id_123',
        clientSecret: 'fake_secret_xyz'
      }
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.error).toContain('Security / Policy Block');
    expect(body.message).toContain('Invalid clientId or clientSecret');
  });

  it('5. should invoke emergency kill switch and immediately block executions', async () => {
    // 1. Invoke Kill switch
    const killRes = await app.inject({
      method: 'POST',
      url: `/api/v1/agents/${testAgentId}/kill`,
      payload: {
        reason: 'Security breach simulated in automated test'
      }
    });

    expect(killRes.statusCode).toBe(200);
    const killBody = JSON.parse(killRes.payload);
    expect(killBody.status).toBe('KILLED');
    expect(killBody.reason).toBe('Security breach simulated in automated test');

    // 2. Verify subsequent run is immediately blocked
    const runRes = await app.inject({
      method: 'POST',
      url: `/api/v1/agents/${testAgentId}/run`,
      payload: {
        message: 'Attempting to run while killed'
      }
    });

    expect(runRes.statusCode).toBe(403);
    const runBody = JSON.parse(runRes.payload);
    expect(runBody.message).toContain('Kill Switch');

    // 3. Verify status in database
    const dbAgent = await prisma.aiAgent.findUnique({
      where: { id: testAgentId }
    });
    expect(dbAgent?.status).toBe('KILLED');
    expect(dbAgent?.killedReason).toBe('Security breach simulated in automated test');
  });

  it('6. should restore killed agent to ACTIVE status', async () => {
    const activateRes = await app.inject({
      method: 'POST',
      url: `/api/v1/agents/${testAgentId}/activate`
    });

    expect(activateRes.statusCode).toBe(200);
    const body = JSON.parse(activateRes.payload);
    expect(body.status).toBe('ACTIVE');

    // Verify in database
    const dbAgent = await prisma.aiAgent.findUnique({
      where: { id: testAgentId }
    });
    expect(dbAgent?.status).toBe('ACTIVE');
    expect(dbAgent?.killedReason).toBeNull();
  });

  it('7. should revoke client credentials when requested', async () => {
    const revokeRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/agents/${testAgentId}/credentials`
    });

    expect(revokeRes.statusCode).toBe(200);

    const dbAgent = await prisma.aiAgent.findUnique({
      where: { id: testAgentId }
    });
    expect(dbAgent?.clientId).toBeNull();
    expect(dbAgent?.clientSecret).toBeNull();
  });
});

