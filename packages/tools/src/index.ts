import { z } from 'zod';
import { prisma } from '@support/database';

export interface ToolContext {
  agentId: string;
  authenticatedCustomerId?: string;
  tenantId?: string;
}

export interface ToolDefinition<TParams = any, TResult = any> {
  name: string;
  description: string;
  schema: z.ZodSchema<TParams>;
  ollamaParameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  execute: (params: TParams, context: ToolContext) => Promise<TResult>;
}

// ==========================================
// 1. TOOL IMPLEMENTATIONS FOR AGENTS
// ==========================================

export const getCustomerProfileTool: ToolDefinition = {
  name: 'get_customer_profile',
  description: 'Retrieve customer contact info, membership tier, address, and recent order history.',
  schema: z.object({
    customerId: z.string().describe('The UUID of the customer')
  }),
  ollamaParameters: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'The UUID of the customer' }
    },
    required: ['customerId']
  },
  execute: async ({ customerId }: { customerId: string }, context) => {
    // Cross-customer security check
    if (context.authenticatedCustomerId && context.authenticatedCustomerId !== customerId) {
      throw new Error(`Unauthorized: Access denied to customer ${customerId} from authenticated session ${context.authenticatedCustomerId}`);
    }

    const customer = await prisma.customer.findUnique({
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

export const getOrderStatusTool: ToolDefinition = {
  name: 'get_order_status',
  description: 'Retrieve order status, amount, and delivery state by order number.',
  schema: z.object({
    orderNumber: z.string().describe('Order identifier e.g. ORD-1005')
  }),
  ollamaParameters: {
    type: 'object',
    properties: {
      orderNumber: { type: 'string', description: 'Order identifier e.g. ORD-1005' }
    },
    required: ['orderNumber']
  },
  execute: async ({ orderNumber }: { orderNumber: string }, context) => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderNumber);
    const order = await prisma.order.findFirst({
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

export const searchKnowledgeBaseTool: ToolDefinition = {
  name: 'search_knowledge_base',
  description: 'Search official store policies, return procedures, warranties, and delivery information.',
  schema: z.object({
    query: z.string().describe('Keywords or topic to search for'),
    category: z.string().optional().describe('Optional category filter')
  }),
  ollamaParameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Keywords or topic to search for' },
      category: { type: 'string', description: 'Optional category filter' }
    },
    required: ['query']
  },
  execute: async ({ query, category }: { query: string; category?: string }) => {
    const where: any = {
      isPublished: true,
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { content: { contains: query, mode: 'insensitive' } },
        { tags: { has: query.toLowerCase() } }
      ]
    };
    if (category) where.category = category;

    const articles = await prisma.knowledgeBaseArticle.findMany({
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

export const createSupportTicketTool: ToolDefinition = {
  name: 'create_support_ticket',
  description: 'Create a formal support ticket in PostgreSQL for unresolved inquiries or disputes.',
  schema: z.object({
    customerId: z.string().uuid().describe('The customer UUID'),
    subject: z.string().min(3).describe('Summary of the customer issue'),
    description: z.string().min(5).describe('Detailed explanation of problem'),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM')
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
  execute: async (params: { customerId: string; subject: string; description: string; priority?: any }, context) => {
    const customer = await prisma.customer.findUnique({ where: { id: params.customerId } });
    if (!customer) {
      throw new Error(`Customer ${params.customerId} not found.`);
    }

    const count = await prisma.supportTicket.count();
    const ticketNumber = `TICK-${2000 + count + 1}`;

    const ticket = await prisma.supportTicket.create({
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

export const getPaymentStatusTool: ToolDefinition = {
  name: 'get_payment_status',
  description: 'Verify payment transactions and charge amounts for an order.',
  schema: z.object({
    orderNumber: z.string().describe('Order identifier e.g. ORD-1005')
  }),
  ollamaParameters: {
    type: 'object',
    properties: {
      orderNumber: { type: 'string', description: 'Order identifier e.g. ORD-1005' }
    },
    required: ['orderNumber']
  },
  execute: async ({ orderNumber }: { orderNumber: string }, context) => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderNumber);
    const order = await prisma.order.findFirst({
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

export const checkRefundEligibilityTool: ToolDefinition = {
  name: 'check_refund_eligibility',
  description: 'Evaluate if an order is eligible for refund based on 30-day window and delivery state.',
  schema: z.object({
    orderNumber: z.string().describe('Order identifier e.g. ORD-1005'),
    reason: z.string().describe('Customer-stated reason for return')
  }),
  ollamaParameters: {
    type: 'object',
    properties: {
      orderNumber: { type: 'string', description: 'Order identifier e.g. ORD-1005' },
      reason: { type: 'string', description: 'Customer-stated reason for return' }
    },
    required: ['orderNumber', 'reason']
  },
  execute: async ({ orderNumber, reason }: { orderNumber: string; reason: string }, context) => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderNumber);
    const order = await prisma.order.findFirst({
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

export const calculateRefundTool: ToolDefinition = {
  name: 'calculate_refund',
  description: 'Calculate the refundable amount including taxes and deduction logic.',
  schema: z.object({
    orderNumber: z.string().describe('Order identifier e.g. ORD-1005'),
    fullReturn: z.boolean().default(true)
  }),
  ollamaParameters: {
    type: 'object',
    properties: {
      orderNumber: { type: 'string', description: 'Order identifier e.g. ORD-1005' },
      fullReturn: { type: 'boolean', description: 'Whether entire order is being returned' }
    },
    required: ['orderNumber']
  },
  execute: async ({ orderNumber }: { orderNumber: string }, context) => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderNumber);
    const order = await prisma.order.findFirst({
      where: isUuid ? { id: orderNumber } : { orderNumber },
      include: { payments: true }
    });

    if (!order) throw new Error(`Order ${orderNumber} not found.`);

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

export const createRefundRequestTool: ToolDefinition = {
  name: 'create_refund_request',
  description: 'Submit an official refund request for review and authorization.',
  schema: z.object({
    orderNumber: z.string().describe('Order identifier e.g. ORD-1005'),
    amount: z.number().positive().describe('Refund amount in INR'),
    reason: z.string().min(5).describe('Reason for refund request')
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
  execute: async ({ orderNumber, amount, reason }: { orderNumber: string; amount: number; reason: string }, context) => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderNumber);
    const order = await prisma.order.findFirst({
      where: isUuid ? { id: orderNumber } : { orderNumber },
      include: { payments: true, refundRequests: true }
    });

    if (!order) throw new Error(`Order ${orderNumber} not found.`);

    // Check duplicate
    const active = order.refundRequests.find((r) => r.status === 'PENDING' || r.status === 'APPROVED');
    if (active) {
      throw new Error(`Duplicate refund blocked: Active request ${active.id} already exists for order ${order.orderNumber}.`);
    }

    const requiresSupervisorApproval = amount > 2000;
    const requiresSecurityApproval = amount > 10000;

    const req = await prisma.refundRequest.create({
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

export const executeApprovedRefundTool: ToolDefinition = {
  name: 'execute_approved_refund',
  description: 'Execute a simulated financial return for an approved refund request.',
  schema: z.object({
    refundRequestId: z.string().describe('ID of approved refund request')
  }),
  ollamaParameters: {
    type: 'object',
    properties: {
      refundRequestId: { type: 'string', description: 'ID of approved refund request' }
    },
    required: ['refundRequestId']
  },
  execute: async ({ refundRequestId }: { refundRequestId: string }) => {
    const req = await prisma.refundRequest.findUnique({
      where: { id: refundRequestId },
      include: { order: { include: { payments: true } } }
    });

    if (!req) throw new Error(`Refund request ${refundRequestId} not found.`);
    if (req.status !== 'APPROVED') {
      throw new Error(`Cannot execute refund: Current status is '${req.status}'. Must be APPROVED.`);
    }

    const payment = req.order.payments.find((p) => p.status === 'COMPLETED') || req.order.payments[0];

    const refundRecord = await prisma.refund.create({
      data: {
        refundRequestId: req.id,
        paymentId: payment.id,
        amount: req.amount,
        currency: 'INR',
        status: 'COMPLETED',
        transactionRef: `REF-EXEC-${Date.now()}`
      }
    });

    await prisma.order.update({
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

export const getOrderDetailsTool: ToolDefinition = {
  name: 'get_order_details',
  description: 'Retrieve full itemized breakdown, SKU codes, pricing, and shipment details for an order.',
  schema: z.object({
    orderNumber: z.string().describe('Order identifier e.g. ORD-1005')
  }),
  ollamaParameters: {
    type: 'object',
    properties: {
      orderNumber: { type: 'string', description: 'Order identifier e.g. ORD-1005' }
    },
    required: ['orderNumber']
  },
  execute: async ({ orderNumber }: { orderNumber: string }, context) => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderNumber);
    const order = await prisma.order.findFirst({
      where: isUuid ? { id: orderNumber } : { orderNumber },
      include: { items: true, shipment: true, customer: { select: { fullName: true, email: true } } }
    });

    if (!order) throw new Error(`Order ${orderNumber} not found.`);
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

export const trackShipmentTool: ToolDefinition = {
  name: 'track_shipment',
  description: 'Get live carrier tracking milestones, current location, and estimated delivery date.',
  schema: z.object({
    orderNumber: z.string().describe('Order identifier e.g. ORD-1005')
  }),
  ollamaParameters: {
    type: 'object',
    properties: {
      orderNumber: { type: 'string', description: 'Order identifier e.g. ORD-1005' }
    },
    required: ['orderNumber']
  },
  execute: async ({ orderNumber }: { orderNumber: string }, context) => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderNumber);
    const order = await prisma.order.findFirst({
      where: isUuid ? { id: orderNumber } : { orderNumber },
      include: { shipment: true }
    });

    if (!order) throw new Error(`Order ${orderNumber} not found.`);
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

export const requestOrderCancellationTool: ToolDefinition = {
  name: 'request_order_cancellation',
  description: 'Cancel an order before dispatch (if status is PENDING or PAID).',
  schema: z.object({
    orderNumber: z.string().describe('Order identifier e.g. ORD-1005'),
    reason: z.string().describe('Cancellation reason')
  }),
  ollamaParameters: {
    type: 'object',
    properties: {
      orderNumber: { type: 'string', description: 'Order identifier e.g. ORD-1005' },
      reason: { type: 'string', description: 'Cancellation reason' }
    },
    required: ['orderNumber', 'reason']
  },
  execute: async ({ orderNumber, reason }: { orderNumber: string; reason: string }, context) => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderNumber);
    const order = await prisma.order.findFirst({
      where: isUuid ? { id: orderNumber } : { orderNumber }
    });

    if (!order) throw new Error(`Order ${orderNumber} not found.`);
    if (context.authenticatedCustomerId && context.authenticatedCustomerId !== order.customerId) {
      throw new Error(`Unauthorized cancellation attempt.`);
    }

    if (order.status === 'SHIPPED' || order.status === 'DELIVERED') {
      return {
        success: false,
        message: `Order ${orderNumber} is already ${order.status}. In-transit orders cannot be cancelled; please refuse package upon arrival.`
      };
    }

    const updated = await prisma.order.update({
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

export const updateDeliveryPreferenceTool: ToolDefinition = {
  name: 'update_delivery_preference',
  description: 'Update customer delivery notes or gate access instructions.',
  schema: z.object({
    orderNumber: z.string().describe('Order identifier e.g. ORD-1005'),
    instructions: z.string().describe('Special delivery instructions')
  }),
  ollamaParameters: {
    type: 'object',
    properties: {
      orderNumber: { type: 'string', description: 'Order identifier e.g. ORD-1005' },
      instructions: { type: 'string', description: 'Special delivery instructions' }
    },
    required: ['orderNumber', 'instructions']
  },
  execute: async ({ orderNumber, instructions }: { orderNumber: string; instructions: string }) => {
    return {
      success: true,
      orderNumber,
      deliveryInstructions: instructions,
      message: `Delivery preference updated: '${instructions}' has been relayed to carrier dispatch.`
    };
  }
};

export const createEscalationTool: ToolDefinition = {
  name: 'create_escalation',
  description: 'Escalate a customer issue with urgent priority to senior supervisors.',
  schema: z.object({
    ticketId: z.string().describe('Ticket ID or number to escalate'),
    reason: z.string().describe('Reason for escalation'),
    severity: z.enum(['HIGH', 'URGENT']).default('URGENT')
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
  execute: async ({ ticketId, reason, severity }: { ticketId: string; reason: string; severity?: any }) => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ticketId);
    const ticket = await prisma.supportTicket.findFirst({
      where: isUuid ? { id: ticketId } : { ticketNumber: ticketId }
    });

    if (!ticket) throw new Error(`Ticket ${ticketId} not found.`);

    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { priority: severity || 'URGENT', status: 'IN_PROGRESS' }
    });

    await prisma.ticketMessage.create({
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

export const createSecurityIncidentTool: ToolDefinition = {
  name: 'create_security_incident',
  description: 'Flag suspicious instructions, unauthorized attempts, or security audit events.',
  schema: z.object({
    summary: z.string().describe('Summary of the security anomaly or policy violation'),
    threatLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('HIGH')
  }),
  ollamaParameters: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'Summary of the security anomaly or policy violation' },
      threatLevel: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] }
    },
    required: ['summary']
  },
  execute: async ({ summary, threatLevel }: { summary: string; threatLevel?: any }, context) => {
    const audit = await prisma.applicationAuditLog.create({
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

export const requestSupervisorReviewTool: ToolDefinition = {
  name: 'request_supervisor_review',
  description: 'Request a human supervisor review for special approval or policy exceptions.',
  schema: z.object({
    referenceId: z.string().describe('Order, Ticket, or Refund ID requiring review'),
    justification: z.string().describe('Justification for supervisor override')
  }),
  ollamaParameters: {
    type: 'object',
    properties: {
      referenceId: { type: 'string', description: 'Order, Ticket, or Refund ID requiring review' },
      justification: { type: 'string', description: 'Justification for supervisor override' }
    },
    required: ['referenceId', 'justification']
  },
  execute: async ({ referenceId, justification }: { referenceId: string; justification: string }, context) => {
    return {
      reviewRequestId: `REV-${Date.now() % 100000}`,
      referenceId,
      agentId: context.agentId,
      status: 'QUEUED_FOR_SUPERVISOR',
      justification
    };
  }
};

export const getTicketHistoryTool: ToolDefinition = {
  name: 'get_ticket_history',
  description: 'Fetch past support ticket messages and resolution timeline.',
  schema: z.object({
    ticketNumber: z.string().describe('Ticket identifier e.g. TICK-2005')
  }),
  ollamaParameters: {
    type: 'object',
    properties: {
      ticketNumber: { type: 'string', description: 'Ticket identifier e.g. TICK-2005' }
    },
    required: ['ticketNumber']
  },
  execute: async ({ ticketNumber }: { ticketNumber: string }) => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ticketNumber);
    const ticket = await prisma.supportTicket.findFirst({
      where: isUuid ? { id: ticketNumber } : { ticketNumber },
      include: { messages: { orderBy: { createdAt: 'asc' } } }
    });

    if (!ticket) throw new Error(`Ticket ${ticketNumber} not found.`);

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
export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  constructor() {
    this.register(getCustomerProfileTool);
    this.register(getOrderStatusTool);
    this.register(searchKnowledgeBaseTool);
    this.register(createSupportTicketTool);
    this.register(getPaymentStatusTool);
    this.register(checkRefundEligibilityTool);
    this.register(calculateRefundTool);
    this.register(createRefundRequestTool);
    this.register(executeApprovedRefundTool);
    this.register(getOrderDetailsTool);
    this.register(trackShipmentTool);
    this.register(requestOrderCancellationTool);
    this.register(updateDeliveryPreferenceTool);
    this.register(createEscalationTool);
    this.register(createSecurityIncidentTool);
    this.register(requestSupervisorReviewTool);
    this.register(getTicketHistoryTool);
  }

  register(tool: ToolDefinition) {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  getForAgent(allowedNames: string[]): ToolDefinition[] {
    return allowedNames
      .map((name) => this.tools.get(name))
      .filter((t): t is ToolDefinition => !!t);
  }

  getOllamaDefinitions(allowedNames: string[]) {
    return this.getForAgent(allowedNames).map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.ollamaParameters
      }
    }));
  }

  async executeTool(name: string, args: any, context: ToolContext): Promise<any> {
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
      await prisma.toolExecutionLog.create({
        data: {
          agentId: context.agentId,
          toolName: name,
          customerId: context.authenticatedCustomerId,
          inputParams: validatedArgs,
          outputResult: result,
          status: 'SUCCESS',
          executionMs
        }
      }).catch(() => {});

      return result;
    } catch (err: any) {
      const executionMs = Date.now() - start;
      await prisma.toolExecutionLog.create({
        data: {
          agentId: context.agentId,
          toolName: name,
          customerId: context.authenticatedCustomerId,
          inputParams: validatedArgs,
          outputResult: { error: err.message },
          status: 'FAILED',
          executionMs
        }
      }).catch(() => {});

      throw err;
    }
  }
}

export const toolRegistry = new ToolRegistry();
