export interface SignetGatewayConfig {
  gatewayUrl: string;
  tenantId: string;
  timeoutMs?: number;
  apiKey?: string;
}

export class SignetGatewayError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly endpoint?: string,
    public readonly details?: any
  ) {
    super(`SignetGatewayError [${statusCode || 'NETWORK'}]: ${message}`);
    this.name = 'SignetGatewayError';
  }
}

export class SignetGatewayClient {
  private gatewayUrl: string;
  private tenantId: string;
  private timeoutMs: number;
  private apiKey?: string;

  constructor(config: SignetGatewayConfig) {
    this.gatewayUrl = config.gatewayUrl.replace(/\/+$/, '');
    this.tenantId = config.tenantId;
    this.timeoutMs = config.timeoutMs || 10000;
    this.apiKey = config.apiKey;
  }

  updateConfig(config: Partial<SignetGatewayConfig>) {
    if (config.gatewayUrl !== undefined) this.gatewayUrl = config.gatewayUrl.replace(/\/+$/, '');
    if (config.tenantId !== undefined) this.tenantId = config.tenantId;
    if (config.timeoutMs !== undefined) this.timeoutMs = config.timeoutMs;
    if (config.apiKey !== undefined) this.apiKey = config.apiKey;
  }

  getConfig(): SignetGatewayConfig {
    return {
      gatewayUrl: this.gatewayUrl,
      tenantId: this.tenantId,
      timeoutMs: this.timeoutMs,
      apiKey: this.apiKey
    };
  }

  private getHeaders(certificateId?: string, workloadId?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-signet-tenant-id': this.tenantId
    };
    if (certificateId) headers['x-signet-agent-cert'] = certificateId;
    if (workloadId) headers['x-signet-workload-id'] = workloadId;
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;
    return headers;
  }

  async checkHealth(): Promise<{ status: string; latencyMs: number; raw?: any }> {
    if (!this.gatewayUrl) {
      throw new SignetGatewayError('No SIGNET_GATEWAY_URL configured', 400);
    }

    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.gatewayUrl}/v1/health`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: controller.signal
      });

      const latencyMs = Date.now() - start;
      if (!res.ok) {
        throw new SignetGatewayError(
          `Gateway health check failed with HTTP ${res.status}`,
          res.status,
          '/v1/health'
        );
      }

      const data = await res.json().catch(() => ({}));
      return { status: 'healthy', latencyMs, raw: data };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      if (err.name === 'AbortError') {
        throw new SignetGatewayError(`Gateway connection timed out after ${this.timeoutMs}ms`, 504, '/v1/health');
      }
      throw new SignetGatewayError(err.message || 'Unable to connect to Signet Gateway', 503, '/v1/health', {
        latencyMs
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async decide(payload: any, certId?: string, workloadId?: string): Promise<any> {
    return this.postRequest('/v1/decide', payload, certId, workloadId);
  }

  async proxyLlmCompletion(payload: any, certId?: string, workloadId?: string): Promise<any> {
    return this.postRequest('/v1/llm/openai/chat/completions', payload, certId, workloadId);
  }

  async invokeHttpTool(toolAlias: string, payload: any, certId?: string, workloadId?: string): Promise<any> {
    return this.postRequest(`/v1/tools/http/${encodeURIComponent(toolAlias)}`, payload, certId, workloadId);
  }

  async invokeA2A(targetAgentId: string, payload: any, certId?: string, workloadId?: string): Promise<any> {
    return this.postRequest(`/v1/a2a/${encodeURIComponent(targetAgentId)}`, payload, certId, workloadId);
  }

  private async postRequest(endpoint: string, payload: any, certId?: string, workloadId?: string): Promise<any> {
    if (!this.gatewayUrl) {
      throw new SignetGatewayError('SIGNET_GATEWAY_URL is not configured', 400, endpoint);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.gatewayUrl}${endpoint}`, {
        method: 'POST',
        headers: this.getHeaders(certId, workloadId),
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new SignetGatewayError(
          `Signet Gateway rejected request: HTTP ${res.status} - ${errorText}`,
          res.status,
          endpoint,
          { errorText }
        );
      }

      return await res.json();
    } catch (err: any) {
      if (err instanceof SignetGatewayError) throw err;
      if (err.name === 'AbortError') {
        throw new SignetGatewayError(`Gateway request to ${endpoint} timed out`, 504, endpoint);
      }
      throw new SignetGatewayError(err.message || `Failed to communicate with Signet Gateway`, 502, endpoint);
    } finally {
      clearTimeout(timeout);
    }
  }
}
