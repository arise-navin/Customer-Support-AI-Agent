import { SignetPolicyDecision } from '@signet/shared';

export interface SignetEvidenceEvent {
  id: string;
  evidenceRef: string;
  correlationId: string;
  agentId: string;
  action: string;
  decision: string;
  reason: string;
  simulated: boolean;
  source: 'APPLICATION_AUDIT' | 'SIGNET_MOCK' | 'SIGNET_REAL';
  dlpCategory?: string;
  maskedPayload?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export class SignetEventCollector {
  private events: SignetEvidenceEvent[] = [];
  private maxBufferSize: number = 500;

  recordDecision(decision: SignetPolicyDecision, source: 'SIGNET_MOCK' | 'SIGNET_REAL', metadata?: Record<string, any>) {
    const event: SignetEvidenceEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      evidenceRef: decision.evidenceRef || `ev-sgn-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      correlationId: decision.correlationId,
      agentId: decision.agentId,
      action: decision.action,
      decision: decision.decision,
      reason: decision.reason,
      simulated: decision.simulated,
      source,
      dlpCategory: decision.dlpCategory,
      maskedPayload: decision.maskedContent,
      timestamp: decision.timestamp || new Date().toISOString(),
      metadata
    };

    this.events.unshift(event);
    if (this.events.length > this.maxBufferSize) {
      this.events = this.events.slice(0, this.maxBufferSize);
    }

    return event;
  }

  getEvents(limit: number = 50, filter?: { agentId?: string; simulated?: boolean; dlpOnly?: boolean }): SignetEvidenceEvent[] {
    let filtered = this.events;
    if (filter?.agentId) {
      filtered = filtered.filter((e) => e.agentId === filter.agentId);
    }
    if (filter?.simulated !== undefined) {
      filtered = filtered.filter((e) => e.simulated === filter.simulated);
    }
    if (filter?.dlpOnly) {
      filtered = filtered.filter((e) => Boolean(e.dlpCategory));
    }
    return filtered.slice(0, limit);
  }

  getDlpEvents(limit: number = 50): SignetEvidenceEvent[] {
    return this.events.filter((e) => Boolean(e.dlpCategory)).slice(0, limit);
  }

  clear() {
    this.events = [];
  }
}

export const signetEventCollector = new SignetEventCollector();
