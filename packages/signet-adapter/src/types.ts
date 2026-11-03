import { SignetAgentCertificate, SignetPolicyDecision, ExecutionMode } from '@signet/shared';

export interface SignetAdapterRequest {
  agentId: string;
  action: 'llm_completion' | 'tool_execution' | 'agent_handoff';
  model?: string;
  prompt?: string;
  messages?: Array<{ role: string; content: string }>;
  toolName?: string;
  toolArgs?: Record<string, any>;
  targetAgentId?: string;
  context?: {
    customerId?: string;
    orderId?: string;
    conversationId?: string;
  };
}

export interface SignetAdapterResponse {
  allowed: boolean;
  decision: SignetPolicyDecision;
  result?: any;
  simulated: boolean;
  source: 'DIRECT_OLLAMA' | 'SIGNET_MOCK' | 'SIGNET_REAL' | 'SIGNET_HYBRID_EDGE';
  evidenceRef?: string;
  latencyMs: number;
}

export interface SignetAdapter {
  readonly mode: ExecutionMode;
  evaluatePolicy(req: SignetAdapterRequest): Promise<SignetPolicyDecision>;
  executeGovernedLlm(req: SignetAdapterRequest, localFallbackFn: () => Promise<any>): Promise<SignetAdapterResponse>;
  executeGovernedTool(req: SignetAdapterRequest, localToolFn: () => Promise<any>): Promise<SignetAdapterResponse>;
  validateCertificate(agentId: string): Promise<{ valid: boolean; reason?: string; certificate?: SignetAgentCertificate }>;
}

export const DEFAULT_AGENT_CERTIFICATES: Record<string, SignetAgentCertificate> = {
  'support-agent-001': {
    agentId: 'support-agent-001',
    workloadIdentity: 'spiffe://signet.internal/ns/support/sa/support-agent-001',
    certificateId: 'cert-sgn-support-001-v1',
    riskTier: 'T3',
    autonomyLevel: 'L2',
    allowedModel: 'beam:cloud',
    allowedTools: [
      'get_customer_profile',
      'get_order_status',
      'search_knowledge_base',
      'create_support_ticket'
    ],
    dataClasses: ['PUBLIC_KB', 'CUSTOMER_BASIC', 'ORDER_STATUS'],
    limits: {
      maxRequestsPerMinute: 60,
      maxTokensPerTurn: 4096
    },
    validity: {
      issuedAt: '2026-01-01T00:00:00Z',
      expiresAt: '2027-01-01T00:00:00Z',
      status: 'ACTIVE'
    }
  },
  'refund-agent-002': {
    agentId: 'refund-agent-002',
    workloadIdentity: 'spiffe://signet.internal/ns/finance/sa/refund-agent-002',
    certificateId: 'cert-sgn-refund-002-v1',
    riskTier: 'T2',
    autonomyLevel: 'L1',
    allowedModel: 'beam:cloud',
    allowedTools: [
      'get_payment_status',
      'check_refund_eligibility',
      'calculate_refund',
      'create_refund_request',
      'execute_approved_refund'
    ],
    dataClasses: ['FINANCIAL_DATA', 'PAYMENT_RECORDS', 'CUSTOMER_BILLING'],
    limits: {
      maxRequestsPerMinute: 30,
      maxTokensPerTurn: 4096
    },
    validity: {
      issuedAt: '2026-01-01T00:00:00Z',
      expiresAt: '2027-01-01T00:00:00Z',
      status: 'ACTIVE'
    }
  },
  'order-agent-003': {
    agentId: 'order-agent-003',
    workloadIdentity: 'spiffe://signet.internal/ns/logistics/sa/order-agent-003',
    certificateId: 'cert-sgn-order-003-v1',
    riskTier: 'T2',
    autonomyLevel: 'L2',
    allowedModel: 'beam:cloud',
    allowedTools: [
      'get_order_details',
      'track_shipment',
      'request_order_cancellation',
      'update_delivery_preference'
    ],
    dataClasses: ['ORDER_DETAILS', 'SHIPPING_CARRIER_DATA'],
    limits: {
      maxRequestsPerMinute: 45,
      maxTokensPerTurn: 4096
    },
    validity: {
      issuedAt: '2026-01-01T00:00:00Z',
      expiresAt: '2027-01-01T00:00:00Z',
      status: 'ACTIVE'
    }
  },
  'escalation-agent-004': {
    agentId: 'escalation-agent-004',
    workloadIdentity: 'spiffe://signet.internal/ns/security/sa/escalation-agent-004',
    certificateId: 'cert-sgn-escalation-004-v1',
    riskTier: 'T2',
    autonomyLevel: 'L2',
    allowedModel: 'beam:cloud',
    allowedTools: [
      'create_escalation',
      'create_security_incident',
      'request_supervisor_review',
      'get_ticket_history'
    ],
    dataClasses: ['SECURITY_INCIDENTS', 'TICKET_AUDIT', 'ESCALATIONS'],
    limits: {
      maxRequestsPerMinute: 30,
      maxTokensPerTurn: 4096
    },
    validity: {
      issuedAt: '2026-01-01T00:00:00Z',
      expiresAt: '2027-01-01T00:00:00Z',
      status: 'ACTIVE'
    }
  }
};
