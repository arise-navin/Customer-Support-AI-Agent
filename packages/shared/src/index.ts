import { z } from 'zod';

// ==========================================
// Health & System
// ==========================================
export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  service: string;
  version?: string;
  timestamp?: string;
  database?: 'connected' | 'disconnected' | 'unknown';
  ollama?: 'connected' | 'unreachable' | 'unknown';
  activeModel?: string;
}

export const HealthResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  service: z.string(),
  version: z.string().optional(),
  timestamp: z.string().optional(),
  database: z.enum(['connected', 'disconnected', 'unknown']).optional(),
  ollama: z.enum(['connected', 'unreachable', 'unknown']).optional(),
  activeModel: z.string().optional()
});

// ==========================================
// User & Auth
// ==========================================
export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'AGENT' | 'CUSTOMER';

export interface UserSession {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
}

// ==========================================
// Customers
// ==========================================
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

// ==========================================
// Orders & Shipments
// ==========================================
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
  trackingHistory?: Array<{ status: string; timestamp: string; location: string }>;
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

// ==========================================
// Payments & Refunds
// ==========================================
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

// ==========================================
// Support Tickets & Knowledge Base
// ==========================================
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

// ==========================================
// AI Agents
// ==========================================
export type AgentRiskTier = 'T1' | 'T2' | 'T3';
export type AgentAutonomyLevel = 'SUPERVISED' | 'SEMI_AUTONOMOUS' | 'FULLY_AUTONOMOUS';
export type AgentStatus = 'ACTIVE' | 'IDLE' | 'PAUSED' | 'QUARANTINED' | 'KILLED';
export type ExecutionMode = 'DIRECT_OLLAMA';

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
  toolCalls: Array<{ tool: string; args: any; result: any }>;
  durationMs: number;
  tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  executionMode: ExecutionMode;
  governanceDecision?: 'ALLOW' | 'BLOCK' | 'QUARANTINE';
  createdAt: string;
}

// Agent definitions
export const AGENT_IDS = {
  SUPPORT: 'support-agent-001',
  REFUND: 'refund-agent-002',
  ORDER: 'order-agent-003',
  ESCALATION: 'escalation-agent-004'
} as const;

// ==========================================
// Conversation & Chat
// ==========================================
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

// ==========================================
// Zod Schemas for Validation
// ==========================================
export const CreateTicketSchema = z.object({
  customerId: z.string().uuid(),
  subject: z.string().min(3).max(255),
  description: z.string().min(5),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM')
});

export const UpdateTicketSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedAgentId: z.string().optional()
});

export const CreateRefundRequestSchema = z.object({
  orderId: z.string().uuid(),
  customerId: z.string().uuid(),
  amount: z.number().positive(),
  reason: z.string().min(5)
});

export const SendChatMessageSchema = z.object({
  conversationId: z.string().uuid().optional(),
  customerId: z.string().uuid(),
  message: z.string().min(1),
  preferredAgentId: z.string().optional()
});

