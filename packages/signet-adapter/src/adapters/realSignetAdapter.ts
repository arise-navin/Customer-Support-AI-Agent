import { ExecutionMode, SignetPolicyDecision, SignetAgentCertificate } from '@signet/shared';
import { SignetAdapter, SignetAdapterRequest, SignetAdapterResponse, DEFAULT_AGENT_CERTIFICATES } from '../types.js';
import { SignetGatewayClient, SignetGatewayError } from '../clients/gatewayClient.js';
import { SignetPolicyDecisionClient } from '../clients/policyClient.js';
import { signetEventCollector } from '../clients/eventCollector.js';

export class RealSignetAdapter implements SignetAdapter {
  readonly mode: ExecutionMode = 'SIGNET_REAL';
  private policyClient: SignetPolicyDecisionClient;

  constructor(private gatewayClient: SignetGatewayClient) {
    this.policyClient = new SignetPolicyDecisionClient(gatewayClient);
  }

  async validateCertificate(agentId: string): Promise<{ valid: boolean; reason?: string; certificate?: SignetAgentCertificate }> {
    const cert = DEFAULT_AGENT_CERTIFICATES[agentId];
    if (!cert) {
      return { valid: false, reason: `Missing agent certificate for agent '${agentId}'` };
    }

    try {
      // Validate certificate against Signet Gateway
      const decision = await this.gatewayClient.decide({
        action: 'validate_certificate',
        agentId,
        certificateId: cert.certificateId,
        workloadIdentity: cert.workloadIdentity
      }, cert.certificateId, cert.workloadIdentity);

      if (decision.allowed === false) {
        return { valid: false, reason: decision.reason || 'Certificate rejected by Signet Gateway', certificate: cert };
      }
      return { valid: true, certificate: cert };
    } catch (err: any) {
      // Fail closed: If gateway cannot be contacted, do not permit access
      throw new SignetGatewayError(
        `Failed to validate certificate against Signet Gateway: ${err.message}. Failing closed.`,
        503,
        '/v1/decide'
      );
    }
  }

  async evaluatePolicy(req: SignetAdapterRequest): Promise<SignetPolicyDecision> {
    const cert = DEFAULT_AGENT_CERTIFICATES[req.agentId];
    try {
      const decision = await this.policyClient.evaluate(
        req,
        cert?.certificateId,
        cert?.workloadIdentity
      );
      signetEventCollector.recordDecision(decision, 'SIGNET_REAL');
      return decision;
    } catch (err: any) {
      // Critical Rule: Gateway errors fail closed. NO silent direct-Ollama fallback.
      throw new SignetGatewayError(
        `Signet Gateway policy evaluation failed: ${err.message}. Request blocked (fail-closed).`,
        err.statusCode || 502,
        '/v1/decide'
      );
    }
  }

  async executeGovernedLlm(req: SignetAdapterRequest, localFallbackFn: () => Promise<any>): Promise<SignetAdapterResponse> {
    const decision = await this.evaluatePolicy(req);

    if (!decision.allowed) {
      return {
        allowed: false,
        decision,
        simulated: false,
        source: 'SIGNET_REAL',
        evidenceRef: decision.evidenceRef,
        latencyMs: decision.latencyMs
      };
    }

    const cert = DEFAULT_AGENT_CERTIFICATES[req.agentId];
    const start = Date.now();

    try {
      // Proxy LLM invocation through Signet Gateway
      const payload = {
        model: req.model || cert?.allowedModel || 'beam:cloud',
        messages: req.messages || [{ role: 'user', content: req.prompt || '' }]
      };

      const gatewayResponse = await this.gatewayClient.proxyLlmCompletion(
        payload,
        cert?.certificateId,
        cert?.workloadIdentity
      );

      const latencyMs = Date.now() - start;
      return {
        allowed: true,
        decision,
        result: gatewayResponse,
        simulated: false,
        source: 'SIGNET_REAL',
        evidenceRef: decision.evidenceRef,
        latencyMs
      };
    } catch (err: any) {
      // Fail closed: Do NOT fall back to local Ollama when in SIGNET_REAL mode!
      throw new SignetGatewayError(
        `Signet Gateway LLM execution failed: ${err.message}. Request failed closed without fallback.`,
        err.statusCode || 502,
        '/v1/llm/openai/chat/completions'
      );
    }
  }

  async executeGovernedTool(req: SignetAdapterRequest, localToolFn: () => Promise<any>): Promise<SignetAdapterResponse> {
    const decision = await this.evaluatePolicy(req);

    if (!decision.allowed) {
      return {
        allowed: false,
        decision,
        simulated: false,
        source: 'SIGNET_REAL',
        evidenceRef: decision.evidenceRef,
        latencyMs: decision.latencyMs
      };
    }

    const cert = DEFAULT_AGENT_CERTIFICATES[req.agentId];
    const start = Date.now();

    try {
      // Perform local tool execution under Signet authorization
      const result = await localToolFn();
      const latencyMs = Date.now() - start;

      // Report tool completion to Signet Gateway
      await this.gatewayClient.decide({
        action: 'report_tool_completion',
        agentId: req.agentId,
        toolName: req.toolName,
        success: true,
        evidenceRef: decision.evidenceRef,
        durationMs: latencyMs
      }, cert?.certificateId, cert?.workloadIdentity).catch(() => {});

      return {
        allowed: true,
        decision,
        result,
        simulated: false,
        source: 'SIGNET_REAL',
        evidenceRef: decision.evidenceRef,
        latencyMs
      };
    } catch (err: any) {
      throw new SignetGatewayError(
        `Governed tool execution failed under Signet: ${err.message}`,
        500,
        req.toolName
      );
    }
  }
}
