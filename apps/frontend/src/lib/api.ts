const API_BASE = '/api/v1';

export interface HealthData {
  status: 'healthy' | 'degraded' | 'unhealthy';
  service: string;
  version?: string;
  timestamp?: string;
  database?: 'connected' | 'disconnected';
  databaseLatencyMs?: number;
  ollama?: 'connected' | 'unreachable';
  activeModel?: string;
  executionMode?: string;
}

export async function fetchHealth(): Promise<{ status: string; service: string }> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) {
    throw new Error(`Health check failed with status: ${res.status}`);
  }
  return res.json();
}

export async function fetchDetailedHealth(): Promise<HealthData> {
  const res = await fetch(`${API_BASE}/health/detailed`);
  if (!res.ok) {
    // If degraded, it returns 503 with JSON
    try {
      return await res.json();
    } catch {
      throw new Error(`Detailed health check failed with status: ${res.status}`);
    }
  }
  return res.json();
}

export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    if (response.status === 401 && !endpoint.startsWith('/auth/')) {
      window.location.reload();
    }
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || `API error: ${response.status}`);
  }

  return response.json();
}
