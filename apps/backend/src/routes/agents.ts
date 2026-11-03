import { FastifyInstance } from 'fastify';
import { prisma } from '@support/database';
import { agentRunner, agentStateManager } from '@support/agents';
import { ollamaService } from '../services/ollama.service.js';
import { z } from 'zod';

const paramsSchema = z.object({ id: z.string().min(1) });
const publicAgentSelect = {
  id: true, name: true, description: true, model: true, status: true,
  riskTier: true, autonomyLevel: true, lastActiveAt: true, killedAt: true, killedReason: true,
  createdAt: true, permissions: true, _count: { select: { executions: true } }
} as const;

/** REST connection: authenticate all agent operations with the existing API key or session. */
export async function agentRoutes(app: FastifyInstance): Promise<void> {
  app.get('/agents', async () => prisma.aiAgent.findMany({ select: publicAgentSelect, orderBy: { id: 'asc' } }));

  app.get('/agents/executions', async (request) => {
    const { agentId, limit, offset } = z.object({
      agentId: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).default(30),
      offset: z.coerce.number().int().min(0).default(0)
    }).parse(request.query);
    const where = agentId ? { agentId } : {};
    const [total, executions] = await Promise.all([
      prisma.agentExecution.count({ where }),
      prisma.agentExecution.findMany({ where, take: limit, skip: offset, orderBy: { createdAt: 'desc' },
        include: { agent: { select: { name: true } }, toolCalls: true } })
    ]);
    return { total, limit, offset, data: executions.map(({ governanceDecision, signetCorrelationId, ...execution }) => ({
      ...execution, status: governanceDecision === 'ALLOW' ? 'COMPLETED' : governanceDecision
    })) };
  });

  app.get('/agents/:id', async (request) => {
    const { id } = paramsSchema.parse(request.params);
    const agent = await prisma.aiAgent.findUnique({ where: { id }, select: publicAgentSelect });
    if (!agent) throw app.httpErrors.notFound(`Agent '${id}' does not exist.`);
    return agent;
  });

  app.get('/agents/:id/track', async (request) => {
    const { id } = paramsSchema.parse(request.params);
    const agent = await prisma.aiAgent.findUnique({ where: { id }, select: publicAgentSelect });
    if (!agent) throw app.httpErrors.notFound(`Agent '${id}' does not exist.`);
    const [executions, totalExecutions, runningCount, totalToolCalls, latency] = await Promise.all([
      prisma.agentExecution.findMany({ where: { agentId: id }, take: 30, orderBy: { createdAt: 'desc' }, include: { toolCalls: true } }),
      prisma.agentExecution.count({ where: { agentId: id } }),
      prisma.agentExecution.count({ where: { agentId: id, governanceDecision: 'RUNNING' } }),
      prisma.agentToolCall.count({ where: { execution: { agentId: id } } }),
      prisma.agentExecution.aggregate({ where: { agentId: id }, _avg: { durationMs: true } })
    ]);
    return { agent, telemetry: { totalExecutions, runningCount, totalToolCalls, avgLatencyMs: Math.round(latency._avg.durationMs ?? 0) },
      auditTrail: executions.map(({ governanceDecision, signetCorrelationId, ...execution }) => ({
        ...execution, status: governanceDecision === 'ALLOW' ? 'COMPLETED' : governanceDecision
      })) };
  });

  app.post('/agents/:id/run', async (request) => {
    const { id } = paramsSchema.parse(request.params);
    const body = z.object({
      message: z.string().min(1), customerId: z.string().uuid().optional(), conversationId: z.string().uuid().optional(),
      history: z.array(z.object({ role: z.enum(['user', 'assistant', 'system', 'tool']), content: z.string() })).optional()
    }).parse(request.body);
    return agentRunner.run({ agentId: id, userMessage: body.message, authenticatedCustomerId: body.customerId,
      conversationId: body.conversationId, conversationHistory: body.history, modelService: ollamaService });
  });

  app.post('/agents/:id/pause', async (request) => {
    const { id } = paramsSchema.parse(request.params);
    const { reason } = z.object({ reason: z.string().min(1) }).parse(request.body);
    await agentStateManager.setStatus(id, 'PAUSED', reason);
    return { agentId: id, status: 'PAUSED', reason };
  });

  app.post('/agents/:id/stop', async (request) => {
    const { id } = paramsSchema.parse(request.params);
    const { reason } = z.object({ reason: z.string().min(1) }).parse(request.body);
    await agentStateManager.kill(id, reason);
    return { agentId: id, status: 'KILLED', reason };
  });

  app.post('/agents/:id/activate', async (request) => {
    const { id } = paramsSchema.parse(request.params);
    await agentStateManager.activate(id);
    return { agentId: id, status: 'ACTIVE' };
  });
}
