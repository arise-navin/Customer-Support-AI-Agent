import { FastifyInstance } from 'fastify';
import { prisma } from '@support/database';
import { z } from 'zod';

export async function orderRoutes(fastify: FastifyInstance) {
  // GET /api/v1/orders
  fastify.get('/orders', async (request, reply) => {
    const querySchema = z.object({
      customerId: z.string().uuid().optional(),
      status: z.string().optional(),
      search: z.string().optional(),
      limit: z.coerce.number().min(1).max(200).default(50),
      offset: z.coerce.number().min(0).default(0)
    });

    const { customerId, status, search, limit, offset } = querySchema.parse(request.query);

    // If authenticated user is a CUSTOMER, strictly limit to their own customerId
    const effectiveCustomerId =
      request.user?.role === 'CUSTOMER' ? request.user.id : customerId;

    const where: any = {};
    if (effectiveCustomerId) {
      where.customerId = effectiveCustomerId;
    }
    if (status) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { customer: { fullName: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, fullName: true, email: true, tier: true } },
          shipment: true,
          items: true,
          payments: true
        }
      })
    ]);

    return reply.status(200).send({
      total,
      limit,
      offset,
      data: orders
    });
  });

  // GET /api/v1/orders/:id
  fastify.get('/orders/:id', async (request, reply) => {
    const paramsSchema = z.object({
      id: z.string()
    });

    const { id } = paramsSchema.parse(request.params);

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    const order = await prisma.order.findFirst({
      where: isUuid ? { id } : { orderNumber: id },
      include: {
        customer: { select: { id: true, fullName: true, email: true, tier: true } },
        items: { include: { product: true } },
        shipment: true,
        payments: true,
        refundRequests: { include: { refund: true } }
      }
    });

    if (!order) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Order '${id}' not found.`
      });
    }

    // Customer cross-access ownership check
    if (request.user?.role === 'CUSTOMER' && request.user.id !== order.customerId) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Access denied: You cannot view orders belonging to another customer.'
      });
    }

    return reply.status(200).send(order);
  });

  // GET /api/v1/orders/:id/tracking
  fastify.get('/orders/:id/tracking', async (request, reply) => {
    const paramsSchema = z.object({
      id: z.string()
    });

    const { id } = paramsSchema.parse(request.params);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    const order = await prisma.order.findFirst({
      where: isUuid ? { id } : { orderNumber: id },
      select: { id: true, orderNumber: true, customerId: true, status: true, shipment: true }
    });

    if (!order) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Order '${id}' not found.`
      });
    }

    // Customer ownership check
    if (request.user?.role === 'CUSTOMER' && request.user.id !== order.customerId) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Access denied: You cannot view tracking info for another customer.'
      });
    }

    if (!order.shipment) {
      return reply.status(200).send({
        orderNumber: order.orderNumber,
        status: order.status,
        shipment: null,
        message: 'Shipment has not been created for this order yet.'
      });
    }

    return reply.status(200).send({
      orderNumber: order.orderNumber,
      carrier: order.shipment.carrier,
      trackingNumber: order.shipment.trackingNumber,
      status: order.shipment.status,
      currentLocation: order.shipment.currentLocation,
      estimatedDelivery: order.shipment.estimatedDelivery,
      deliveredAt: order.shipment.deliveredAt,
      trackingHistory: order.shipment.trackingHistory
    });
  });
}
