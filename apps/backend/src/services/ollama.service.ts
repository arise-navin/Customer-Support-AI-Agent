import { env } from '../config/env.js';
import { z } from 'zod';

export interface OllamaModelInfo {
  name: string;
  model: string;
  size?: number;
  digest?: string;
  details?: {
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
  capabilities?: string[];
}

export interface OllamaHealthStatus {
  healthy: boolean;
  latencyMs: number;
  baseUrl: string;
  configuredModel: string;
  modelValidated: boolean;
  error?: string;
}

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface OllamaToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export interface GenerateOptions {
  model?: string;
  messages: OllamaMessage[];
  tools?: OllamaToolDefinition[];
  temperature?: number;
  timeoutMs?: number;
  correlationId?: string;
}

export interface GenerateResult {
  content: string;
  thinking?: string;
  toolCalls?: Array<{
    id?: string;
    name: string;
    arguments: Record<string, any>;
  }>;
  durationMs: number;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  rawResponse: any;
}

export class OllamaService {
  private baseUrl: string;
  private defaultModel: string;
  private defaultTimeoutMs: number;
  private apiKey?: string;

  constructor(
    baseUrl: string = env.OLLAMA_BASE_URL,
    defaultModel: string = env.OLLAMA_MODEL,
    defaultTimeoutMs: number = env.OLLAMA_TIMEOUT_MS,
    apiKey?: string
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.defaultModel = defaultModel;
    this.defaultTimeoutMs = defaultTimeoutMs;
    this.apiKey = apiKey !== undefined ? apiKey : env.OLLAMA_API_KEY;
  }

  private getHeaders(additionalHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      ...(additionalHeaders || {})
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  // 1. Check health of Ollama daemon
  async checkHealth(): Promise<OllamaHealthStatus> {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        headers: this.getHeaders(),
        signal: controller.signal
      });
      clearTimeout(timeout);

      const latencyMs = Date.now() - start;

      if (!res.ok) {
        return {
          healthy: false,
          latencyMs,
          baseUrl: this.baseUrl,
          configuredModel: this.defaultModel,
          modelValidated: false,
          error: `Ollama returned status ${res.status}: ${res.statusText}`
        };
      }

      const data = await res.json() as { models?: OllamaModelInfo[] };
      const modelValidated = (data.models || []).some((m) => {
        const mName = m.name.toLowerCase();
        const configured = this.defaultModel.toLowerCase();
        return (
          mName === configured ||
          mName.startsWith(configured.split(':')[0]) ||
          configured.startsWith(mName.split(':')[0])
        );
      });

      return {
        healthy: true,
        latencyMs,
        baseUrl: this.baseUrl,
        configuredModel: this.defaultModel,
        modelValidated
      };
    } catch (err: any) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        baseUrl: this.baseUrl,
        configuredModel: this.defaultModel,
        modelValidated: false,
        error: err.name === 'AbortError' ? 'Ollama connection timed out' : err.message
      };
    }
  }

  // 2. List installed models
  async listModels(): Promise<OllamaModelInfo[]> {
    const res = await fetch(`${this.baseUrl}/api/tags`, {
      headers: this.getHeaders()
    });
    if (!res.ok) {
      throw new Error(`Failed to list Ollama models: ${res.statusText}`);
    }
    const data = await res.json() as { models?: OllamaModelInfo[] };
    return data.models || [];
  }

  // 3. Validate configured model exists
  async validateModel(modelName: string = this.defaultModel): Promise<{
    valid: boolean;
    resolvedModel: string;
    modelInfo?: OllamaModelInfo;
    error?: string;
  }> {
    const models = await this.listModels();
    const cleanTarget = modelName.trim().toLowerCase();

    // Match exact name, or name without tag, or prefix
    const match = models.find((m) => {
      const name = m.name.toLowerCase();
      return (
        name === cleanTarget ||
        name.startsWith(`${cleanTarget}:`) ||
        cleanTarget.startsWith(`${name}:`) ||
        (cleanTarget.split(':')[0] === name.split(':')[0]) ||
        (cleanTarget.startsWith('beam') && name.startsWith('beam'))
      );
    });

    if (!match) {
      const availableList = models.map((m) => m.name).join(', ') || 'none';
      return {
        valid: false,
        resolvedModel: modelName,
        error: `Requested model '${modelName}' is not installed in Ollama. Available models: [${availableList}]. Run 'ollama pull ${modelName}' or select an installed model.`
      };
    }

    return {
      valid: true,
      resolvedModel: modelName,
      modelInfo: match
    };
  }

  // 4. Generate non-streaming response with tool support
  async generateResponse(options: GenerateOptions): Promise<GenerateResult> {
    const start = Date.now();
    const modelValidation = await this.validateModel(options.model || this.defaultModel);
    if (!modelValidation.valid) {
      throw new Error(modelValidation.error);
    }

    const resolvedModel = modelValidation.resolvedModel;
    const timeoutMs = options.timeoutMs || this.defaultTimeoutMs;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const payload: Record<string, any> = {
        model: resolvedModel,
        messages: options.messages,
        stream: false,
        options: {
          temperature: options.temperature ?? 0.2
        }
      };

      if (options.tools && options.tools.length > 0) {
        payload.tools = options.tools;
      }

      const headers = this.getHeaders({
        'Content-Type': 'application/json',
        ...(options.correlationId ? { 'X-Correlation-ID': options.correlationId } : {})
      });

      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timer);

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Ollama inference failed (${res.status}): ${errText}`);
      }

      const data = await res.json() as any;
      const durationMs = Date.now() - start;

      const message = data.message || {};
      const toolCalls = (message.tool_calls || []).map((tc: any) => ({
        id: tc.id || `call_${Math.random().toString(36).substring(2, 9)}`,
        name: tc.function?.name || tc.name,
        arguments: typeof tc.function?.arguments === 'string'
          ? JSON.parse(tc.function.arguments)
          : tc.function?.arguments || {}
      }));

      const promptTokens = data.prompt_eval_count ?? 0;
      const completionTokens = data.eval_count ?? 0;

      return {
        content: message.content || '',
        thinking: message.thinking,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        durationMs,
        tokenUsage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens
        },
        rawResponse: data
      };
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new Error(`Ollama request timed out after ${timeoutMs}ms (Correlation: ${options.correlationId || 'none'})`);
      }
      throw err;
    }
  }

  // 5. Stream response via callback
  async streamResponse(
    options: GenerateOptions,
    onChunk: (chunk: { content: string; thinking?: string; done: boolean }) => void,
    signal?: AbortSignal
  ): Promise<GenerateResult> {
    const start = Date.now();
    const modelValidation = await this.validateModel(options.model || this.defaultModel);
    if (!modelValidation.valid) {
      throw new Error(modelValidation.error);
    }

    const payload: Record<string, any> = {
      model: modelValidation.resolvedModel,
      messages: options.messages,
      stream: true,
      options: {
        temperature: options.temperature ?? 0.2
      }
    };

    if (options.tools && options.tools.length > 0) {
      payload.tools = options.tools;
    }

    const headers = this.getHeaders({ 'Content-Type': 'application/json' });

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal
    });

    if (!res.ok || !res.body) {
      throw new Error(`Failed to stream from Ollama: ${res.statusText}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let fullThinking = '';
    let finalData: any = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n').filter((l) => l.trim().length > 0);

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          const chunkMsg = parsed.message || {};
          const chunkContent = chunkMsg.content || '';
          const chunkThinking = chunkMsg.thinking || '';

          fullContent += chunkContent;
          if (chunkThinking) fullThinking += chunkThinking;

          onChunk({
            content: chunkContent,
            thinking: chunkThinking || undefined,
            done: parsed.done || false
          });

          if (parsed.done) {
            finalData = parsed;
          }
        } catch {
          // ignore partial JSON parse errors in stream
        }
      }
    }

    const durationMs = Date.now() - start;
    const promptTokens = finalData?.prompt_eval_count ?? 0;
    const completionTokens = finalData?.eval_count ?? 0;

    return {
      content: fullContent,
      thinking: fullThinking || undefined,
      durationMs,
      tokenUsage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens
      },
      rawResponse: finalData
    };
  }

  // 6. Generate structured output conforming to JSON schema / Zod
  async generateStructuredOutput<T>(
    options: GenerateOptions,
    schema: z.ZodSchema<T>
  ): Promise<{ data: T; durationMs: number; raw: string }> {
    const systemPrompt = `You must output ONLY valid, parsable JSON conforming to the requested schema. Do not enclose in markdown codeblocks. Do not include explanation outside JSON.`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...options.messages
    ];

    const result = await this.generateResponse({
      ...options,
      messages
    });

    // Clean markdown code blocks if model included them
    let cleanText = result.content.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
    }

    try {
      const parsedJson = JSON.parse(cleanText);
      const validated = schema.parse(parsedJson);
      return {
        data: validated,
        durationMs: result.durationMs,
        raw: cleanText
      };
    } catch (parseErr: any) {
      throw new Error(`Model output did not match structured schema: ${parseErr.message}\nRaw content: ${cleanText}`);
    }
  }

  // 7. Test tool calling capability with verification
  async testToolCalling(modelName?: string): Promise<{
    success: boolean;
    model: string;
    toolCalled?: string;
    arguments?: any;
    durationMs: number;
    error?: string;
  }> {
    const testTool: OllamaToolDefinition = {
      type: 'function',
      function: {
        name: 'calculate_discount',
        description: 'Calculate discount percentage for an item',
        parameters: {
          type: 'object',
          properties: {
            itemCode: { type: 'string', description: 'Item code e.g. ITEM-123' },
            customerTier: { type: 'string', description: 'Customer tier VIP or GOLD' }
          },
          required: ['itemCode', 'customerTier']
        }
      }
    };

    try {
      const res = await this.generateResponse({
        model: modelName || this.defaultModel,
        messages: [
          {
            role: 'user',
            content: 'Please calculate the discount for item code ITEM-884 for VIP customer.'
          }
        ],
        tools: [testTool],
        timeoutMs: 30000
      });

      const called = res.toolCalls?.[0];
      if (!called) {
        return {
          success: false,
          model: modelName || this.defaultModel,
          durationMs: res.durationMs,
          error: 'Model did not trigger tool call; returned plain text instead: ' + res.content
        };
      }

      return {
        success: true,
        model: modelName || this.defaultModel,
        toolCalled: called.name,
        arguments: called.arguments,
        durationMs: res.durationMs
      };
    } catch (err: any) {
      return {
        success: false,
        model: modelName || this.defaultModel,
        durationMs: 0,
        error: err.message
      };
    }
  }
}

export const ollamaService = new OllamaService();
