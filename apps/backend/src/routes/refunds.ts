import { FastifyInstance } from 'fastify';
import { prisma } from '@support/database';
import { z } from 'zod';

export async function refundRoutes(fastify: FastifyInstance) {
  // GET /api/v1/refunds
  fastify.get('/refunds', async (request, reply) => {
    const querySchema = z.object({
      customerId: z.string().uuid().optional(),
      status: z.string().optional(),
      limit: z.coerce.number().min(1).max(200).default(50),
      offset: z.coerce.number().min(0).default(0)
    });

    const { customerId, status, limit, offset } = querySchema.parse(request.query);

    const effectiveCustomerId =
      request.user?.role === 'CUSTOMER' ? request.user.id : customerId;

    const where: any = {};
    if (effectiveCustomerId) {
      where.customerId = effectiveCustomerId;
    }
    if (status) {
      where.status = status;
    }

    const [total, requests] = await Promise.all([
      prisma.refundRequest.count({ where }),
      prisma.refundRequest.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, fullName: true, email: true } },
          order: { select: { id: true, orderNumber: true, totalAmount: true, status: true } },
          refund: true
        }
      })
    ]);

    return reply.status(200).send({
      total,
      limit,
      offset,
      data: requests
    });
  });

  // POST /api/v1/refunds/request
  fastify.post('/refunds/request', async (request, reply) => {
    const bodySchema = z.object({
      orderId: z.string(),
      customerId: z.string().uuid(),
      amount: z.number().positive(),
      reason: z.string().min(5)
    });

    const body = bodySchema.parse(request.body);

    // Customer cross-access ownership check
    if (request.user?.role === 'CUSTOMER' && request.user.id !== body.customerId) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Access denied: You cannot request a refund for another customer.'
      });
    }

    // Verify order exists and belongs to this customer
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.orderId);
    const order = await prisma.order.findFirst({
      where: isUuid ? { id: body.orderId } : { orderNumber: body.orderId },
      include: { payments: true, refundRequests: true }
    });

    if (!order) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Order '${body.orderId}' not found.`
      });
    }

    if (order.customerId !== body.customerId) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Access denied: This order does not belong to the specified customer.'
      });
    }

    // Tier rules:
    // > INR 2,000 requires supervisor approval
    // > INR 10,000 requires supervisor and security approval
    const requiresSupervisorApproval = body.amount > 2000;
    const requiresSecurityApproval = body.amount > 10000;

    let refundRequest;
    try {
      refundRequest = await prisma.$transaction(async (tx) => {
        // Pessimistic lock on order row to serialize concurrent refund requests for this order
        await tx.$queryRaw`SELECT id FROM orders WHERE id = ${order.id} FOR UPDATE`;

        // Atomic concurrency check inside transaction
        const existingActiveRefund = await tx.refundRequest.findFirst({
          where: {
            orderId: order.id,
            status: { in: ['PENDING', 'APPROVED', 'COMPLETED'] }
          }
        });

        if (existingActiveRefund) {
          const err: any = new Error(`A refund request (${existingActiveRefund.id}) is already active or completed for order '${order.orderNumber}'. Duplicate refund requests are blocked.`);
          err.statusCode = 409;
          throw err;
        }

        const newReq = await tx.refundRequest.create({
          data: {
            tenantId: order.tenantId,
            orderId: order.id,
            customerId: body.customerId,
            amount: body.amount,
            reason: body.reason,
            status: requiresSupervisorApproval ? 'PENDING' : 'APPROVED',
            requestedBy: request.user?.email || 'customer',
            requiresSupervisorApproval,
            requiresSecurityApproval,
            supervisorApprovedAt: !requiresSupervisorApproval ? new Date() : null
          },
          include: {
            order: { select: { orderNumber: true, totalAmount: true } },
            customer: { select: { fullName: true, email: true } }
          }
        });

        // If amount is small (<= 2000), simulate instant automatic execution
        if (!requiresSupervisorApproval) {
          const payment = order.payments.find((p) => p.status === 'COMPLETED') || order.payments[0];
          if (payment) {
            await tx.refund.create({
              data: {
                refundRequestId: newReq.id,
                paymentId: payment.id,
                amount: body.amount,
                currency: 'INR',
                status: 'COMPLETED',
                transactionRef: `REF-AUTO-${Date.now()}`
              }
            });
          }
        }

        return newReq;
      });
    } catch (err: any) {
      if (err.statusCode === 409) {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: err.message
        });
      }
      throw err;
    }

    return reply.status(201).send(refundRequest);
  });

  // POST /api/v1/refunds/:id/approve
  fastify.post('/refunds/:id/approve', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string() });
    const { id } = paramsSchema.parse(request.params);

    const refundReq = await prisma.refundRequest.findUnique({
      where: { id },
      include: { order: { include: { payments: true } } }
    });

    if (!refundReq) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Refund request '${id}' not found.`
      });
    }

    if (refundReq.status !== 'PENDING') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `Refund request is already in status '${refundReq.status}'.`
      });
    }

    // Atomic transaction: Update refund request + create simulated refund record
    const result = await prisma.$transaction(async (tx) => {
      const updatedReq = await tx.refundRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          supervisorApprovedAt: new Date(),
          securityApprovedAt: refundReq.requiresSecurityApproval ? new Date() : null
        }
      });

      const payment =
        refundReq.order.payments.find((p) => p.status === 'COMPLETED') ||
        refundReq.order.payments[0];

      const refundRecord = await tx.refund.create({
        data: {
          refundRequestId: id,
          paymentId: payment.id,
          amount: refundReq.amount,
          currency: 'INR',
          status: 'COMPLETED',
          transactionRef: `REF-APPR-${Date.now()}`
        }
      });

      await tx.order.update({
        where: { id: refundReq.orderId },
        data: { status: 'REFUNDED' }
      });

      return { request: updatedReq, refund: refundRecord };
    });

    return reply.status(200).send({
      message: 'Refund approved and simulated financial transfer executed.',
      ...result
    });
  });

  // POST /api/v1/refunds/:id/reject
  fastify.post('/refunds/:id/reject', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string() });
    const bodySchema = z.object({ reason: z.string().min(3) });

    const { id } = paramsSchema.parse(request.params);
    const { reason } = bodySchema.parse(request.body);

    const refundReq = await prisma.refundRequest.findUnique({ where: { id } });

    if (!refundReq) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Refund request '${id}' not found.`
      });
    }

    if (refundReq.status !== 'PENDING') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `Refund request is already in status '${refundReq.status}'.`
      });
    }

    const updated = await prisma.refundRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedReason: reason
      }
    });

    return reply.status(200).send({
      message: 'Refund request rejected.',
      request: updated
    });
  });
}
