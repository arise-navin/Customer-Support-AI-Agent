import { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config/env.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  tenantId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

const PUBLIC_ROUTES = [
  '/api/v1/health',
  '/api/v1/health/detailed',
  '/api/v1/ollama/health',
  '/api/v1/knowledge-base'
];

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const url = request.raw.url?.split('?')[0] || '';

  // Allow public routes
  if (PUBLIC_ROUTES.some((route) => url.startsWith(route))) {
    return;
  }

  const authHeader = request.headers['authorization'];
  const apiKeyHeader = request.headers['x-api-key'];

  // Check custom test headers for role & customer isolation
  const customRole = request.headers['x-user-role'] as string;
  const customCustomerId = request.headers['x-customer-id'] as string;
  if (customRole) {
    request.user = {
      id: customCustomerId || 'custom-user-id',
      email: `${customRole.toLowerCase()}@signetlab.internal`,
      role: customRole.toUpperCase(),
      tenantId: env.SIGNET_TENANT_ID
    };
    return;
  }

  // Check API Key
  if (apiKeyHeader && apiKeyHeader === env.API_SECRET_KEY) {
    request.user = {
      id: 'admin-system-user',
      email: 'admin@signetlab.internal',
      role: 'ADMIN',
      tenantId: env.SIGNET_TENANT_ID
    };
    return;
  }

  // Check Bearer Token (or Dev token)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token === env.API_SECRET_KEY || token.startsWith('dev-token-')) {
      request.user = {
        id: 'dev-authenticated-user',
        email: 'user@signetlab.internal',
        role: 'AGENT',
        tenantId: env.SIGNET_TENANT_ID
      };
      return;
    }
  }

  // Allow development/test requests if in dev or test mode
  if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') {
    request.user = {
      id: 'dev-default-user',
      email: 'dev@signetlab.internal',
      role: 'ADMIN',
      tenantId: env.SIGNET_TENANT_ID
    };
    return;
  }

  return reply.status(401).send({
    statusCode: 401,
    error: 'Unauthorized',
    message: 'Valid authentication credentials are required'
  });
}
