import { SignetPolicyDecision } from '@signet/shared';
import { SignetGatewayClient } from './gatewayClient.js';
import { SignetAdapterRequest } from '../types.js';

export class SignetPolicyDecisionClient {
  constructor(private gatewayClient: SignetGatewayClient) {}

  async evaluate(req: SignetAdapterRequest, certId?: string, workloadId?: string): Promise<SignetPolicyDecision> {
    const start = Date.now();
    const correlationId = `corr-sgn-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const decisionPayload = {
      correlationId,
      agentId: req.agentId,
      action: req.action,
      model: req.model,
      toolName: req.toolName,
      toolArgs: req.toolArgs,
      targetAgentId: req.targetAgentId,
      prompt: req.prompt,
      context: req.context
    };

    const response = await this.gatewayClient.decide(decisionPayload, certId, workloadId);
    const latencyMs = Date.now() - start;

    return {
      allowed: response.decision === 'ALLOW',
      decision: response.decision || (response.allowed ? 'ALLOW' : 'DENY'),
      reason: response.reason || (response.allowed ? 'Policy criteria met' : 'Signet policy denial'),
      ruleId: response.ruleId,
      action: req.action,
      agentId: req.agentId,
      correlationId: response.correlationId || correlationId,
      simulated: false,
      dlpDetected: Boolean(response.dlpDetected),
      dlpCategory: response.dlpCategory,
      maskedContent: response.maskedContent,
      evidenceRef: response.evidenceRef,
      latencyMs,
      timestamp: new Date().toISOString()
    };
  }
}
