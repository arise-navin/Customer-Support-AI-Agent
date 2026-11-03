import { ExecutionMode, SignetPolicyDecision, SignetAgentCertificate } from '@signet/shared';
import { SignetAdapter, SignetAdapterRequest, SignetAdapterResponse, DEFAULT_AGENT_CERTIFICATES } from '../types.js';
import { HybridEdgeRunnerService } from '../hybrid/hybridEdgeRunner.js';
import { signetEventCollector } from '../clients/eventCollector.js';

export class HybridEdgeAdapter implements SignetAdapter {
  readonly mode: ExecutionMode = 'SIGNET_HYBRID_EDGE';
  private certificates: Record<string, SignetAgentCertificate>;
  private killedAgents = new Set<string>();
  private quarantinedAgents = new Set<string>();

  constructor(
    private runnerService: HybridEdgeRunnerService,
    customCertificates?: Record<string, SignetAgentCertificate>
  ) {
    this.certificates = customCertificates || JSON.parse(JSON.stringify(DEFAULT_AGENT_CERTIFICATES));
  }

  setCertificateStatus(
    agentId: string,
    status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'QUARANTINED' | 'KILLED',
    reason?: string
  ) {
    if (this.certificates[agentId]) {
      this.certificates[agentId].validity.status = status;
      if (reason) this.certificates[agentId].validity.revocationReason = reason;
    }
    if (status === 'KILLED') this.killedAgents.add(agentId);
    else this.killedAgents.delete(agentId);

    if (status === 'QUARANTINED') this.quarantinedAgents.add(agentId);
    else this.quarantinedAgents.delete(agentId);
  }

  async validateCertificate(
    agentId: string
  ): Promise<{ valid: boolean; reason?: string; certificate?: SignetAgentCertificate }> {
    const cert = this.certificates[agentId];
    if (!cert) {
      return { valid: false, reason: `Agent '${agentId}' has no registered certificate in Edge cache.` };
    }

    if (this.killedAgents.has(agentId) || cert.validity.status === 'KILLED') {
      return { valid: false, reason: `Agent '${agentId}' is KILLED by administrative kill switch.`, certificate: cert };
    }

    if (this.quarantinedAgents.has(agentId) || cert.validity.status === 'QUARANTINED') {
      return { valid: false, reason: `Agent '${agentId}' is under security QUARANTINE.`, certificate: cert };
    }

    if (cert.validity.status === 'EXPIRED' || new Date(cert.validity.expiresAt).getTime() < Date.now()) {
      return { valid: false, reason: `Agent certificate '${cert.certificateId}' is expired.`, certificate: cert };
    }

    return { valid: true, certificate: cert };
  }

  async evaluatePolicy(req: SignetAdapterRequest): Promise<SignetPolicyDecision> {
    const start = Date.now();
    const cert = this.certificates[req.agentId];
    const correlationId = `corr-edge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // 1. Certificate & Kill verification
    const certCheck = await this.validateCertificate(req.agentId);
    if (!certCheck.valid) {
      const decision: SignetPolicyDecision = {
        allowed: false,
        decision: 'DENY',
        reason: certCheck.reason || 'Certificate check failed on Edge',
        ruleId: 'SGC-IDN-001-CERT-VALIDATION',
        action: req.action,
        agentId: req.agentId,
        correlationId,
        simulated: false,
        dlpDetected: false,
        evidenceRef: `ev-edge-deny-${Date.now()}`,
        latencyMs: Date.now() - start,
        timestamp: new Date().toISOString()
      };
      this.recordAndQueue(decision);
      return decision;
    }

    const textToScan = [
      req.prompt || '',
      ...(req.messages?.map((m) => m.content) || []),
      JSON.stringify(req.toolArgs || {})
    ].join(' ');

    // 2. Local DLP Engine: Payment Cards (PCI-DSS / D5 Data Residency)
    const cardMatch = textToScan.match(/\b(?:\d[ -]*?){13,16}\b/);
    if (cardMatch) {
      const decision: SignetPolicyDecision = {
        allowed: false,
        decision: 'DENY',
        reason: 'Signet Edge DLP Blocked: Unmasked payment card number detected in prompt/tool arguments.',
        ruleId: 'SGC-DATA-002-PCI-DLP',
        action: req.action,
        agentId: req.agentId,
        correlationId,
        simulated: false,
        dlpDetected: true,
        dlpCategory: 'PAYMENT_CARD',
        evidenceRef: `ev-edge-dlp-card-${Date.now()}`,
        latencyMs: Date.now() - start,
        timestamp: new Date().toISOString()
      };
      this.recordAndQueue(decision);
      return decision;
    }

    // 3. Local DLP Engine: API Secrets & Private Keys
    const secretMatch = textToScan.match(/(?:sk-[a-zA-Z0-9_\-]{16,}|ghp_[a-zA-Z0-9]{20,}|agt_sec_[a-zA-Z0-9]{20,}|bearer\s+[a-zA-Z0-9_\-\.]{16,})/i);
    if (secretMatch) {
      const decision: SignetPolicyDecision = {
        allowed: false,
        decision: 'DENY',
        reason: 'Signet Edge DLP Blocked: High-entropy secret token or API key detected.',
        ruleId: 'SGC-IDN-004-SECRETS-LEAK',
        action: req.action,
        agentId: req.agentId,
        correlationId,
        simulated: false,
        dlpDetected: true,
        dlpCategory: 'CREDENTIAL',
        evidenceRef: `ev-edge-dlp-secret-${Date.now()}`,
        latencyMs: Date.now() - start,
        timestamp: new Date().toISOString()
      };
      this.recordAndQueue(decision);
      return decision;
    }

    // 4. Local Guardrails: Prompt Injection / Jailbreak Attempt
    const injectionMatch = textToScan.match(/(?:ignore previous instructions|system override|jailbreak|bypass all filters)/i);
    if (injectionMatch) {
      const decision: SignetPolicyDecision = {
        allowed: false,
        decision: 'QUARANTINE',
        reason: 'Signet Edge Guardrails: Prompt injection pattern detected. Escalated to Quarantine.',
        ruleId: 'SGC-SEC-003-PROMPT-INJECTION',
        action: req.action,
        agentId: req.agentId,
        correlationId,
        simulated: false,
        dlpDetected: true,
        dlpCategory: 'PROMPT_INJECTION',
        evidenceRef: `ev-edge-guardrail-${Date.now()}`,
        latencyMs: Date.now() - start,
        timestamp: new Date().toISOString()
      };
      this.recordAndQueue(decision);
      return decision;
    }

    // 5. Tool Manifest Verification (out-of-manifest blocking)
    if (req.action === 'tool_execution' && req.toolName && cert) {
      const allowedTools = cert.allowedTools || [];
      if (!allowedTools.includes(req.toolName)) {
        const decision: SignetPolicyDecision = {
          allowed: false,
          decision: 'DENY',
          reason: `Signet Edge Manifest Block: Tool '${req.toolName}' is not permitted by certificate '${cert.certificateId}'.`,
          ruleId: 'SGC-TOOL-004-MANIFEST-ENFORCE',
          action: req.action,
          agentId: req.agentId,
          correlationId,
          simulated: false,
          dlpDetected: false,
          evidenceRef: `ev-edge-tool-deny-${Date.now()}`,
          latencyMs: Date.now() - start,
          timestamp: new Date().toISOString()
        };
        this.recordAndQueue(decision);
        return decision;
      }
    }

    // Default Allow
    const decision: SignetPolicyDecision = {
      allowed: true,
      decision: 'ALLOW',
      reason: 'Signet Hybrid Edge: Verified against on-premise cached policy and DLP rules.',
      ruleId: 'SGC-GOV-001-EDGE-PASSTHROUGH',
      action: req.action,
      agentId: req.agentId,
      correlationId,
      simulated: false,
      dlpDetected: false,
      evidenceRef: `ev-edge-allow-${Date.now()}`,
      latencyMs: Date.now() - start,
      timestamp: new Date().toISOString()
    };

    this.recordAndQueue(decision);
    return decision;
  }

  private recordAndQueue(decision: SignetPolicyDecision) {
    signetEventCollector.recordDecision(decision, 'SIGNET_REAL');
    this.runnerService.queueMetadataDigest({
      agentId: decision.agentId,
      action: decision.action,
      decision: decision.decision,
      ruleId: decision.ruleId,
      latencyMs: decision.latencyMs,
      timestamp: decision.timestamp,
      dlpDetected: decision.dlpDetected,
      evidenceRef: decision.evidenceRef
    });
  }

  async executeGovernedLlm(
    req: SignetAdapterRequest,
    localFallbackFn: () => Promise<any>
  ): Promise<SignetAdapterResponse> {
    const start = Date.now();
    const decision = await this.evaluatePolicy(req);

    if (!decision.allowed) {
      return {
        allowed: false,
        decision,
        simulated: false,
        source: 'SIGNET_HYBRID_EDGE',
        evidenceRef: decision.evidenceRef,
        latencyMs: Date.now() - start
      };
    }

    // Execute local LLM on-premise (Data Never Leaves - D5)
    const result = await localFallbackFn();
    const latencyMs = Date.now() - start;

    return {
      allowed: true,
      decision,
      result,
      simulated: false,
      source: 'SIGNET_HYBRID_EDGE',
      evidenceRef: decision.evidenceRef,
      latencyMs
    };
  }

  async executeGovernedTool(
    req: SignetAdapterRequest,
    localToolFn: () => Promise<any>
  ): Promise<SignetAdapterResponse> {
    const start = Date.now();
    const decision = await this.evaluatePolicy(req);

    if (!decision.allowed) {
      return {
        allowed: false,
        decision,
        simulated: false,
        source: 'SIGNET_HYBRID_EDGE',
        evidenceRef: decision.evidenceRef,
        latencyMs: Date.now() - start
      };
    }

    // Execute tool locally on-premise
    const result = await localToolFn();
    const latencyMs = Date.now() - start;

    return {
      allowed: true,
      decision,
      result,
      simulated: false,
      source: 'SIGNET_HYBRID_EDGE',
      evidenceRef: decision.evidenceRef,
      latencyMs
    };
  }
}
