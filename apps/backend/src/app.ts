import fastifyCors from '@fastify/cors';
import fastifySensible from '@fastify/sensible';
import Fastify from 'fastify';
import { env } from './config/env.js';
import { authMiddleware } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRoutes } from './routes/health.js';
import { customerRoutes } from './routes/customers.js';
import { orderRoutes } from './routes/orders.js';
import { ticketRoutes } from './routes/tickets.js';
import { refundRoutes } from './routes/refunds.js';
import { knowledgeBaseRoutes } from './routes/knowledgeBase.js';
import { ollamaRoutes } from './routes/ollama.js';
import { agentRoutes } from './routes/agents.js';
import { chatRoutes } from './routes/chat.js';
import { testLabRoutes } from './routes/testLab.js';
import { signetRoutes } from './routes/signet.js';
import { dashboardRoutes } from './routes/dashboard.js';

export function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'test' ? 'silent' : 'info',
      transport:
        env.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname'
              }
            }
          : undefined
    }
  });

  // CORS
  app.register(fastifyCors, {
    origin: [env.CORS_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true
  });

  // Sensible helpers (httpErrors, etc.)
  app.register(fastifySensible);

  // Central Error Handler
  app.setErrorHandler(errorHandler);

  // Authentication hook
  app.addHook('onRequest', authMiddleware);

  // Versioned API Routes (/api/v1)
  app.register(
    async (v1) => {
      v1.register(healthRoutes);
      v1.register(customerRoutes);
      v1.register(orderRoutes);
      v1.register(ticketRoutes);
      v1.register(refundRoutes);
      v1.register(knowledgeBaseRoutes);
      v1.register(ollamaRoutes);
      v1.register(agentRoutes);
      v1.register(chatRoutes);
      v1.register(testLabRoutes);
      v1.register(signetRoutes);
      v1.register(dashboardRoutes);
    },
    { prefix: '/api/v1' }
  );

  return app;
}
