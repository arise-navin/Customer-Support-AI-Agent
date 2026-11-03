import { describe, expect, it } from 'vitest';
import { buildApp } from '../apps/backend/src/app.js';
import { ollamaService } from '../apps/backend/src/services/ollama.service.js';

describe('Phase 3 Ollama Model Integration Tests', () => {
  const app = buildApp();

  it('should verify Ollama connection and health status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ollama/health'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.healthy).toBe(true);
    expect(body.baseUrl).toMatch(/11434|ollama/);
    expect(body.modelValidated).toBe(true);
  });

  it('should list installed models and confirm beam:cloud exists', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ollama/models'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.models)).toBe(true);
    expect(body.models.length).toBeGreaterThan(0);
    expect(body.isValidated).toBe(true);
    expect(body.configuredModel).toContain('beam');
  });

  it('should perform real inference with beam:cloud and return response with tokens', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ollama/test',
      payload: {
        prompt: 'Say exactly: Ollama is ready'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.inference.response).toBeDefined();
    expect(body.inference.durationMs).toBeGreaterThan(0);
    expect(body.toolCalling.success).toBe(true);
    expect(body.toolCalling.toolCalled).toBe('calculate_discount');
  }, 45000); // 45s timeout for real inference

  it('should not silently substitute when an uninstalled model is requested', async () => {
    const validation = await ollamaService.validateModel('non-existent-fake-model-xyz');
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('not installed in Ollama');
  });

  it('should support streaming response chunks from Ollama', async () => {
    let chunkCount = 0;
    const streamResult = await ollamaService.streamResponse(
      {
        messages: [{ role: 'user', content: 'Count from 1 to 3.' }]
      },
      (chunk) => {
        if (chunk.content) chunkCount++;
      }
    );

    expect(streamResult.content.length).toBeGreaterThan(0);
    expect(chunkCount).toBeGreaterThan(0);
  }, 45000);
});
