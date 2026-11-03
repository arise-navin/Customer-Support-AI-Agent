import { FastifyInstance } from 'fastify';
import { ollamaService } from '../services/ollama.service.js';
import { z } from 'zod';

export async function ollamaRoutes(fastify: FastifyInstance) {
  // GET /api/v1/ollama/health
  fastify.get('/ollama/health', async (request, reply) => {
    const health = await ollamaService.checkHealth();
    return reply.status(health.healthy ? 200 : 503).send(health);
  });

  // GET /api/v1/ollama/models
  fastify.get('/ollama/models', async (request, reply) => {
    try {
      const models = await ollamaService.listModels();
      const validation = await ollamaService.validateModel();
      return reply.status(200).send({
        models,
        configuredModel: validation.resolvedModel,
        isValidated: validation.valid,
        error: validation.error
      });
    } catch (err: any) {
      return reply.status(502).send({
        statusCode: 502,
        error: 'Bad Gateway',
        message: err.message
      });
    }
  });

  // POST /api/v1/ollama/test
  fastify.post('/ollama/test', async (request, reply) => {
    const bodySchema = z.object({
      model: z.string().optional(),
      prompt: z.string().default('Say Hello in 3 words.')
    });

    const { model, prompt } = bodySchema.parse(request.body || {});

    try {
      const start = Date.now();
      const [inferenceRes, toolTestRes] = await Promise.all([
        ollamaService.generateResponse({
          model,
          messages: [{ role: 'user', content: prompt }],
          timeoutMs: 30000
        }),
        ollamaService.testToolCalling(model)
      ]);

      return reply.status(200).send({
        success: true,
        model: inferenceRes.rawResponse?.model || model || 'beam:cloud',
        totalDurationMs: Date.now() - start,
        inference: {
          prompt,
          response: inferenceRes.content,
          thinking: inferenceRes.thinking,
          tokens: inferenceRes.tokenUsage,
          durationMs: inferenceRes.durationMs
        },
        toolCalling: toolTestRes
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: err.message
      });
    }
  });

  // POST /api/v1/ollama/chat
  fastify.post('/ollama/chat', async (request, reply) => {
    const chatSchema = z.object({
      model: z.string().optional(),
      messages: z.array(
        z.object({
          role: z.enum(['system', 'user', 'assistant', 'tool']),
          content: z.string(),
          name: z.string().optional()
        })
      ),
      tools: z.array(z.any()).optional(),
      stream: z.boolean().default(false),
      correlationId: z.string().optional()
    });

    const body = chatSchema.parse(request.body);

    // If streaming requested, use Server-Sent Events (SSE)
    if (body.stream) {
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('Access-Control-Allow-Origin', '*');

      try {
        const streamResult = await ollamaService.streamResponse(
          {
            model: body.model,
            messages: body.messages,
            tools: body.tools,
            correlationId: body.correlationId
          },
          (chunk) => {
            reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }
        );

        reply.raw.write(
          `data: ${JSON.stringify({ done: true, tokenUsage: streamResult.tokenUsage })}\n\n`
        );
        reply.raw.end();
      } catch (err: any) {
        reply.raw.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        reply.raw.end();
      }
      return;
    }

    // Non-streaming response
    try {
      const result = await ollamaService.generateResponse({
        model: body.model,
        messages: body.messages,
        tools: body.tools,
        correlationId: body.correlationId
      });

      return reply.status(200).send(result);
    } catch (err: any) {
      return reply.status(500).send({
        statusCode: 500,
        error: 'Inference Error',
        message: err.message
      });
    }
  });
}
