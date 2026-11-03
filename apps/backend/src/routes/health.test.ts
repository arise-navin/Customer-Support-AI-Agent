import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';

describe('Health API', () => {
  it('GET /api/v1/health should return status healthy and service customer-support-api', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health'
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body).toEqual({
      status: 'healthy',
      service: 'customer-support-api'
    });
  });
});
