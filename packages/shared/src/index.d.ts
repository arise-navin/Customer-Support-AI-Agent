import { z } from 'zod';
export interface HealthResponse {
    status: 'healthy' | 'degraded' | 'unhealthy';
    service: string;
    version?: string;
    timestamp?: string;
    database?: 'connected' | 'disconnected' | 'unknown';
    ollama?: 'connected' | 'unreachable' | 'unknown';
    activeModel?: string;
}
export declare const HealthResponseSchema: z.ZodObject<{
    status: z.ZodEnum<["healthy", "degraded", "unhealthy"]>;
    service: z.ZodString;
    version: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodOptional<z.ZodString>;
    database: z.ZodOptional<z.ZodEnum<["connected", "disconnected", "unknown"]>>;
    ollama: z.ZodOptional<z.ZodEnum<["connected", "unreachable", "unknown"]>>;
    activeModel: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "healthy" | "degraded" | "unhealthy";
    service: string;
    timestamp?: string | undefined;
    version?: string | undefined;
    database?: "connected" | "unknown" | "disconnected" | undefined;
    ollama?: "connected" | "unknown" | "unreachable" | undefined;
    activeModel?: string | undefined;
}, {
    status: "healthy" | "degraded" | "unhealthy";
    service: string;
    timestamp?: string | undefined;
    version?: string | undefined;
    database?: "connected" | "unknown" | "disconnected" | undefined;
    ollama?: "connected" | "unknown" | "unreachable" | undefined;
    activeModel?: string | undefined;
}>;
export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'AGENT' | 'CUSTOMER';
export interface UserSession {
    id: string;
    userId: string;
    token: string;
    expiresAt: string;
}
export interface Customer {
    id: string;
    tenantId: string;
    email: string;
    fullName: string;
    phone?: string | null;
    tier: 'STANDARD' | 'SILVER' | 'GOLD' | 'VIP';
    createdAt: string;
    updatedAt: string;
    addresses?: CustomerAddress[];
}
export interface CustomerAddress {
    id: string;
    customerId: string;
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    isDefault: boolean;
}
export type OrderStatus = 'PENDING' | 'PAID' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';
export type ShipmentStatus = 'LABEL_CREATED' | 'PICKED_UP' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'EXCEPTION';
export interface OrderItem {
    id: string;
    orderId: string;
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
}
export interface Shipment {
    id: string;
    orderId: string;
    carrier: string;
    trackingNumber: string;
    status: ShipmentStatus;
    estimatedDelivery?: string | null;
    deliveredAt?: string | null;
    currentLocation?: string | null;
    trackingHistory?: Array<{
        status: string;
        timestamp: string;
        location: string;
    }>;
}
export interface Order {
    id: string;
    tenantId: string;
    orderNumber: string;
    customerId: string;
    status: OrderStatus;
    currency: string;
    subtotal: number;
    tax: number;
    shipping: number;
    totalAmount: number;
    createdAt: string;
    updatedAt: string;
    items?: OrderItem[];
    shipment?: Shipment | null;
    payments?: Payment[];
}
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
export type RefundStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';
export interface Payment {
    id: string;
    orderId: string;
    amount: number;
    currency: string;
    status: PaymentStatus;
    paymentMethod: string;
    maskedCard?: string | null;
    transactionRef: string;
    createdAt: string;
}
export interface RefundRequest {
    id: string;
    tenantId: string;
    orderId: string;
    customerId: string;
    amount: number;
    reason: string;
    status: RefundStatus;
    requestedBy: string;
    requiresSupervisorApproval: boolean;
    requiresSecurityApproval: boolean;
    supervisorApprovedAt?: string | null;
    securityApprovedAt?: string | null;
    rejectedReason?: string | null;
    createdAt: string;
    updatedAt: string;
}
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_ON_CUSTOMER' | 'RESOLVED' | 'CLOSED';
export interface SupportTicket {
    id: string;
    tenantId: string;
    ticketNumber: string;
    customerId: string;
    subject: string;
    description: string;
    priority: TicketPriority;
    status: TicketStatus;
    assignedAgentId?: string | null;
    createdAt: string;
    updatedAt: string;
    messages?: TicketMessage[];
}
export interface TicketMessage {
    id: string;
    ticketId: string;
    senderType: 'CUSTOMER' | 'AGENT' | 'SYSTEM';
    senderId: string;
    message: string;
    createdAt: string;
}
export interface KnowledgeBaseArticle {
    id: string;
    title: string;
    slug: string;
    category: string;
    content: string;
    tags: string[];
    isPublished: boolean;
    viewCount: number;
    createdAt: string;
    updatedAt: string;
}
export type AgentRiskTier = 'T1' | 'T2' | 'T3';
export type AgentAutonomyLevel = 'SUPERVISED' | 'SEMI_AUTONOMOUS' | 'FULLY_AUTONOMOUS';
export type AgentStatus = 'ACTIVE' | 'IDLE' | 'PAUSED' | 'QUARANTINED' | 'KILLED';
export type ExecutionMode = 'DIRECT_OLLAMA' | 'SIGNET_MOCK' | 'SIGNET_REAL';
export interface AgentConfig {
    id: string;
    name: string;
    riskTier: AgentRiskTier;
    autonomyLevel: AgentAutonomyLevel;
    status: AgentStatus;
    model: string;
    description: string;
    allowedTools: string[];
    forbiddenTools: string[];
    systemPrompt: string;
}
export interface AgentExecutionRecord {
    id: string;
    agentId: string;
    conversationId?: string;
    prompt: string;
    response: string;
    toolCalls: Array<{
        tool: string;
        args: any;
        result: any;
    }>;
    durationMs: number;
    tokenUsage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    executionMode: ExecutionMode;
    governanceDecision?: 'ALLOW' | 'BLOCK' | 'QUARANTINE';
    signetCorrelationId?: string;
    createdAt: string;
}
export declare const AGENT_IDS: {
    readonly SUPPORT: "support-agent-001";
    readonly REFUND: "refund-agent-002";
    readonly ORDER: "order-agent-003";
    readonly ESCALATION: "escalation-agent-004";
};
export interface Conversation {
    id: string;
    customerId: string;
    title: string;
    activeAgentId: string;
    status: 'ACTIVE' | 'RESOLVED' | 'CLOSED';
    createdAt: string;
    updatedAt: string;
}
export interface ConversationMessage {
    id: string;
    conversationId: string;
    sender: 'CUSTOMER' | 'AGENT' | 'SYSTEM';
    agentId?: string | null;
    text: string;
    toolCalls?: Array<{
        tool: string;
        args: any;
        result?: any;
        status: 'pending' | 'executing' | 'completed' | 'failed' | 'blocked';
        durationMs?: number;
    }>;
    handoffFrom?: string | null;
    handoffTo?: string | null;
    createdAt: string;
}
export declare const CreateTicketSchema: z.ZodObject<{
    customerId: z.ZodString;
    subject: z.ZodString;
    description: z.ZodString;
    priority: z.ZodDefault<z.ZodEnum<["LOW", "MEDIUM", "HIGH", "URGENT"]>>;
}, "strip", z.ZodTypeAny, {
    description: string;
    customerId: string;
    subject: string;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}, {
    description: string;
    customerId: string;
    subject: string;
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | undefined;
}>;
export declare const UpdateTicketSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER", "RESOLVED", "CLOSED"]>>;
    priority: z.ZodOptional<z.ZodEnum<["LOW", "MEDIUM", "HIGH", "URGENT"]>>;
    assignedAgentId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status?: "OPEN" | "IN_PROGRESS" | "WAITING_ON_CUSTOMER" | "RESOLVED" | "CLOSED" | undefined;
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | undefined;
    assignedAgentId?: string | undefined;
}, {
    status?: "OPEN" | "IN_PROGRESS" | "WAITING_ON_CUSTOMER" | "RESOLVED" | "CLOSED" | undefined;
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | undefined;
    assignedAgentId?: string | undefined;
}>;
export declare const CreateRefundRequestSchema: z.ZodObject<{
    orderId: z.ZodString;
    customerId: z.ZodString;
    amount: z.ZodNumber;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    customerId: string;
    orderId: string;
    amount: number;
    reason: string;
}, {
    customerId: string;
    orderId: string;
    amount: number;
    reason: string;
}>;
export declare const SendChatMessageSchema: z.ZodObject<{
    conversationId: z.ZodOptional<z.ZodString>;
    customerId: z.ZodString;
    message: z.ZodString;
    preferredAgentId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    customerId: string;
    message: string;
    conversationId?: string | undefined;
    preferredAgentId?: string | undefined;
}, {
    customerId: string;
    message: string;
    conversationId?: string | undefined;
    preferredAgentId?: string | undefined;
}>;
export interface SignetCertificateValidity {
    issuedAt: string;
    expiresAt: string;
    status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'QUARANTINED' | 'KILLED';
    revocationReason?: string;
}
export interface SignetAgentCertificate {
    agentId: string;
    workloadIdentity: string;
    certificateId: string;
    riskTier: 'T1' | 'T2' | 'T3' | 'T4';
    autonomyLevel: 'L1' | 'L2' | 'L3' | 'L4';
    allowedModel: string;
    allowedTools: string[];
    dataClasses: string[];
    limits: {
        maxRequestsPerMinute: number;
        maxTokensPerTurn: number;
    };
    validity: SignetCertificateValidity;
}
export interface SignetPolicyDecision {
    allowed: boolean;
    decision: 'ALLOW' | 'DENY' | 'REQUIRE_APPROVAL' | 'QUARANTINE';
    reason: string;
    ruleId?: string;
    action: string;
    agentId: string;
    correlationId: string;
    simulated: boolean;
    dlpDetected: boolean;
    dlpCategory?: 'PAYMENT_CARD' | 'API_TOKEN' | 'PII' | 'PROMPT_INJECTION' | 'CREDENTIAL';
    maskedContent?: string;
    evidenceRef?: string;
    latencyMs: number;
    timestamp: string;
}
export interface SignetGatewayConfig {
    executionMode: ExecutionMode;
    gatewayUrl: string;
    tenantId: string;
    enforcementRequired: boolean;
    isConnected: boolean;
    lastPingMs?: number;
    lastError?: string | null;
    agentCertificates: SignetAgentCertificate[];
}
