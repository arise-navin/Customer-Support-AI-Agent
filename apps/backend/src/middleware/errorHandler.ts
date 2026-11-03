import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  request.log.error({
    err: error,
    url: request.raw.url,
    method: request.raw.method,
    headers: request.headers
  }, 'Central error handler caught exception');

  // Handle Zod Validation Errors
  if (error instanceof ZodError) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Request validation failed',
      details: error.errors
    });
  }

  // Handle Fastify standard errors
  if (error.statusCode) {
    return reply.status(error.statusCode).send({
      statusCode: error.statusCode,
      error: error.name || 'Error',
      message: error.message
    });
  }

  // Fallback 500
  return reply.status(500).send({
    statusCode: 500,
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : error.message
  });
}
