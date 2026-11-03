import { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config/env.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  tenantId: string;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthenticatedUser;
    user: AuthenticatedUser;
  }
}

export async function getSessionUser(request: FastifyRequest): Promise<AuthenticatedUser | null> {
  if (!request.cookies.support_session) return null;
  try {
    await request.jwtVerify({ onlyCookie: true });
    return request.user;
  } catch (error) {
    if (error instanceof Error && 'code' in error && typeof error.code === 'string' &&
      (error.code.startsWith('FST_JWT_') || error.code.startsWith('FAST_JWT_'))) return null;
    throw error;
  }
}

const PUBLIC_ROUTES = [
  '/',
  '/api',
  '/api/health',
  '/api/v1/auth/login',
  '/api/v1/auth/session',
  '/api/v1/auth/logout',
  '/api/v1/health',
  '/api/v1/health/detailed'
];

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const url = request.raw.url?.split('?')[0] || '';

  // Allow public routes
  if (PUBLIC_ROUTES.includes(url)) {
    return;
  }

  const authHeader = request.headers['authorization'];
  const apiKeyHeader = request.headers['x-api-key'];

  const sessionUser = await getSessionUser(request);
  if (sessionUser?.id === 'admin-system-user') {
    return;
  }

  // Check custom test headers for role & customer isolation
  const customRole = request.headers['x-user-role'] as string;
  const customCustomerId = request.headers['x-customer-id'] as string;
  if (env.NODE_ENV === 'test' && customRole) {
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
    if (token === env.API_SECRET_KEY) {
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
  if (env.NODE_ENV === 'test') {
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
