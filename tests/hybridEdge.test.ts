import { describe, expect, it, beforeEach } from 'vitest';
import { buildApp } from '../apps/backend/src/app.js';
import { signetAdapterManager } from '@signet/signet-adapter';

describe('Signet Hybrid Edge Runner (MID Server Style) Architecture Tests', () => {
  const app = buildApp();
  const runner = signetAdapterManager.getHybridRunner();
  const hybridAdapter = signetAdapterManager.getHybridAdapter();

  beforeEach(() => {
    signetAdapterManager.setMode('SIGNET_HYBRID_EDGE');
  });

  it('1. should configure and activate SIGNET_HYBRID_EDGE mode', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/signet/config',
      payload: {
        executionMode: 'SIGNET_HYBRID_EDGE'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.executionMode).toBe('SIGNET_HYBRID_EDGE');
    expect(body.hybridEdge).toBeDefined();
    expect(body.hybridEdge.dataResidencyEnforced).toBe(true);
    expect(body.hybridEdge.edgeRunnerId).toMatch(/^edge_runner_/);
  });

  it('2. should verify Zero Inbound Ports and Data Privacy Guarantee via /api/v1/signet/hybrid', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/signet/hybrid'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.architecture).toBe('MID_SERVER_OUTBOUND_TUNNEL');
    expect(body.inboundPortsOpen).toBe(0); // Zero inbound open ports
    expect(body.dataPrivacy.promptsLeaveOnPrem).toBe(false);
    expect(body.dataPrivacy.responsesLeaveOnPrem).toBe(false);
    expect(body.dataPrivacy.localDlpEnforced).toBe(true);
    expect(body.dataPrivacy.sanitizedMetadataOnly).toBe(true);
  });

  it('3. should execute local on-premise DLP and block Payment Card data on the Edge', async () => {
    const decision = await hybridAdapter.evaluatePolicy({
      agentId: 'support-agent-001',
      action: 'llm_completion',
      prompt: 'My credit card number is 4111 2222 3333 4444, please check my refund.'
    });

    expect(decision.allowed).toBe(false);
    expect(decision.decision).toBe('DENY');
    expect(decision.dlpDetected).toBe(true);
    expect(decision.dlpCategory).toBe('PAYMENT_CARD');
    expect(decision.ruleId).toBe('SGC-DATA-002-PCI-DLP');
  });

  it('4. should execute local on-premise DLP and block API secrets/tokens on the Edge', async () => {
    const decision = await hybridAdapter.evaluatePolicy({
      agentId: 'support-agent-001',
      action: 'llm_completion',
      prompt: 'Here is my secret token: sk-live-99218491823912839123891238'
    });

    expect(decision.allowed).toBe(false);
    expect(decision.decision).toBe('DENY');
    expect(decision.dlpDetected).toBe(true);
    expect(decision.dlpCategory).toBe('CREDENTIAL');
    expect(decision.ruleId).toBe('SGC-IDN-004-SECRETS-LEAK');
  });

  it('5. should enforce tool manifest boundaries locally on the Edge', async () => {
    // support-agent-001 is forbidden from executing financial refunds
    const decision = await hybridAdapter.evaluatePolicy({
      agentId: 'support-agent-001',
      action: 'tool_execution',
      toolName: 'execute_approved_refund',
      toolArgs: { amount: 500 }
    });

    expect(decision.allowed).toBe(false);
    expect(decision.decision).toBe('DENY');
    expect(decision.ruleId).toBe('SGC-TOOL-004-MANIFEST-ENFORCE');
    expect(decision.reason).toContain('is not permitted by certificate');
  });

  it('6. should allow valid requests and queue sanitized metadata for outbound heartbeat', async () => {
    const decision = await hybridAdapter.evaluatePolicy({
      agentId: 'support-agent-001',
      action: 'llm_completion',
      prompt: 'What are your store hours?'
    });

    expect(decision.allowed).toBe(true);
    expect(decision.decision).toBe('ALLOW');

    // Verify metadata was queued in runner for outbound sync
    const conf = runner.getConfig();
    expect(conf.queuedMetadataCount).toBeGreaterThan(0);
  });

  it('7. should execute manual outbound heartbeat sync', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/signet/hybrid/sync'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.tunnelStatus).toBeDefined();
    expect(typeof body.latencyMs).toBe('number');
  });

  it('8. should execute remote cloud commands delivered through outbound polling', async () => {
    // Simulate receiving a remote KILL command from Cloud Control Plane
    const remoteCommand = {
      id: 'cmd-cloud-001',
      action: 'KILL_AGENT' as const,
      agentId: 'order-agent-003',
      reason: 'Remote kill triggered from SaaS Web Console',
      issuedAt: new Date().toISOString()
    };

    // Update state via adapter manager (simulating command callback)
    signetAdapterManager.updateCertificateStatus('order-agent-003', 'KILLED', remoteCommand.reason);

    // Verify agent is immediately blocked on Edge
    const decision = await hybridAdapter.evaluatePolicy({
      agentId: 'order-agent-003',
      action: 'llm_completion',
      prompt: 'Where is my order?'
    });

    expect(decision.allowed).toBe(false);
    expect(decision.decision).toBe('DENY');
    expect(decision.reason).toContain('KILLED');

    // Restore back to active
    signetAdapterManager.updateCertificateStatus('order-agent-003', 'ACTIVE');
  });

  it('9. should provide complete Offline Tolerance when SaaS Cloud is unreachable', async () => {
    // Configure unreachable SaaS endpoint
    runner.updateConfig({ saasEndpoint: 'http://127.0.0.1:59998' });
    const syncRes = await runner.syncHeartbeatNow();

    // Tunnel marks DEGRADED/OFFLINE but local Edge enforcement stays fully operational
    expect(syncRes.success).toBe(false);
    expect(syncRes.tunnelStatus).toBe('DEGRADED');

    // Local policy evaluation continues seamlessly using cached certificates & rules
    const localDecision = await hybridAdapter.evaluatePolicy({
      agentId: 'support-agent-001',
      action: 'llm_completion',
      prompt: 'Can you look up my order status?'
    });

    expect(localDecision.allowed).toBe(true);
    expect(localDecision.decision).toBe('ALLOW');
    expect(localDecision.ruleId).toBe('SGC-GOV-001-EDGE-PASSTHROUGH');
  });
});

