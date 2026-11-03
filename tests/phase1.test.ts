import { describe, expect, it } from 'vitest';
import { buildApp } from '../apps/backend/src/app.js';
import { AGENT_IDS, HealthResponseSchema } from '../packages/shared/src/index.js';

describe('Phase 1 Acceptance Tests', () => {
  it('should verify Fastify backend health check returns expected status and service', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/health'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('healthy');
    expect(body.service).toBe('customer-support-api');
    expect(HealthResponseSchema.safeParse(body).success).toBe(true);
  });

  it('should verify all four agent IDs are properly defined in shared package', () => {
    expect(AGENT_IDS.SUPPORT).toBe('support-agent-001');
    expect(AGENT_IDS.REFUND).toBe('refund-agent-002');
    expect(AGENT_IDS.ORDER).toBe('order-agent-003');
    expect(AGENT_IDS.ESCALATION).toBe('escalation-agent-004');
  });
});
