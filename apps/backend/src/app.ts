import fastifyCors from '@fastify/cors';
import fastifySensible from '@fastify/sensible';
import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import { authRoutes } from './routes/auth.js';
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
    origin: (origin, cb) => {
      // Allow requests with no origin (curl, same-origin, server-to-server) or any deployment domain
      if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1') || origin.endsWith('.vercel.app')) {
        return cb(null, true);
      }
      return cb(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true
  });

  // Sensible helpers (httpErrors, etc.)
  app.register(fastifySensible);
  app.register(fastifyCookie);
  app.register(fastifyJwt, {
    secret: env.API_SECRET_KEY,
    cookie: { cookieName: 'support_session', signed: false },
    sign: { expiresIn: '8h' }
  });

  // Central Error Handler
  app.setErrorHandler(errorHandler);

  // Authentication hook
  app.addHook('onRequest', authMiddleware);

  // Root health endpoints for Vercel and serverless probes
  app.get('/', async () => ({ status: 'healthy', service: 'customer-support-api' }));
  app.get('/api', async () => ({ status: 'healthy', service: 'customer-support-api' }));
  app.get('/api/health', async () => ({ status: 'healthy', service: 'customer-support-api' }));

  // Versioned API Routes (/api/v1)
  app.register(
    async (v1) => {
      v1.register(healthRoutes);
      v1.register(authRoutes);
      v1.register(customerRoutes);
      v1.register(orderRoutes);
      v1.register(ticketRoutes);
      v1.register(refundRoutes);
      v1.register(knowledgeBaseRoutes);
      v1.register(ollamaRoutes);
      v1.register(agentRoutes);
      v1.register(chatRoutes);
    },
    { prefix: '/api/v1' }
  );

  return app;
}
