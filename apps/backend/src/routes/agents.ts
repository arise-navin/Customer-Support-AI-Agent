import { FastifyInstance } from 'fastify';
import { prisma } from '@signet/database';
import { agentRegistry, agentRunner, agentStateManager } from '@signet/agents';
import { ollamaService } from '../services/ollama.service.js';
import { z } from 'zod';

export async function agentRoutes(fastify: FastifyInstance) {
  // GET /api/v1/agents - List all agents with credential badges & status
  fastify.get('/agents', async (request, reply) => {
    const dbAgents = await prisma.aiAgent.findMany({
      include: {
        permissions: true,
        _count: { select: { executions: true } }
      },
      orderBy: { id: 'asc' }
    });

    const sanitizedAgents = dbAgents.map((a: any) => ({
      ...a,
      hasCredentials: Boolean(a.clientId && a.clientSecret),
      clientSecretMasked: a.clientSecret
        ? `${a.clientSecret.slice(0, 10)}...${a.clientSecret.slice(-4)}`
        : null
    }));

    return reply.status(200).send(sanitizedAgents);
  });

  // GET /api/v1/agents/:id - Single agent details
  fastify.get('/agents/:id', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string() });
    const { id } = paramsSchema.parse(request.params);

    const agent = await prisma.aiAgent.findUnique({
      where: { id },
      include: {
        permissions: true,
        executions: {
          take: 15,
          orderBy: { createdAt: 'desc' },
          include: { toolCalls: true }
        }
      }
    });

    if (!agent) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Agent '${id}' not found.`
      });
    }

    return reply.status(200).send({
      ...agent,
      hasCredentials: Boolean(agent.clientId && agent.clientSecret),
      clientSecretMasked: agent.clientSecret
        ? `${agent.clientSecret.slice(0, 10)}...${agent.clientSecret.slice(-4)}`
        : null
    });
  });

  // POST /api/v1/agents/:id/credentials - Create or Rotate Client ID & Client Secret
  fastify.post('/agents/:id/credentials', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string() });
    const { id } = paramsSchema.parse(request.params);

    const agent = await prisma.aiAgent.findUnique({ where: { id } });
    if (!agent) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Agent '${id}' not found.`
      });
    }

    const credentials = await agentStateManager.generateCredentials(id);

    return reply.status(201).send({
      success: true,
      agentId: id,
      agentName: agent.name,
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      createdAt: new Date().toISOString(),
      message: 'Client ID and Client Secret generated successfully. Store the secret safely.'
    });
  });

  // DELETE /api/v1/agents/:id/credentials - Revoke Client Credentials
  fastify.delete('/agents/:id/credentials', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string() });
    const { id } = paramsSchema.parse(request.params);

    await agentStateManager.revokeCredentials(id);

    return reply.status(200).send({
      success: true,
      agentId: id,
      message: `Credentials for agent '${id}' have been revoked.`
    });
  });

  // POST /api/v1/agents/:id/kill - Emergency Kill Switch
  fastify.post('/agents/:id/kill', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string() });
    const bodySchema = z.object({
      reason: z.string().optional().default('Emergency Administrative Kill Switch invoked')
    });

    const { id } = paramsSchema.parse(request.params);
    const { reason } = bodySchema.parse(request.body || {});

    await agentStateManager.kill(id, reason);

    return reply.status(200).send({
      success: true,
      agentId: id,
      status: 'KILLED',
      killedAt: new Date().toISOString(),
      reason,
      message: `Agent '${id}' has been KILLED. All incoming executions are now blocked.`
    });
  });

  // POST /api/v1/agents/:id/quarantine - Quarantine Agent
  fastify.post('/agents/:id/quarantine', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string() });
    const bodySchema = z.object({
      reason: z.string().optional().default('Agent placed under security quarantine')
    });

    const { id } = paramsSchema.parse(request.params);
    const { reason } = bodySchema.parse(request.body || {});

    await agentStateManager.quarantine(id, reason);

    return reply.status(200).send({
      success: true,
      agentId: id,
      status: 'QUARANTINED',
      reason,
      message: `Agent '${id}' is now QUARANTINED.`
    });
  });

  // POST /api/v1/agents/:id/activate - Re-activate Agent
  fastify.post('/agents/:id/activate', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string() });
    const { id } = paramsSchema.parse(request.params);

    await agentStateManager.activate(id);

    return reply.status(200).send({
      success: true,
      agentId: id,
      status: 'ACTIVE',
      message: `Agent '${id}' has been restored to ACTIVE status.`
    });
  });

  // GET /api/v1/agents/:id/track - Comprehensive Telemetry & Execution Audit Logs
  fastify.get('/agents/:id/track', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string() });
    const { id } = paramsSchema.parse(request.params);

    const agent = await prisma.aiAgent.findUnique({
      where: { id },
      include: {
        permissions: true,
        executions: {
          take: 30,
          orderBy: { createdAt: 'desc' },
          include: { toolCalls: true }
        }
      }
    });

    if (!agent) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Agent '${id}' not found.`
      });
    }

    const [totalExecutions, allowedCount, blockedCount, totalToolCalls] = await Promise.all([
      prisma.agentExecution.count({ where: { agentId: id } }),
      prisma.agentExecution.count({ where: { agentId: id, governanceDecision: 'ALLOW' } }),
      prisma.agentExecution.count({ where: { agentId: id, governanceDecision: { not: 'ALLOW' } } }),
      prisma.agentToolCall.count({ where: { execution: { agentId: id } } })
    ]);

    // Calculate latency metrics
    const durations = agent.executions.map((e: any) => e.durationMs);
    const avgLatencyMs = durations.length > 0
      ? Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length)
      : 0;

    const totalTokens = agent.executions.reduce((sum: number, e: any) => {
      return sum + (e.promptTokens || 0) + (e.completionTokens || 0);
    }, 0);

    return reply.status(200).send({
      agent: {
        id: agent.id,
        name: agent.name,
        riskTier: agent.riskTier,
        autonomyLevel: agent.autonomyLevel,
        status: agent.status,
        model: agent.model,
        clientId: agent.clientId,
        hasCredentials: Boolean(agent.clientId && agent.clientSecret),
        lastActiveAt: agent.lastActiveAt,
        killedAt: agent.killedAt,
        killedReason: agent.killedReason,
        createdAt: agent.createdAt
      },
      telemetry: {
        totalExecutions,
        allowedCount,
        blockedCount,
        totalToolCalls,
        avgLatencyMs,
        totalTokens
      },
      auditTrail: agent.executions.map((ex: any) => ({
        id: ex.id,
        timestamp: ex.createdAt,
        promptPreview: ex.prompt.length > 120 ? ex.prompt.slice(0, 120) + '...' : ex.prompt,
        responsePreview: ex.response.length > 150 ? ex.response.slice(0, 150) + '...' : ex.response,
        durationMs: ex.durationMs,
        governanceDecision: ex.governanceDecision || 'ALLOW',
        toolCallsCount: ex.toolCalls?.length || 0,
        tools: ex.toolCalls?.map((t: any) => t.toolName) || []
      }))
    });
  });

  // POST /api/v1/agents/:id/run - Run Agent with optional Client Credentials verification
  fastify.post('/agents/:id/run', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string() });
    const bodySchema = z.object({
      message: z.string().min(1),
      customerId: z.string().uuid().optional(),
      conversationId: z.string().uuid().optional(),
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
      history: z.array(z.any()).optional()
    });

    const { id } = paramsSchema.parse(request.params);
    const body = bodySchema.parse(request.body);

    // Support credentials via headers as well
    const headerClientId = request.headers['x-client-id'] as string | undefined;
    const headerClientSecret = request.headers['x-client-secret'] as string | undefined;

    const clientId = body.clientId || headerClientId;
    const clientSecret = body.clientSecret || headerClientSecret;

    try {
      const result = await agentRunner.run({
        agentId: id,
        userMessage: body.message,
        authenticatedCustomerId: body.customerId,
        conversationId: body.conversationId,
        conversationHistory: body.history,
        clientId,
        clientSecret,
        modelService: ollamaService
      });

      return reply.status(200).send(result);
    } catch (err: any) {
      const isBlocked = err.message.includes('blocked') || err.message.includes('Authentication failed');
      return reply.status(isBlocked ? 403 : 500).send({
        statusCode: isBlocked ? 403 : 500,
        error: isBlocked ? 'Agent Security / Policy Block' : 'Agent Execution Error',
        message: err.message
      });
    }
  });

  // PATCH /api/v1/agents/:id/status
  fastify.patch('/agents/:id/status', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string() });
    const bodySchema = z.object({
      status: z.enum(['ACTIVE', 'IDLE', 'PAUSED', 'QUARANTINED', 'KILLED']),
      reason: z.string().optional()
    });

    const { id } = paramsSchema.parse(request.params);
    const { status, reason } = bodySchema.parse(request.body);

    await agentStateManager.setStatus(id, status, reason);

    return reply.status(200).send({
      agentId: id,
      newStatus: status,
      reason: reason || null,
      message: `Agent status updated to ${status}.`
    });
  });

  // GET /api/v1/agents/executions
  fastify.get('/agents/executions', async (request, reply) => {
    const querySchema = z.object({
      agentId: z.string().optional(),
      limit: z.coerce.number().min(1).max(100).default(30),
      offset: z.coerce.number().min(0).default(0)
    });

    const { agentId, limit, offset } = querySchema.parse(request.query);

    const where: any = {};
    if (agentId) where.agentId = agentId;

    const [total, executions] = await Promise.all([
      prisma.agentExecution.count({ where }),
      prisma.agentExecution.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          agent: { select: { name: true, riskTier: true } },
          toolCalls: true
        }
      })
    ]);

    return reply.status(200).send({ total, limit, offset, data: executions });
  });
}
