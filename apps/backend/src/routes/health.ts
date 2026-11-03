import { FastifyInstance } from 'fastify';
import { checkDatabaseConnection } from '@support/database';
import { env } from '../config/env.js';
import { ollamaService } from '../services/ollama.service.js';

export async function healthRoutes(fastify: FastifyInstance) {
  // Required health check matching exact Phase 1 specification
  fastify.get('/health', async (request, reply) => {
    return reply.status(200).send({
      status: 'healthy',
      service: 'customer-support-api'
    });
  });

  // Detailed health check for frontend dashboard & diagnostics
  fastify.get('/health/detailed', async (request, reply) => {
    const dbStatus = await checkDatabaseConnection();

    let ollamaStatus: 'connected' | 'unreachable' = 'unreachable';
    try {
      const oHealth = await ollamaService.checkHealth();
      if (oHealth.healthy) {
        ollamaStatus = 'connected';
      }
    } catch {
      ollamaStatus = 'unreachable';
    }

    const overallHealthy = dbStatus.connected;

    return reply.status(overallHealthy ? 200 : 503).send({
      status: overallHealthy ? 'healthy' : 'degraded',
      service: 'customer-support-api',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      database: dbStatus.connected ? 'connected' : 'disconnected',
      databaseLatencyMs: dbStatus.latencyMs,
      ollama: ollamaStatus,
      activeModel: env.OLLAMA_MODEL,
      executionMode: 'DIRECT_OLLAMA'
    });
  });
}
