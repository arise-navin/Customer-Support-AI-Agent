import { FastifyInstance } from 'fastify';
import { prisma } from '@support/database';
import { z } from 'zod';

export async function customerRoutes(fastify: FastifyInstance) {
  // GET /api/v1/customers
  fastify.get('/customers', async (request, reply) => {
    const querySchema = z.object({
      search: z.string().optional(),
      tier: z.string().optional(),
      limit: z.coerce.number().min(1).max(200).default(50),
      offset: z.coerce.number().min(0).default(0)
    });

    const { search, tier, limit, offset } = querySchema.parse(request.query);

    const where: any = {};
    if (tier) {
      where.tier = tier;
    }
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [total, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          addresses: { where: { isDefault: true } },
          _count: { select: { orders: true, tickets: true } }
        }
      })
    ]);

    return reply.status(200).send({
      total,
      limit,
      offset,
      data: customers
    });
  });

  // GET /api/v1/customers/:id
  fastify.get('/customers/:id', async (request, reply) => {
    const paramsSchema = z.object({
      id: z.string().uuid()
    });

    const { id } = paramsSchema.parse(request.params);

    // Customer ownership check: if authenticated user is a customer, ensure they only access their own profile
    if (request.user?.role === 'CUSTOMER' && request.user.id !== id) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Access denied: You cannot view profile details of another customer.'
      });
    }

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        addresses: true,
        orders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            items: true,
            shipment: true,
            payments: true
          }
        },
        tickets: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { messages: true }
        },
        refundRequests: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { refund: true }
        }
      }
    });

    if (!customer) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Customer with ID ${id} not found.`
      });
    }

    return reply.status(200).send(customer);
  });
}
