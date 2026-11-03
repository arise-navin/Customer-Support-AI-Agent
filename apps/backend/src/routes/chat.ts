import { FastifyInstance } from 'fastify';
import { prisma } from '@signet/database';
import { agentOrchestrator } from '@signet/agents';
import { ollamaService } from '../services/ollama.service.js';
import { z } from 'zod';

export async function chatRoutes(fastify: FastifyInstance) {
  // GET /api/v1/chat/conversations
  fastify.get('/chat/conversations', async (request, reply) => {
    const querySchema = z.object({
      customerId: z.string().uuid().optional(),
      limit: z.coerce.number().min(1).max(50).default(20)
    });

    const { customerId, limit } = querySchema.parse(request.query);

    const effectiveCustomerId =
      request.user?.role === 'CUSTOMER' ? request.user.id : customerId;

    const where: any = {};
    if (effectiveCustomerId) {
      where.customerId = effectiveCustomerId;
    }

    const conversations = await prisma.conversation.findMany({
      where,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        customer: { select: { fullName: true, email: true } },
        _count: { select: { messages: true } }
      }
    });

    return reply.status(200).send(conversations);
  });

  // GET /api/v1/chat/conversations/:id
  fastify.get('/chat/conversations/:id', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string().uuid() });
    const { id } = paramsSchema.parse(request.params);

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, fullName: true, email: true, tier: true } },
        messages: { orderBy: { createdAt: 'asc' } },
        handoffs: { orderBy: { createdAt: 'asc' } }
      }
    });

    if (!conversation) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Conversation ${id} not found.`
      });
    }

    return reply.status(200).send(conversation);
  });

  // POST /api/v1/chat/conversations
  fastify.post('/chat/conversations', async (request, reply) => {
    const bodySchema = z.object({
      customerId: z.string().uuid(),
      title: z.string().optional()
    });

    const { customerId, title } = bodySchema.parse(request.body);

    const conv = await prisma.conversation.create({
      data: {
        customerId,
        title: title || 'New Support Inquiries',
        activeAgentId: 'support-agent-001'
      }
    });

    return reply.status(201).send(conv);
  });

  // POST /api/v1/chat/message
  fastify.post('/chat/message', async (request, reply) => {
    const bodySchema = z.object({
      conversationId: z.string().uuid().optional(),
      customerId: z.string().uuid(),
      message: z.string().min(1),
      stream: z.boolean().default(false)
    });

    const body = bodySchema.parse(request.body);

    // If streaming SSE requested
    if (body.stream) {
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('Access-Control-Allow-Origin', '*');

      try {
        await agentOrchestrator.dispatchMessage({
          conversationId: body.conversationId,
          customerId: body.customerId,
          userMessage: body.message,
          modelService: ollamaService,
          onEvent: (event) => {
            reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
          }
        });

        reply.raw.end();
      } catch (err: any) {
        reply.raw.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
        reply.raw.end();
      }
      return;
    }

    // Non-streaming response
    try {
      const result = await agentOrchestrator.dispatchMessage({
        conversationId: body.conversationId,
        customerId: body.customerId,
        userMessage: body.message,
        modelService: ollamaService
      });

      return reply.status(200).send(result);
    } catch (err: any) {
      return reply.status(500).send({
        statusCode: 500,
        error: 'Orchestration Error',
        message: err.message
      });
    }
  });
}
