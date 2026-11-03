import { ExecutionMode, SignetPolicyDecision, SignetAgentCertificate } from '@signet/shared';
import { SignetAdapter, SignetAdapterRequest, SignetAdapterResponse, DEFAULT_AGENT_CERTIFICATES } from '../types.js';

export class DirectOllamaAdapter implements SignetAdapter {
  readonly mode: ExecutionMode = 'DIRECT_OLLAMA';

  async evaluatePolicy(req: SignetAdapterRequest): Promise<SignetPolicyDecision> {
    const cert = DEFAULT_AGENT_CERTIFICATES[req.agentId];
    return {
      allowed: true,
      decision: 'ALLOW',
      reason: 'Direct Ollama execution: local policy passthrough',
      action: req.action,
      agentId: req.agentId,
      correlationId: `corr-direct-${Date.now()}`,
      simulated: false,
      dlpDetected: false,
      latencyMs: 1,
      timestamp: new Date().toISOString()
    };
  }

  async executeGovernedLlm(req: SignetAdapterRequest, localFallbackFn: () => Promise<any>): Promise<SignetAdapterResponse> {
    const start = Date.now();
    const result = await localFallbackFn();
    const latencyMs = Date.now() - start;

    return {
      allowed: true,
      decision: {
        allowed: true,
        decision: 'ALLOW',
        reason: 'Direct Ollama local inference baseline',
        action: 'llm_completion',
        agentId: req.agentId,
        correlationId: `corr-direct-${Date.now()}`,
        simulated: false,
        dlpDetected: false,
        latencyMs,
        timestamp: new Date().toISOString()
      },
      result,
      simulated: false,
      source: 'DIRECT_OLLAMA',
      latencyMs
    };
  }

  async executeGovernedTool(req: SignetAdapterRequest, localToolFn: () => Promise<any>): Promise<SignetAdapterResponse> {
    const start = Date.now();
    const result = await localToolFn();
    const latencyMs = Date.now() - start;

    return {
      allowed: true,
      decision: {
        allowed: true,
        decision: 'ALLOW',
        reason: 'Direct Ollama local tool execution',
        action: 'tool_execution',
        agentId: req.agentId,
        correlationId: `corr-direct-${Date.now()}`,
        simulated: false,
        dlpDetected: false,
        latencyMs,
        timestamp: new Date().toISOString()
      },
      result,
      simulated: false,
      source: 'DIRECT_OLLAMA',
      latencyMs
    };
  }

  async validateCertificate(agentId: string): Promise<{ valid: boolean; reason?: string; certificate?: SignetAgentCertificate }> {
    const cert = DEFAULT_AGENT_CERTIFICATES[agentId];
    if (!cert) {
      return { valid: false, reason: `Agent ${agentId} has no registered certificate.` };
    }
    return { valid: true, certificate: cert };
  }
}
