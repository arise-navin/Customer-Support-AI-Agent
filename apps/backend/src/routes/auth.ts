import { timingSafeEqual, createHash } from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../config/env.js';
import { getSessionUser } from '../middleware/auth.js';

const LoginSchema = z.object({ username: z.string().min(1).max(100), password: z.string().min(1).max(100) });

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    if (request.method === 'POST' && request.headers['sec-fetch-site'] === 'cross-site') {
      return reply.code(403).send({ message: 'Cross-site authentication requests are not allowed' });
    }
  });

  app.post('/auth/login', async (request, reply) => {
    const credentials = LoginSchema.parse(request.body);
    const passwordHash = createHash('sha256').update(credentials.password).digest();
    const expectedHash = createHash('sha256').update('admin').digest();
    if (credentials.username !== 'admin' || !timingSafeEqual(passwordHash, expectedHash)) {
      return reply.code(401).send({ message: 'Invalid username or password' });
    }
    const token = await reply.jwtSign({ id: 'admin-system-user', email: 'admin@signetlab.internal', role: 'ADMIN', tenantId: env.SIGNET_TENANT_ID });
    reply.setCookie('support_session', token, {
      path: '/', httpOnly: true, sameSite: 'strict', secure: env.NODE_ENV === 'production', maxAge: 8 * 60 * 60
    });
    return { username: 'admin' };
  });

  app.get('/auth/session', async (request, reply) => {
    const user = await getSessionUser(request);
    if (user?.id !== 'admin-system-user') {
      return reply.code(401).send({ message: 'Please sign in to continue' });
    }
    return { username: 'admin' };
  });

  app.post('/auth/logout', async (request, reply) => {
    reply.clearCookie('support_session', { path: '/' });
    return { success: true };
  });
}
