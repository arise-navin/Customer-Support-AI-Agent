"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SendChatMessageSchema = exports.CreateRefundRequestSchema = exports.UpdateTicketSchema = exports.CreateTicketSchema = exports.AGENT_IDS = exports.HealthResponseSchema = void 0;
const zod_1 = require("zod");
exports.HealthResponseSchema = zod_1.z.object({
    status: zod_1.z.enum(['healthy', 'degraded', 'unhealthy']),
    service: zod_1.z.string(),
    version: zod_1.z.string().optional(),
    timestamp: zod_1.z.string().optional(),
    database: zod_1.z.enum(['connected', 'disconnected', 'unknown']).optional(),
    ollama: zod_1.z.enum(['connected', 'unreachable', 'unknown']).optional(),
    activeModel: zod_1.z.string().optional()
});
// Agent definitions
exports.AGENT_IDS = {
    SUPPORT: 'support-agent-001',
    REFUND: 'refund-agent-002',
    ORDER: 'order-agent-003',
    ESCALATION: 'escalation-agent-004'
};
// ==========================================
// Zod Schemas for Validation
// ==========================================
exports.CreateTicketSchema = zod_1.z.object({
    customerId: zod_1.z.string().uuid(),
    subject: zod_1.z.string().min(3).max(255),
    description: zod_1.z.string().min(5),
    priority: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM')
});
exports.UpdateTicketSchema = zod_1.z.object({
    status: zod_1.z.enum(['OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'RESOLVED', 'CLOSED']).optional(),
    priority: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    assignedAgentId: zod_1.z.string().optional()
});
exports.CreateRefundRequestSchema = zod_1.z.object({
    orderId: zod_1.z.string().uuid(),
    customerId: zod_1.z.string().uuid(),
    amount: zod_1.z.number().positive(),
    reason: zod_1.z.string().min(5)
});
exports.SendChatMessageSchema = zod_1.z.object({
    conversationId: zod_1.z.string().uuid().optional(),
    customerId: zod_1.z.string().uuid(),
    message: zod_1.z.string().min(1),
    preferredAgentId: zod_1.z.string().optional()
});
//# sourceMappingURL=index.js.map