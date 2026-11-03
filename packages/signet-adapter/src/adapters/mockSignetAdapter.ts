import { ExecutionMode, SignetPolicyDecision, SignetAgentCertificate } from '@signet/shared';
import { SignetAdapter, SignetAdapterRequest, SignetAdapterResponse, DEFAULT_AGENT_CERTIFICATES } from '../types.js';
import { signetEventCollector } from '../clients/eventCollector.js';

export class MockSignetAdapter implements SignetAdapter {
  readonly mode: ExecutionMode = 'SIGNET_MOCK';
  private certificates: Record<string, SignetAgentCertificate>;
  private killedAgents = new Set<string>();
  private quarantinedAgents = new Set<string>();
  private requestCounts = new Map<string, { count: number; resetAt: number }>();

  constructor(customCertificates?: Record<string, SignetAgentCertificate>) {
    this.certificates = customCertificates || JSON.parse(JSON.stringify(DEFAULT_AGENT_CERTIFICATES));
  }

  setCertificateStatus(agentId: string, status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'QUARANTINED' | 'KILLED', reason?: string) {
    if (this.certificates[agentId]) {
      this.certificates[agentId].validity.status = status;
      if (reason) this.certificates[agentId].validity.revocationReason = reason;
    }
    if (status === 'KILLED') this.killedAgents.add(agentId);
    else this.killedAgents.delete(agentId);

    if (status === 'QUARANTINED') this.quarantinedAgents.add(agentId);
    else this.quarantinedAgents.delete(agentId);
  }

  killAgent(agentId: string) {
    this.setCertificateStatus(agentId, 'KILLED', 'Emergency administrator kill switch activated');
  }

  quarantineAgent(agentId: string) {
    this.setCertificateStatus(agentId, 'QUARANTINED', 'Suspicious activity detected, quarantined for inspection');
  }

  restoreAgent(agentId: string) {
    this.setCertificateStatus(agentId, 'ACTIVE');
  }

  async validateCertificate(agentId: string): Promise<{ valid: boolean; reason?: string; certificate?: SignetAgentCertificate }> {
    const cert = this.certificates[agentId];
    if (!cert) {
      return { valid: false, reason: `Missing agent certificate for agent ID '${agentId}'` };
    }

    if (this.killedAgents.has(agentId) || cert.validity.status === 'KILLED') {
      return { valid: false, reason: `Agent '${agentId}' has been terminated by Kill Switch enforcement`, certificate: cert };
    }

    if (this.quarantinedAgents.has(agentId) || cert.validity.status === 'QUARANTINED') {
      return { valid: false, reason: `Agent '${agentId}' is currently under security quarantine`, certificate: cert };
    }

    if (cert.validity.status === 'REVOKED') {
      return { valid: false, reason: `Agent certificate '${cert.certificateId}' has been revoked`, certificate: cert };
    }

    if (cert.validity.status === 'EXPIRED' || new Date(cert.validity.expiresAt).getTime() < Date.now()) {
      return { valid: false, reason: `Agent certificate '${cert.certificateId}' is expired`, certificate: cert };
    }

    return { valid: true, certificate: cert };
  }

  async evaluatePolicy(req: SignetAdapterRequest): Promise<SignetPolicyDecision> {
    const start = Date.now();
    const correlationId = `corr-sgn-mock-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const evidenceRef = `ev-sgn-mock-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // 1. Certificate Validation
    const certValidation = await this.validateCertificate(req.agentId);
    if (!certValidation.valid) {
      const decision: SignetPolicyDecision = {
        allowed: false,
        decision: certValidation.reason?.includes('quarantine') ? 'QUARANTINE' : 'DENY',
        reason: certValidation.reason || 'Invalid certificate',
        ruleId: 'RULE-CERT-001',
        action: req.action,
        agentId: req.agentId,
        correlationId,
        simulated: true,
        dlpDetected: false,
        evidenceRef,
        latencyMs: Date.now() - start,
        timestamp: new Date().toISOString()
      };
      signetEventCollector.recordDecision(decision, 'SIGNET_MOCK', { certValidation });
      return decision;
    }

    const cert = certValidation.certificate!;

    // 2. Rate Limiting Check
    const now = Date.now();
    const rateWindow = this.requestCounts.get(req.agentId) || { count: 0, resetAt: now + 60000 };
    if (now > rateWindow.resetAt) {
      rateWindow.count = 0;
      rateWindow.resetAt = now + 60000;
    }
    rateWindow.count += 1;
    this.requestCounts.set(req.agentId, rateWindow);

    if (rateWindow.count > cert.limits.maxRequestsPerMinute) {
      const decision: SignetPolicyDecision = {
        allowed: false,
        decision: 'DENY',
        reason: `Agent '${req.agentId}' exceeded rate limit (${cert.limits.maxRequestsPerMinute} req/min)`,
        ruleId: 'RULE-RATE-001',
        action: req.action,
        agentId: req.agentId,
        correlationId,
        simulated: true,
        dlpDetected: false,
        evidenceRef,
        latencyMs: Date.now() - start,
        timestamp: new Date().toISOString()
      };
      signetEventCollector.recordDecision(decision, 'SIGNET_MOCK');
      return decision;
    }

    // 3. Model Authorization
    if (req.action === 'llm_completion' && req.model && req.model !== cert.allowedModel) {
      const decision: SignetPolicyDecision = {
        allowed: false,
        decision: 'DENY',
        reason: `Model '${req.model}' is not authorized. Permitted model: '${cert.allowedModel}'`,
        ruleId: 'RULE-MODEL-001',
        action: req.action,
        agentId: req.agentId,
        correlationId,
        simulated: true,
        dlpDetected: false,
        evidenceRef,
        latencyMs: Date.now() - start,
        timestamp: new Date().toISOString()
      };
      signetEventCollector.recordDecision(decision, 'SIGNET_MOCK');
      return decision;
    }

    // 4. Tool Authorization
    if (req.action === 'tool_execution' && req.toolName) {
      if (!cert.allowedTools.includes(req.toolName)) {
        const decision: SignetPolicyDecision = {
          allowed: false,
          decision: 'DENY',
          reason: `Tool '${req.toolName}' is forbidden for agent '${req.agentId}' (${cert.riskTier})`,
          ruleId: 'RULE-TOOL-001',
          action: req.action,
          agentId: req.agentId,
          correlationId,
          simulated: true,
          dlpDetected: false,
          evidenceRef,
          latencyMs: Date.now() - start,
          timestamp: new Date().toISOString()
        };
        signetEventCollector.recordDecision(decision, 'SIGNET_MOCK');
        return decision;
      }
    }

    // 5. Agent-to-Agent Handoff Verification
    if (req.action === 'agent_handoff' && req.targetAgentId) {
      if (req.targetAgentId === 'escalation-agent-004' && req.agentId !== 'support-agent-001') {
        const decision: SignetPolicyDecision = {
          allowed: false,
          decision: 'DENY',
          reason: `Agent '${req.agentId}' is not authorized to handoff directly to '${req.targetAgentId}'`,
          ruleId: 'RULE-A2A-001',
          action: req.action,
          agentId: req.agentId,
          correlationId,
          simulated: true,
          dlpDetected: false,
          evidenceRef,
          latencyMs: Date.now() - start,
          timestamp: new Date().toISOString()
        };
        signetEventCollector.recordDecision(decision, 'SIGNET_MOCK');
        return decision;
      }
    }

    // 6. DLP Inspection (Cards, API Tokens, Prompt Injection)
    const contentToScan = JSON.stringify({
      prompt: req.prompt,
      messages: req.messages,
      toolArgs: req.toolArgs
    });

    const cardRegex = /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|(?:[0-9]{4}[ -]?){3}[0-9]{4})\b/;
    const tokenRegex = /(?:sgn_live_[a-zA-Z0-9]{20,}|sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{20,})/;
    const injectionRegex = /(?:ignore\s+(?:all|prior|previous)\s+instructions|system\s+prompt\s+override|reveal\s+system\s+prompt|bypass\s+policy)/i;

    let dlpDetected = false;
    let dlpCategory: SignetPolicyDecision['dlpCategory'];
    let maskedContent: string | undefined;

    if (cardRegex.test(contentToScan)) {
      dlpDetected = true;
      dlpCategory = 'PAYMENT_CARD';
      maskedContent = contentToScan.replace(cardRegex, '****-****-****-4242');
    } else if (tokenRegex.test(contentToScan)) {
      dlpDetected = true;
      dlpCategory = 'API_TOKEN';
      maskedContent = contentToScan.replace(tokenRegex, 'sgn_live_****************');
    } else if (injectionRegex.test(contentToScan)) {
      dlpDetected = true;
      dlpCategory = 'PROMPT_INJECTION';
      maskedContent = '[BLOCKED: Prompt Injection Attempt]';
    }

    if (dlpDetected) {
      const decision: SignetPolicyDecision = {
        allowed: dlpCategory !== 'PROMPT_INJECTION', // injection is hard denied, card/token is masked and allowed with DLP log
        decision: dlpCategory === 'PROMPT_INJECTION' ? 'DENY' : 'ALLOW',
        reason: `DLP Signature Detected: ${dlpCategory}`,
        ruleId: `RULE-DLP-${dlpCategory}`,
        action: req.action,
        agentId: req.agentId,
        correlationId,
        simulated: true,
        dlpDetected: true,
        dlpCategory,
        maskedContent,
        evidenceRef,
        latencyMs: Date.now() - start,
        timestamp: new Date().toISOString()
      };
      signetEventCollector.recordDecision(decision, 'SIGNET_MOCK', { dlpCategory });
      return decision;
    }

    // 7. Human in the Loop Approval Rules (e.g. high value actions)
    if (req.toolName === 'execute_approved_refund' && req.toolArgs?.amount > 2000) {
      const decision: SignetPolicyDecision = {
        allowed: false,
        decision: 'REQUIRE_APPROVAL',
        reason: 'Restricted action: refunds over INR 2000 require supervisor authorization signature',
        ruleId: 'RULE-APPROVAL-001',
        action: req.action,
        agentId: req.agentId,
        correlationId,
        simulated: true,
        dlpDetected: false,
        evidenceRef,
        latencyMs: Date.now() - start,
        timestamp: new Date().toISOString()
      };
      signetEventCollector.recordDecision(decision, 'SIGNET_MOCK');
      return decision;
    }

    // 8. Default Allowed
    const decision: SignetPolicyDecision = {
      allowed: true,
      decision: 'ALLOW',
      reason: 'Signet Mock Policy Evaluator: all criteria satisfied',
      action: req.action,
      agentId: req.agentId,
      correlationId,
      simulated: true,
      dlpDetected: false,
      evidenceRef,
      latencyMs: Date.now() - start,
      timestamp: new Date().toISOString()
    };
    signetEventCollector.recordDecision(decision, 'SIGNET_MOCK');
    return decision;
  }

  async executeGovernedLlm(req: SignetAdapterRequest, localFallbackFn: () => Promise<any>): Promise<SignetAdapterResponse> {
    const decision = await this.evaluatePolicy(req);
    if (!decision.allowed) {
      return {
        allowed: false,
        decision,
        simulated: true,
        source: 'SIGNET_MOCK',
        evidenceRef: decision.evidenceRef,
        latencyMs: decision.latencyMs
      };
    }

    const start = Date.now();
    const result = await localFallbackFn();
    const latencyMs = Date.now() - start + decision.latencyMs;

    return {
      allowed: true,
      decision,
      result,
      simulated: true,
      source: 'SIGNET_MOCK',
      evidenceRef: decision.evidenceRef,
      latencyMs
    };
  }

  async executeGovernedTool(req: SignetAdapterRequest, localToolFn: () => Promise<any>): Promise<SignetAdapterResponse> {
    const decision = await this.evaluatePolicy(req);
    if (!decision.allowed) {
      return {
        allowed: false,
        decision,
        simulated: true,
        source: 'SIGNET_MOCK',
        evidenceRef: decision.evidenceRef,
        latencyMs: decision.latencyMs
      };
    }

    const start = Date.now();
    const result = await localToolFn();
    const latencyMs = Date.now() - start + decision.latencyMs;

    return {
      allowed: true,
      decision,
      result,
      simulated: true,
      source: 'SIGNET_MOCK',
      evidenceRef: decision.evidenceRef,
      latencyMs
    };
  }
}
