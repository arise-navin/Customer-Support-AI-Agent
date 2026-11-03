import { afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { buildApp } from '../apps/backend/src/app.js';
import { prisma } from '@support/database';

const app = buildApp();
afterAll(async () => { await app.close(); });

describe('Agent REST controls with PostgreSQL', () => {
  it('lists four agents without exposing stored credentials', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/agents' });
    expect(response.statusCode).toBe(200);
    const agents = response.json<Array<{ id: string }>>();
    expect(agents).toHaveLength(4);
    for (const agent of agents) {
      expect(agent).not.toHaveProperty('clientSecret');
      expect(agent).not.toHaveProperty('clientId');
    }
  });

  it('pauses, stops, tracks and activates each agent without calling a model while blocked', async () => {
    const agents = await prisma.aiAgent.findMany();
    for (const agent of agents) {
      try {
        for (const action of ['pause', 'stop']) {
          const response = await app.inject({ method: 'POST', url: `/api/v1/agents/${agent.id}/${action}`, payload: { reason: 'REST integration test' } });
          expect(response.statusCode).toBe(200);
          const run = await app.inject({ method: 'POST', url: `/api/v1/agents/${agent.id}/run`, payload: { message: 'Blocked test request' } });
          expect(run.statusCode).toBe(403);
          const track = await app.inject({ method: 'GET', url: `/api/v1/agents/${agent.id}/track` });
          expect(track.statusCode).toBe(200);
          expect(track.json().agent.status).toBe(action === 'pause' ? 'PAUSED' : 'KILLED');
        }
        const activate = await app.inject({ method: 'POST', url: `/api/v1/agents/${agent.id}/activate` });
        expect(activate.json().status).toBe('ACTIVE');
      } finally {
        await prisma.aiAgent.update({ where: { id: agent.id }, data: { status: agent.status, killedAt: agent.killedAt, killedReason: agent.killedReason } });
      }
    }
  }, 60000);

  it('stops a running real model request even if the agent is immediately activated again', async () => {
    const id = 'support-agent-001';
    const agent = await prisma.aiAgent.findUniqueOrThrow({ where: { id } });
    const prompt = `Say hello. Request reference: ${randomUUID()}`;
    let pending: ReturnType<typeof app.inject> | undefined;
    try {
      await app.inject({ method: 'POST', url: `/api/v1/agents/${id}/activate` });
      pending = app.inject({ method: 'POST', url: `/api/v1/agents/${id}/run`, payload: { message: prompt } });
      void pending.then(() => undefined);
      const deadline = Date.now() + 15000;
      let running = false;
      while (Date.now() < deadline) {
        const execution = await prisma.agentExecution.findFirst({ where: { agentId: id, prompt } });
        if (execution?.governanceDecision === 'RUNNING') { running = true; break; }
        await setTimeout(100);
      }
      expect(running).toBe(true);
      const stop = await app.inject({ method: 'POST', url: `/api/v1/agents/${id}/stop`, payload: { reason: 'Cancel running inference' } });
      expect(stop.statusCode).toBe(200);
      await app.inject({ method: 'POST', url: `/api/v1/agents/${id}/activate` });
      const response = await pending;
      expect([403, 409]).toContain(response.statusCode);
      const execution = await prisma.agentExecution.findFirstOrThrow({ where: { agentId: id, prompt }, include: { toolCalls: true } });
      expect(execution.governanceDecision).toBe('STOPPED');
      expect(execution.toolCalls).toHaveLength(0);
    } finally {
      if (pending) await pending;
      await prisma.aiAgent.update({ where: { id }, data: { status: agent.status, killedAt: agent.killedAt, killedReason: agent.killedReason } });
    }
  }, 60000);

  it('validates controls and reports unknown agents', async () => {
    const invalid = await app.inject({ method: 'POST', url: '/api/v1/agents/support-agent-001/pause', payload: {} });
    expect(invalid.statusCode).toBe(400);
    const missing = await app.inject({ method: 'POST', url: '/api/v1/agents/missing/stop', payload: { reason: 'test' } });
    expect(missing.statusCode).toBe(404);
  });
});
