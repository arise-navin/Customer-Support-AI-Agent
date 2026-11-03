import { buildApp } from './app.js';
import { env } from './config/env.js';
import { IncomingMessage, ServerResponse } from 'node:http';

const app = buildApp();

async function start() {
  try {
    const address = await app.listen({
      port: env.PORT,
      host: env.HOST
    });
    app.log.info(`🚀 Customer Support API backend listening on ${address}`);
    app.log.info(`👉 Health check: ${address}/api/v1/health`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Start listener when running as a standalone server / process
if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
  start();
}

export default async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  await app.ready();
  app.server.emit('request', request, response);
}
export { app };
