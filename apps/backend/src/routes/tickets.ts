import { FastifyInstance } from 'fastify';
import { prisma } from '@signet/database';
import { z } from 'zod';

export async function ticketRoutes(fastify: FastifyInstance) {
  // GET /api/v1/tickets
  fastify.get('/tickets', async (request, reply) => {
    const querySchema = z.object({
      customerId: z.string().uuid().optional(),
      status: z.string().optional(),
      priority: z.string().optional(),
      limit: z.coerce.number().min(1).max(200).default(50),
      offset: z.coerce.number().min(0).default(0)
    });

    const { customerId, status, priority, limit, offset } = querySchema.parse(request.query);

    const effectiveCustomerId =
      request.user?.role === 'CUSTOMER' ? request.user.id : customerId;

    const where: any = {};
    if (effectiveCustomerId) {
      where.customerId = effectiveCustomerId;
    }
    if (status) {
      where.status = status;
    }
    if (priority) {
      where.priority = priority;
    }

    const [total, tickets] = await Promise.all([
      prisma.supportTicket.count({ where }),
      prisma.supportTicket.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, fullName: true, email: true } },
          messages: { orderBy: { createdAt: 'asc' } }
        }
      })
    ]);

    return reply.status(200).send({
      total,
      limit,
      offset,
      data: tickets
    });
  });

  // POST /api/v1/tickets
  fastify.post('/tickets', async (request, reply) => {
    const bodySchema = z.object({
      customerId: z.string().uuid(),
      subject: z.string().min(3).max(255),
      description: z.string().min(5),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
      assignedAgentId: z.string().optional()
    });

    const body = bodySchema.parse(request.body);

    // Customer cross-access check
    if (request.user?.role === 'CUSTOMER' && request.user.id !== body.customerId) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Access denied: You cannot create a ticket for another customer.'
      });
    }

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: body.customerId }
    });

    if (!customer) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Customer ${body.customerId} not found.`
      });
    }

    const count = await prisma.supportTicket.count();
    const ticketNumber = `TICK-${2000 + count + 1}`;

    const newTicket = await prisma.supportTicket.create({
      data: {
        tenantId: customer.tenantId,
        ticketNumber,
        customerId: body.customerId,
        subject: body.subject,
        description: body.description,
        priority: body.priority,
        status: 'OPEN',
        assignedAgentId: body.assignedAgentId || 'support-agent-001',
        messages: {
          create: [
            {
              senderType: 'CUSTOMER',
              senderId: body.customerId,
              message: body.description
            }
          ]
        }
      },
      include: {
        customer: { select: { id: true, fullName: true, email: true } },
        messages: true
      }
    });

    return reply.status(201).send(newTicket);
  });

  // PATCH /api/v1/tickets/:id
  fastify.patch('/tickets/:id', async (request, reply) => {
    const paramsSchema = z.object({
      id: z.string()
    });

    const bodySchema = z.object({
      status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'RESOLVED', 'CLOSED']).optional(),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
      assignedAgentId: z.string().optional(),
      replyMessage: z.string().optional()
    });

    const { id } = paramsSchema.parse(request.params);
    const body = bodySchema.parse(request.body);

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const existingTicket = await prisma.supportTicket.findFirst({
      where: isUuid ? { id } : { ticketNumber: id }
    });

    if (!existingTicket) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Ticket '${id}' not found.`
      });
    }

    // Customer ownership check
    if (request.user?.role === 'CUSTOMER' && request.user.id !== existingTicket.customerId) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Access denied: You cannot modify another customer\'s ticket.'
      });
    }

    const updateData: any = {};
    if (body.status) updateData.status = body.status;
    if (body.priority) updateData.priority = body.priority;
    if (body.assignedAgentId) updateData.assignedAgentId = body.assignedAgentId;

    if (body.replyMessage) {
      await prisma.ticketMessage.create({
        data: {
          ticketId: existingTicket.id,
          senderType: request.user?.role === 'CUSTOMER' ? 'CUSTOMER' : 'AGENT',
          senderId: request.user?.id || 'agent',
          message: body.replyMessage
        }
      });
    }

    const updated = await prisma.supportTicket.update({
      where: { id: existingTicket.id },
      data: updateData,
      include: {
        customer: { select: { id: true, fullName: true, email: true } },
        messages: { orderBy: { createdAt: 'asc' } }
      }
    });

    return reply.status(200).send(updated);
  });
}
