"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolRegistry = exports.ToolRegistry = exports.getTicketHistoryTool = exports.requestSupervisorReviewTool = exports.createSecurityIncidentTool = exports.createEscalationTool = exports.updateDeliveryPreferenceTool = exports.requestOrderCancellationTool = exports.trackShipmentTool = exports.getOrderDetailsTool = exports.executeApprovedRefundTool = exports.createRefundRequestTool = exports.calculateRefundTool = exports.checkRefundEligibilityTool = exports.getPaymentStatusTool = exports.createSupportTicketTool = exports.searchKnowledgeBaseTool = exports.getOrderStatusTool = exports.getCustomerProfileTool = void 0;
const zod_1 = require("zod");
const database_1 = require("@signet/database");
// ==========================================
// 1. TOOL IMPLEMENTATIONS FOR AGENTS
// ==========================================
exports.getCustomerProfileTool = {
    name: 'get_customer_profile',
    description: 'Retrieve customer contact info, membership tier, address, and recent order history.',
    schema: zod_1.z.object({
        customerId: zod_1.z.string().describe('The UUID of the customer')
    }),
    ollamaParameters: {
        type: 'object',
        properties: {
            customerId: { type: 'string', description: 'The UUID of the customer' }
        },
        required: ['customerId']
    },
    execute: async ({ customerId }, context) => {
        // Cross-customer security check
        if (context.authenticatedCustomerId && context.authenticatedCustomerId !== customerId) {
            throw new Error(`Unauthorized: Access denied to customer ${customerId} from authenticated session ${context.authenticatedCustomerId}`);
        }
        const customer = await database_1.prisma.customer.findUnique({
            where: { id: customerId },
            include: {
                addresses: { where: { isDefault: true } },
                orders: { take: 5, orderBy: { createdAt: 'desc' }, select: { id: true, orderNumber: true, totalAmount: true, status: true, createdAt: true } }
            }
        });
        if (!customer) {
            return { found: false, message: `Customer with ID ${customerId} not found.` };
        }
        return {
            found: true,
            id: customer.id,
            fullName: customer.fullName,
            email: customer.email,
            tier: customer.tier,
            phone: customer.phone,
            defaultAddress: customer.addresses[0] || null,
            recentOrders: customer.orders
        };
    }
};
exports.getOrderStatusTool = {
    name: 'get_order_status',
    description: 'Retrieve order status, amount, and delivery state by order number.',
    schema: zod_1.z.object({
        orderNumber: zod_1.z.string().describe('Order identifier e.g. ORD-1005')
    }),
    ollamaParameters: {
        type: 'object',
        properties: {
            orderNumber: { type: 'string', description: 'Order identifier e.g. ORD-1005' }
        },
        required: ['orderNumber']
    },
    execute: async ({ orderNumber }, context) => {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderNumber);
        const order = await database_1.prisma.order.findFirst({
            where: isUuid ? { id: orderNumber } : { orderNumber },
            include: { shipment: true, customer: { select: { id: true, fullName: true } } }
        });
        if (!order) {
            return { found: false, message: `Order ${orderNumber} not found.` };
        }
        // Ownership check
        if (context.authenticatedCustomerId && context.authenticatedCustomerId !== order.customerId) {
            throw new Error(`Unauthorized: Order ${orderNumber} does not belong to the current authenticated customer.`);
        }
        return {
            found: true,
            orderNumber: order.orderNumber,
            status: order.status,
            totalAmount: order.totalAmount,
            currency: order.currency,
            customerName: order.customer.fullName,
            createdAt: order.createdAt,
            shipment: order.shipment
                ? {
                    carrier: order.shipment.carrier,
                    trackingNumber: order.shipment.trackingNumber,
                    status: order.shipment.status,
                    currentLocation: order.shipment.currentLocation
                }
                : null
        };
    }
};
exports.searchKnowledgeBaseTool = {
    name: 'search_knowledge_base',
    description: 'Search official store policies, return procedures, warranties, and delivery information.',
    schema: zod_1.z.object({
        query: zod_1.z.string().describe('Keywords or topic to search for'),
        category: zod_1.z.string().optional().describe('Optional category filter')
    }),
    ollamaParameters: {
        type: 'object',
        properties: {
            query: { type: 'string', description: 'Keywords or topic to search for' },
            category: { type: 'string', description: 'Optional category filter' }
        },
        required: ['query']
    },
    execute: async ({ query, category }) => {
        const where = {
            isPublished: true,
            OR: [
                { title: { contains: query, mode: 'insensitive' } },
                { content: { contains: query, mode: 'insensitive' } },
                { tags: { has: query.toLowerCase() } }
            ]
        };
        if (category)
            where.category = category;
        const articles = await database_1.prisma.knowledgeBaseArticle.findMany({
            where,
            take: 3,
            select: { title: true, category: true, content: true, slug: true }
        });
        return {
            query,
            count: articles.length,
            articles: articles.map((a) => ({
                title: a.title,
                category: a.category,
                summary: a.content.substring(0, 300) + '...'
            }))
        };
    }
};
exports.createSupportTicketTool = {
    name: 'create_support_ticket',
    description: 'Create a formal support ticket in PostgreSQL for unresolved inquiries or disputes.',
    schema: zod_1.z.object({
        customerId: zod_1.z.string().uuid().describe('The customer UUID'),
        subject: zod_1.z.string().min(3).describe('Summary of the customer issue'),
        description: zod_1.z.string().min(5).describe('Detailed explanation of problem'),
        priority: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM')
    }),
    ollamaParameters: {
        type: 'object',
        properties: {
            customerId: { type: 'string', description: 'The customer UUID' },
            subject: { type: 'string', description: 'Summary of the customer issue' },
            description: { type: 'string', description: 'Detailed explanation of problem' },
            priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] }
        },
        required: ['customerId', 'subject', 'description']
    },
    execute: async (params, context) => {
        const customer = await database_1.prisma.customer.findUnique({ where: { id: params.customerId } });
        if (!customer) {
            throw new Error(`Customer ${params.customerId} not found.`);
        }
        const count = await database_1.prisma.supportTicket.count();
        const ticketNumber = `TICK-${2000 + count + 1}`;
        const ticket = await database_1.prisma.supportTicket.create({
            data: {
                tenantId: customer.tenantId,
                ticketNumber,
                customerId: params.customerId,
                subject: params.subject,
                description: params.description,
                priority: params.priority || 'MEDIUM',
                status: 'OPEN',
                assignedAgentId: context.agentId,
                messages: {
                    create: [{ senderType: 'AGENT', senderId: context.agentId, message: params.description }]
                }
            }
        });
        return {
            success: true,
            ticketNumber: ticket.ticketNumber,
            id: ticket.id,
            priority: ticket.priority,
            status: ticket.status
        };
    }
};
exports.getPaymentStatusTool = {
    name: 'get_payment_status',
    description: 'Verify payment transactions and charge amounts for an order.',
    schema: zod_1.z.object({
        orderNumber: zod_1.z.string().describe('Order identifier e.g. ORD-1005')
    }),
    ollamaParameters: {
        type: 'object',
        properties: {
            orderNumber: { type: 'string', description: 'Order identifier e.g. ORD-1005' }
        },
        required: ['orderNumber']
    },
    execute: async ({ orderNumber }, context) => {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderNumber);
        const order = await database_1.prisma.order.findFirst({
            where: isUuid ? { id: orderNumber } : { orderNumber },
            include: { payments: true }
        });
        if (!order) {
            return { found: false, message: `Order ${orderNumber} not found.` };
        }
        if (context.authenticatedCustomerId && context.authenticatedCustomerId !== order.customerId) {
            throw new Error(`Unauthorized payment check for order ${orderNumber}.`);
        }
        return {
            found: true,
            orderNumber: order.orderNumber,
            totalAmount: order.totalAmount,
            payments: order.payments.map((p) => ({
                id: p.id,
                amount: p.amount,
                status: p.status,
                method: p.paymentMethod,
                maskedCard: p.maskedCard,
                transactionRef: p.transactionRef
            }))
        };
    }
};
exports.checkRefundEligibilityTool = {
    name: 'check_refund_eligibility',
    description: 'Evaluate if an order is eligible for refund based on 30-day window and delivery state.',
    schema: zod_1.z.object({
        orderNumber: zod_1.z.string().describe('Order identifier e.g. ORD-1005'),
        reason: zod_1.z.string().describe('Customer-stated reason for return')
    }),
    ollamaParameters: {
        type: 'object',
        properties: {
            orderNumber: { type: 'string', description: 'Order identifier e.g. ORD-1005' },
            reason: { type: 'string', description: 'Customer-stated reason for return' }
        },
        required: ['orderNumber', 'reason']
    },
    execute: async ({ orderNumber, reason }, context) => {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderNumber);
        const order = await database_1.prisma.order.findFirst({
            where: isUuid ? { id: orderNumber } : { orderNumber },
            include: { payments: true, refundRequests: true }
        });
        if (!order) {
            return { eligible: false, reason: `Order ${orderNumber} not found.` };
        }
        if (context.authenticatedCustomerId && context.authenticatedCustomerId !== order.customerId) {
            throw new Error(`Unauthorized check: Order does not belong to authenticated customer.`);
        }
        // Check if duplicate refund request exists
        const active = order.refundRequests.find((r) => r.status === 'PENDING' || r.status === 'APPROVED');
        if (active) {
            return {
                eligible: false,
                orderNumber: order.orderNumber,
                reason: `A refund request is already active or approved for order ${orderNumber}. Duplicate refund blocked.`
            };
        }
        // Check 30 days
        const diffDays = (Date.now() - order.createdAt.getTime()) / (1000 * 3600 * 24);
        if (diffDays > 30) {
            return {
                eligible: false,
                orderNumber: order.orderNumber,
                reason: `Order was placed ${Math.round(diffDays)} days ago, exceeding the 30-day return window.`
            };
        }
        const paidPayment = order.payments.find((p) => p.status === 'COMPLETED');
        if (!paidPayment) {
            return { eligible: false, orderNumber: order.orderNumber, reason: 'No completed payments found for this order.' };
        }
        return {
            eligible: true,
            orderNumber: order.orderNumber,
            orderDate: order.createdAt,
            maxEligibleAmount: paidPayment.amount,
            requiresSupervisorApproval: paidPayment.amount > 2000,
            requiresSecurityApproval: paidPayment.amount > 10000,
            reason: 'Order is within 30-day policy window with completed payment.'
        };
    }
};
exports.calculateRefundTool = {
    name: 'calculate_refund',
    description: 'Calculate the refundable amount including taxes and deduction logic.',
    schema: zod_1.z.object({
        orderNumber: zod_1.z.string().describe('Order identifier e.g. ORD-1005'),
        fullReturn: zod_1.z.boolean().default(true)
    }),
    ollamaParameters: {
        type: 'object',
        properties: {
            orderNumber: { type: 'string', description: 'Order identifier e.g. ORD-1005' },
            fullReturn: { type: 'boolean', description: 'Whether entire order is being returned' }
        },
        required: ['orderNumber']
    },
    execute: async ({ orderNumber }, context) => {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderNumber);
        const order = await database_1.prisma.order.findFirst({
            where: isUuid ? { id: orderNumber } : { orderNumber },
            include: { payments: true }
        });
        if (!order)
            throw new Error(`Order ${orderNumber} not found.`);
        const paidTotal = order.payments
            .filter((p) => p.status === 'COMPLETED')
            .reduce((acc, p) => acc + p.amount, 0);
        return {
            orderNumber: order.orderNumber,
            itemTotal: order.subtotal,
            tax: order.tax,
            shippingDeduction: 0,
            calculatedRefundAmount: paidTotal,
            currency: 'INR'
        };
    }
};
exports.createRefundRequestTool = {
    name: 'create_refund_request',
    description: 'Submit an official refund request for review and authorization.',
    schema: zod_1.z.object({
        orderNumber: zod_1.z.string().describe('Order identifier e.g. ORD-1005'),
        amount: zod_1.z.number().positive().describe('Refund amount in INR'),
        reason: zod_1.z.string().min(5).describe('Reason for refund request')
    }),
    ollamaParameters: {
        type: 'object',
        properties: {
            orderNumber: { type: 'string', description: 'Order identifier e.g. ORD-1005' },
            amount: { type: 'number', description: 'Refund amount in INR' },
            reason: { type: 'string', description: 'Reason for refund request' }
        },
        required: ['orderNumber', 'amount', 'reason']
    },
    execute: async ({ orderNumber, amount, reason }, context) => {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderNumber);
        const order = await database_1.prisma.order.findFirst({
            where: isUuid ? { id: orderNumber } : { orderNumber },
            include: { payments: true, refundRequests: true }
        });
        if (!order)
            throw new Error(`Order ${orderNumber} not found.`);
        // Check duplicate
        const active = order.refundRequests.find((r) => r.status === 'PENDING' || r.status === 'APPROVED');
        if (active) {
            throw new Error(`Duplicate refund blocked: Active request ${active.id} already exists for order ${order.orderNumber}.`);
        }
        const requiresSupervisorApproval = amount > 2000;
        const requiresSecurityApproval = amount > 10000;
        const req = await database_1.prisma.refundRequest.create({
            data: {
                tenantId: order.tenantId,
                orderId: order.id,
                customerId: order.customerId,
                amount,
                reason,
                status: requiresSupervisorApproval ? 'PENDING' : 'APPROVED',
                requestedBy: context.agentId,
                requiresSupervisorApproval,
                requiresSecurityApproval,
                supervisorApprovedAt: !requiresSupervisorApproval ? new Date() : null
            }
        });
        return {
            success: true,
            refundRequestId: req.id,
            amount: req.amount,
            status: req.status,
            requiresSupervisorApproval,
            requiresSecurityApproval,
            message: requiresSupervisorApproval
                ? `Refund of INR ${amount} created and queued for supervisor review.`
                : `Refund of INR ${amount} auto-approved under threshold.`
        };
    }
};
exports.executeApprovedRefundTool = {
    name: 'execute_approved_refund',
    description: 'Execute a simulated financial return for an approved refund request.',
    schema: zod_1.z.object({
        refundRequestId: zod_1.z.string().describe('ID of approved refund request')
    }),
    ollamaParameters: {
        type: 'object',
        properties: {
            refundRequestId: { type: 'string', description: 'ID of approved refund request' }
        },
        required: ['refundRequestId']
    },
    execute: async ({ refundRequestId }) => {
        const req = await database_1.prisma.refundRequest.findUnique({
            where: { id: refundRequestId },
            include: { order: { include: { payments: true } } }
        });
        if (!req)
            throw new Error(`Refund request ${refundRequestId} not found.`);
        if (req.status !== 'APPROVED') {
            throw new Error(`Cannot execute refund: Current status is '${req.status}'. Must be APPROVED.`);
        }
        const payment = req.order.payments.find((p) => p.status === 'COMPLETED') || req.order.payments[0];
        const refundRecord = await database_1.prisma.refund.create({
            data: {
                refundRequestId: req.id,
                paymentId: payment.id,
                amount: req.amount,
                currency: 'INR',
                status: 'COMPLETED',
                transactionRef: `REF-EXEC-${Date.now()}`
            }
        });
        await database_1.prisma.order.update({
            where: { id: req.orderId },
            data: { status: 'REFUNDED' }
        });
        return {
            success: true,
            transactionRef: refundRecord.transactionRef,
            amount: refundRecord.amount,
            currency: 'INR',
            status: 'COMPLETED'
        };
    }
};
exports.getOrderDetailsTool = {
    name: 'get_order_details',
    description: 'Retrieve full itemized breakdown, SKU codes, pricing, and shipment details for an order.',
    schema: zod_1.z.object({
        orderNumber: zod_1.z.string().describe('Order identifier e.g. ORD-1005')
    }),
    ollamaParameters: {
        type: 'object',
        properties: {
            orderNumber: { type: 'string', description: 'Order identifier e.g. ORD-1005' }
        },
        required: ['orderNumber']
    },
    execute: async ({ orderNumber }, context) => {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderNumber);
        const order = await database_1.prisma.order.findFirst({
            where: isUuid ? { id: orderNumber } : { orderNumber },
            include: { items: true, shipment: true, customer: { select: { fullName: true, email: true } } }
        });
        if (!order)
            throw new Error(`Order ${orderNumber} not found.`);
        if (context.authenticatedCustomerId && context.authenticatedCustomerId !== order.customerId) {
            throw new Error(`Unauthorized access to order ${orderNumber}.`);
        }
        return {
            orderNumber: order.orderNumber,
            status: order.status,
            customer: order.customer.fullName,
            subtotal: order.subtotal,
            tax: order.tax,
            shipping: order.shipping,
            totalAmount: order.totalAmount,
            items: order.items.map((i) => ({
                productName: i.productName,
                sku: i.sku,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                totalPrice: i.totalPrice
            })),
            shipment: order.shipment ? { carrier: order.shipment.carrier, trackingNumber: order.shipment.trackingNumber, status: order.shipment.status } : null
        };
    }
};
exports.trackShipmentTool = {
    name: 'track_shipment',
    description: 'Get live carrier tracking milestones, current location, and estimated delivery date.',
    schema: zod_1.z.object({
        orderNumber: zod_1.z.string().describe('Order identifier e.g. ORD-1005')
    }),
    ollamaParameters: {
        type: 'object',
        properties: {
            orderNumber: { type: 'string', description: 'Order identifier e.g. ORD-1005' }
        },
        required: ['orderNumber']
    },
    execute: async ({ orderNumber }, context) => {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderNumber);
        const order = await database_1.prisma.order.findFirst({
            where: isUuid ? { id: orderNumber } : { orderNumber },
            include: { shipment: true }
        });
        if (!order)
            throw new Error(`Order ${orderNumber} not found.`);
        if (context.authenticatedCustomerId && context.authenticatedCustomerId !== order.customerId) {
            throw new Error(`Unauthorized tracking check.`);
        }
        if (!order.shipment) {
            return { tracked: false, message: 'No carrier tracking number assigned yet.' };
        }
        return {
            tracked: true,
            carrier: order.shipment.carrier,
            trackingNumber: order.shipment.trackingNumber,
            status: order.shipment.status,
            currentLocation: order.shipment.currentLocation,
            estimatedDelivery: order.shipment.estimatedDelivery,
            milestones: order.shipment.trackingHistory
        };
    }
};
exports.requestOrderCancellationTool = {
    name: 'request_order_cancellation',
    description: 'Cancel an order before dispatch (if status is PENDING or PAID).',
    schema: zod_1.z.object({
        orderNumber: zod_1.z.string().describe('Order identifier e.g. ORD-1005'),
        reason: zod_1.z.string().describe('Cancellation reason')
    }),
    ollamaParameters: {
        type: 'object',
        properties: {
            orderNumber: { type: 'string', description: 'Order identifier e.g. ORD-1005' },
            reason: { type: 'string', description: 'Cancellation reason' }
        },
        required: ['orderNumber', 'reason']
    },
    execute: async ({ orderNumber, reason }, context) => {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderNumber);
        const order = await database_1.prisma.order.findFirst({
            where: isUuid ? { id: orderNumber } : { orderNumber }
        });
        if (!order)
            throw new Error(`Order ${orderNumber} not found.`);
        if (context.authenticatedCustomerId && context.authenticatedCustomerId !== order.customerId) {
            throw new Error(`Unauthorized cancellation attempt.`);
        }
        if (order.status === 'SHIPPED' || order.status === 'DELIVERED') {
            return {
                success: false,
                message: `Order ${orderNumber} is already ${order.status}. In-transit orders cannot be cancelled; please refuse package upon arrival.`
            };
        }
        const updated = await database_1.prisma.order.update({
            where: { id: order.id },
            data: { status: 'CANCELLED' }
        });
        return {
            success: true,
            orderNumber: updated.orderNumber,
            previousStatus: order.status,
            newStatus: updated.status,
            message: `Order ${orderNumber} has been successfully cancelled.`
        };
    }
};
exports.updateDeliveryPreferenceTool = {
    name: 'update_delivery_preference',
    description: 'Update customer delivery notes or gate access instructions.',
    schema: zod_1.z.object({
        orderNumber: zod_1.z.string().describe('Order identifier e.g. ORD-1005'),
        instructions: zod_1.z.string().describe('Special delivery instructions')
    }),
    ollamaParameters: {
        type: 'object',
        properties: {
            orderNumber: { type: 'string', description: 'Order identifier e.g. ORD-1005' },
            instructions: { type: 'string', description: 'Special delivery instructions' }
        },
        required: ['orderNumber', 'instructions']
    },
    execute: async ({ orderNumber, instructions }) => {
        return {
            success: true,
            orderNumber,
            deliveryInstructions: instructions,
            message: `Delivery preference updated: '${instructions}' has been relayed to carrier dispatch.`
        };
    }
};
exports.createEscalationTool = {
    name: 'create_escalation',
    description: 'Escalate a customer issue with urgent priority to senior supervisors.',
    schema: zod_1.z.object({
        ticketId: zod_1.z.string().describe('Ticket ID or number to escalate'),
        reason: zod_1.z.string().describe('Reason for escalation'),
        severity: zod_1.z.enum(['HIGH', 'URGENT']).default('URGENT')
    }),
    ollamaParameters: {
        type: 'object',
        properties: {
            ticketId: { type: 'string', description: 'Ticket ID or number to escalate' },
            reason: { type: 'string', description: 'Reason for escalation' },
            severity: { type: 'string', enum: ['HIGH', 'URGENT'] }
        },
        required: ['ticketId', 'reason']
    },
    execute: async ({ ticketId, reason, severity }) => {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ticketId);
        const ticket = await database_1.prisma.supportTicket.findFirst({
            where: isUuid ? { id: ticketId } : { ticketNumber: ticketId }
        });
        if (!ticket)
            throw new Error(`Ticket ${ticketId} not found.`);
        await database_1.prisma.supportTicket.update({
            where: { id: ticket.id },
            data: { priority: severity || 'URGENT', status: 'IN_PROGRESS' }
        });
        await database_1.prisma.ticketMessage.create({
            data: {
                ticketId: ticket.id,
                senderType: 'SYSTEM',
                senderId: 'escalation-agent-004',
                message: `[ESCALATION INITIATED] Priority upgraded to ${severity}. Reason: ${reason}`
            }
        });
        return {
            success: true,
            ticketNumber: ticket.ticketNumber,
            escalationReference: `ESC-${Date.now() % 100000}`,
            status: 'ESCALATED_TO_SUPERVISOR'
        };
    }
};
exports.createSecurityIncidentTool = {
    name: 'create_security_incident',
    description: 'Flag suspicious instructions, unauthorized attempts, or security audit events.',
    schema: zod_1.z.object({
        summary: zod_1.z.string().describe('Summary of the security anomaly or policy violation'),
        threatLevel: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('HIGH')
    }),
    ollamaParameters: {
        type: 'object',
        properties: {
            summary: { type: 'string', description: 'Summary of the security anomaly or policy violation' },
            threatLevel: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] }
        },
        required: ['summary']
    },
    execute: async ({ summary, threatLevel }, context) => {
        const audit = await database_1.prisma.applicationAuditLog.create({
            data: {
                tenantId: context.tenantId || 'tenant-support-lab-01',
                eventType: 'SECURITY_INCIDENT_FLAGGED',
                actorType: 'AGENT',
                actorId: context.agentId,
                resource: 'AI_AGENT_GOVERNANCE',
                action: 'SECURITY_FLAG',
                details: { summary, threatLevel: threatLevel || 'HIGH', timestamp: new Date() }
            }
        });
        return {
            incidentId: audit.id,
            threatLevel: threatLevel || 'HIGH',
            recorded: true,
            actionTaken: 'Flagged in audit log and sent to SecOps team.'
        };
    }
};
exports.requestSupervisorReviewTool = {
    name: 'request_supervisor_review',
    description: 'Request a human supervisor review for special approval or policy exceptions.',
    schema: zod_1.z.object({
        referenceId: zod_1.z.string().describe('Order, Ticket, or Refund ID requiring review'),
        justification: zod_1.z.string().describe('Justification for supervisor override')
    }),
    ollamaParameters: {
        type: 'object',
        properties: {
            referenceId: { type: 'string', description: 'Order, Ticket, or Refund ID requiring review' },
            justification: { type: 'string', description: 'Justification for supervisor override' }
        },
        required: ['referenceId', 'justification']
    },
    execute: async ({ referenceId, justification }, context) => {
        return {
            reviewRequestId: `REV-${Date.now() % 100000}`,
            referenceId,
            agentId: context.agentId,
            status: 'QUEUED_FOR_SUPERVISOR',
            justification
        };
    }
};
exports.getTicketHistoryTool = {
    name: 'get_ticket_history',
    description: 'Fetch past support ticket messages and resolution timeline.',
    schema: zod_1.z.object({
        ticketNumber: zod_1.z.string().describe('Ticket identifier e.g. TICK-2005')
    }),
    ollamaParameters: {
        type: 'object',
        properties: {
            ticketNumber: { type: 'string', description: 'Ticket identifier e.g. TICK-2005' }
        },
        required: ['ticketNumber']
    },
    execute: async ({ ticketNumber }) => {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ticketNumber);
        const ticket = await database_1.prisma.supportTicket.findFirst({
            where: isUuid ? { id: ticketNumber } : { ticketNumber },
            include: { messages: { orderBy: { createdAt: 'asc' } } }
        });
        if (!ticket)
            throw new Error(`Ticket ${ticketNumber} not found.`);
        return {
            ticketNumber: ticket.ticketNumber,
            subject: ticket.subject,
            status: ticket.status,
            priority: ticket.priority,
            createdAt: ticket.createdAt,
            messages: ticket.messages.map((m) => ({
                sender: m.senderType,
                text: m.message,
                time: m.createdAt
            }))
        };
    }
};
// ==========================================
// 2. TOOL REGISTRY
// ==========================================
class ToolRegistry {
    tools = new Map();
    constructor() {
        this.register(exports.getCustomerProfileTool);
        this.register(exports.getOrderStatusTool);
        this.register(exports.searchKnowledgeBaseTool);
        this.register(exports.createSupportTicketTool);
        this.register(exports.getPaymentStatusTool);
        this.register(exports.checkRefundEligibilityTool);
        this.register(exports.calculateRefundTool);
        this.register(exports.createRefundRequestTool);
        this.register(exports.executeApprovedRefundTool);
        this.register(exports.getOrderDetailsTool);
        this.register(exports.trackShipmentTool);
        this.register(exports.requestOrderCancellationTool);
        this.register(exports.updateDeliveryPreferenceTool);
        this.register(exports.createEscalationTool);
        this.register(exports.createSecurityIncidentTool);
        this.register(exports.requestSupervisorReviewTool);
        this.register(exports.getTicketHistoryTool);
    }
    register(tool) {
        this.tools.set(tool.name, tool);
    }
    get(name) {
        return this.tools.get(name);
    }
    getAll() {
        return Array.from(this.tools.values());
    }
    getForAgent(allowedNames) {
        return allowedNames
            .map((name) => this.tools.get(name))
            .filter((t) => !!t);
    }
    getOllamaDefinitions(allowedNames) {
        return this.getForAgent(allowedNames).map((t) => ({
            type: 'function',
            function: {
                name: t.name,
                description: t.description,
                parameters: t.ollamaParameters
            }
        }));
    }
    async executeTool(name, args, context) {
        const tool = this.tools.get(name);
        if (!tool) {
            throw new Error(`Tool '${name}' is not registered in the Tool Registry.`);
        }
        // Validate parameters against strict Zod schema
        const validatedArgs = tool.schema.parse(args);
        const start = Date.now();
        try {
            const result = await tool.execute(validatedArgs, context);
            const executionMs = Date.now() - start;
            // Log execution to PostgreSQL tool_execution_logs
            await database_1.prisma.toolExecutionLog.create({
                data: {
                    agentId: context.agentId,
                    toolName: name,
                    customerId: context.authenticatedCustomerId,
                    inputParams: validatedArgs,
                    outputResult: result,
                    status: 'SUCCESS',
                    executionMs
                }
            }).catch(() => { });
            return result;
        }
        catch (err) {
            const executionMs = Date.now() - start;
            await database_1.prisma.toolExecutionLog.create({
                data: {
                    agentId: context.agentId,
                    toolName: name,
                    customerId: context.authenticatedCustomerId,
                    inputParams: validatedArgs,
                    outputResult: { error: err.message },
                    status: 'FAILED',
                    executionMs
                }
            }).catch(() => { });
            throw err;
        }
    }
}
exports.ToolRegistry = ToolRegistry;
exports.toolRegistry = new ToolRegistry();
//# sourceMappingURL=index.js.map