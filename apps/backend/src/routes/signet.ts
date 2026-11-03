import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { signetAdapterManager, signetEventCollector } from '@signet/signet-adapter';
import { agentStateManager } from '@signet/agents';

export async function signetRoutes(app: FastifyInstance) {
  // GET /api/v1/signet/config
  app.get('/signet/config', async (request, reply) => {
    const config = await signetAdapterManager.getFullConfig();
    return reply.send(config);
  });

  // PATCH /api/v1/signet/config
  app.patch('/signet/config', async (request, reply) => {
    const schema = z.object({
      executionMode: z.enum(['DIRECT_OLLAMA', 'SIGNET_MOCK', 'SIGNET_REAL', 'SIGNET_HYBRID_EDGE']).optional(),
      gatewayUrl: z.string().optional(),
      tenantId: z.string().min(1).optional(),
      enforcementRequired: z.boolean().optional(),
      hybridEdge: z.object({
        saasEndpoint: z.string().optional(),
        heartbeatIntervalSec: z.number().min(5).max(300).optional(),
        enabled: z.boolean().optional()
      }).optional()
    });

    const body = schema.parse(request.body);
    signetAdapterManager.updateConfig(body);

    const updated = await signetAdapterManager.getFullConfig();
    return reply.send(updated);
  });

  // GET /api/v1/signet/status (Ping / Connectivity check)
  app.get('/signet/status', async (request, reply) => {
    const mode = signetAdapterManager.getMode();
    if (mode === 'SIGNET_REAL') {
      const conn = await signetAdapterManager.checkGatewayConnection();
      return reply.send({
        mode,
        connected: conn.isConnected,
        latencyMs: conn.latencyMs,
        error: conn.error,
        status: conn.isConnected ? 'ONLINE' : 'UNAVAILABLE'
      });
    }

    if (mode === 'SIGNET_MOCK') {
      return reply.send({
        mode,
        connected: true,
        latencyMs: 3,
        status: 'SIMULATED',
        simulated: true,
        note: 'Signet Mock adapter actively simulating gateway responses'
      });
    }

    if (mode === 'SIGNET_HYBRID_EDGE') {
      const edgeConf = signetAdapterManager.getHybridRunner().getConfig();
      return reply.send({
        mode,
        connected: edgeConf.tunnelStatus === 'CONNECTED',
        latencyMs: edgeConf.lastSyncLatencyMs || 5,
        status: edgeConf.tunnelStatus === 'CONNECTED' ? 'TUNNEL_ACTIVE' : 'OFFLINE_TOLERANT',
        edgeRunnerId: edgeConf.edgeRunnerId,
        saasEndpoint: edgeConf.saasEndpoint,
        queuedMetadataCount: edgeConf.queuedMetadataCount,
        note: 'Signet Hybrid Edge active: Zero inbound ports, 100% on-prem DLP & execution'
      });
    }

    return reply.send({
      mode,
      connected: true,
      latencyMs: 0,
      status: 'STANDALONE_PASSTHROUGH',
      note: 'Direct Ollama mode: requests bypass Signet Gateway'
    });
  });

  // GET /api/v1/signet/hybrid (Hybrid Edge Runner Status & Telemetry)
  app.get('/signet/hybrid', async (request, reply) => {
    const runner = signetAdapterManager.getHybridRunner();
    return reply.send({
      ...runner.getConfig(),
      architecture: 'MID_SERVER_OUTBOUND_TUNNEL',
      inboundPortsOpen: 0,
      dataPrivacy: {
        promptsLeaveOnPrem: false,
        responsesLeaveOnPrem: false,
        toolArgumentsLeaveOnPrem: false,
        localDlpEnforced: true,
        sanitizedMetadataOnly: true
      }
    });
  });

  // POST /api/v1/signet/hybrid/sync (Manual Heartbeat & Command Poll)
  app.post('/signet/hybrid/sync', async (request, reply) => {
    const runner = signetAdapterManager.getHybridRunner();
    const result = await runner.syncHeartbeatNow();
    return reply.send({
      ...result,
      runnerConfig: runner.getConfig()
    });
  });

  // PATCH /api/v1/signet/hybrid/config (Update Hybrid Edge Settings)
  app.patch('/signet/hybrid/config', async (request, reply) => {
    const schema = z.object({
      saasEndpoint: z.string().optional(),
      tenantId: z.string().optional(),
      heartbeatIntervalSec: z.number().min(5).max(300).optional(),
      enabled: z.boolean().optional()
    });

    const body = schema.parse(request.body);
    const runner = signetAdapterManager.getHybridRunner();
    runner.updateConfig(body);

    return reply.send({
      success: true,
      config: runner.getConfig()
    });
  });

  // GET /api/v1/signet/certificates
  app.get('/signet/certificates', async (request, reply) => {
    const certs = signetAdapterManager.getCertificates();
    return reply.send(Object.values(certs));
  });

  // PATCH /api/v1/signet/certificates/:agentId/status
  app.patch('/signet/certificates/:agentId/status', async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const schema = z.object({
      status: z.enum(['ACTIVE', 'EXPIRED', 'REVOKED', 'QUARANTINED', 'KILLED']),
      reason: z.string().optional()
    });

    const { status, reason } = schema.parse(request.body);
    signetAdapterManager.updateCertificateStatus(agentId, status, reason);

    // Synchronize agent state manager
    if (status === 'KILLED') await agentStateManager.kill(agentId);
    else if (status === 'QUARANTINED') await agentStateManager.quarantine(agentId);
    else if (status === 'ACTIVE') await agentStateManager.activate(agentId);

    return reply.send({
      success: true,
      agentId,
      status,
      reason,
      timestamp: new Date().toISOString()
    });
  });

  // POST /api/v1/signet/decide (Test decision evaluation)
  app.post('/signet/decide', async (request, reply) => {
    const schema = z.object({
      agentId: z.string(),
      action: z.enum(['llm_completion', 'tool_execution', 'agent_handoff']),
      model: z.string().optional(),
      toolName: z.string().optional(),
      toolArgs: z.record(z.any()).optional(),
      prompt: z.string().optional(),
      targetAgentId: z.string().optional()
    });

    const body = schema.parse(request.body);
    const adapter = signetAdapterManager.getAdapter();
    const decision = await adapter.evaluatePolicy(body);

    return reply.send(decision);
  });

  // GET /api/v1/signet/events
  app.get('/signet/events', async (request, reply) => {
    const query = request.query as { limit?: string; agentId?: string; simulated?: string; dlpOnly?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : 50;
    const filter = {
      agentId: query.agentId,
      simulated: query.simulated !== undefined ? query.simulated === 'true' : undefined,
      dlpOnly: query.dlpOnly === 'true'
    };

    const events = signetEventCollector.getEvents(limit, filter);
    return reply.send(events);
  });

  // POST /api/v1/signet/kill-switch
  app.post('/signet/kill-switch', async (request, reply) => {
    const schema = z.object({
      agentId: z.string(),
      action: z.enum(['KILL', 'RESTORE', 'QUARANTINE']),
      reason: z.string().optional()
    });

    const { agentId, action, reason } = schema.parse(request.body);
    const start = performance.now();

    if (action === 'KILL') {
      signetAdapterManager.updateCertificateStatus(agentId, 'KILLED', reason || 'Kill switch activated');
      await agentStateManager.kill(agentId);
    } else if (action === 'QUARANTINE') {
      signetAdapterManager.updateCertificateStatus(agentId, 'QUARANTINED', reason || 'Quarantine order');
      await agentStateManager.quarantine(agentId);
    } else {
      signetAdapterManager.updateCertificateStatus(agentId, 'ACTIVE');
      await agentStateManager.activate(agentId);
    }

    const propagationTimeMs = Number((performance.now() - start).toFixed(2));

    return reply.send({
      success: true,
      agentId,
      action,
      measuredPropagationTimeMs: propagationTimeMs,
      timestamp: new Date().toISOString()
    });
  });

  // GET /api/v1/signet/governance-scenarios
  app.get('/signet/governance-scenarios', async (request, reply) => {
    const { runAllGovernanceScenarios } = await import('@signet/signet-adapter');
    const results = await runAllGovernanceScenarios();
    return reply.send({
      summary: {
        total: results.length,
        passed: results.filter(r => r.status === 'PASS').length,
        failed: results.filter(r => r.status === 'FAIL').length,
        blocked: results.filter(r => r.status === 'BLOCKED').length,
        lastRun: new Date().toISOString()
      },
      scenarios: results
    });
  });

  // POST /api/v1/signet/run-scenario
  app.post('/signet/run-scenario', async (request, reply) => {
    const schema = z.object({
      scenarioId: z.string().optional()
    });
    const { scenarioId } = schema.parse(request.body || {});
    const { runGovernanceScenario, runAllGovernanceScenarios } = await import('@signet/signet-adapter');

    if (!scenarioId || scenarioId === 'ALL') {
      const results = await runAllGovernanceScenarios();
      return reply.send({ scenarios: results });
    }

    const singleResult = await runGovernanceScenario(scenarioId);
    return reply.send({ scenario: singleResult });
  });

  // GET /api/v1/signet/dlp-events
  app.get('/signet/dlp-events', async (request, reply) => {
    const events = signetEventCollector.getDlpEvents(100);
    return reply.send(events);
  });

  // GET /api/v1/signet/kill-switch-status
  app.get('/signet/kill-switch-status', async (request, reply) => {
    const certs = signetAdapterManager.getCertificates();
    const agents = await Promise.all(
      Object.values(certs).map(async (c) => {
        const dbStatus = await agentStateManager.getStatus(c.agentId);
        return {
          agentId: c.agentId,
          certificateId: c.certificateId,
          riskTier: c.riskTier,
          status: dbStatus,
          certStatus: c.validity.status,
          isTerminated: dbStatus === 'KILLED' || c.validity.status === 'KILLED',
          isQuarantined: dbStatus === 'QUARANTINED' || c.validity.status === 'QUARANTINED'
        };
      })
    );
    return reply.send(agents);
  });

  // GET /api/v1/signet/evidence
  app.get('/signet/evidence', async (request, reply) => {
    const events = signetEventCollector.getEvents(100);
    // Categorize events into Application Audit, Mock Signet, and Real Signet
    const categorized = events.map(e => ({
      ...e,
      verificationLevel: e.source === 'SIGNET_REAL' ? 'EXTERNALLY_VERIFIED_SIGNET' : e.source === 'SIGNET_MOCK' ? 'SIMULATED_MOCK_SIGNET' : 'APPLICATION_INTERNAL'
    }));
    return reply.send(categorized);
  });
}
