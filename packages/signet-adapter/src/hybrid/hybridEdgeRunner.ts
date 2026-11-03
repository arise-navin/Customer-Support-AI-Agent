import os from 'os';
import crypto from 'crypto';
import { SignetHybridEdgeConfig, HybridTelemetryDigest, HybridCloudCommand } from '@signet/shared';

export interface OutboundHeartbeatPayload {
  runnerId: string;
  hostname: string;
  version: string;
  tenantId: string;
  timestamp: string;
  cachedBundleVersion: string;
  queuedMetadataCount: number;
  recentDigests: any[];
  dataResidency: 'STRICT_ON_PREM_ENFORCED';
}

export interface InboundHeartbeatResponse {
  status: 'ACK';
  serverTime: string;
  bundleUpdated: boolean;
  newBundleVersion?: string;
  commands?: HybridCloudCommand[];
}

export class HybridEdgeRunnerService {
  private edgeRunnerId: string;
  private saasEndpoint: string;
  private tenantId: string;
  private enabled: boolean;
  private tunnelStatus: 'CONNECTED' | 'DISCONNECTED' | 'DEGRADED';
  private heartbeatIntervalSec: number;
  private lastHeartbeatAt?: string;
  private lastSyncLatencyMs?: number;
  private cachedBundleVersion: string;
  private queuedDigests: any[] = [];
  private timer: NodeJS.Timeout | null = null;
  private onCommandCallback?: (cmd: HybridCloudCommand) => Promise<void>;

  constructor(options?: {
    saasEndpoint?: string;
    tenantId?: string;
    heartbeatIntervalSec?: number;
    enabled?: boolean;
  }) {
    const host = os.hostname().replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    this.edgeRunnerId = `edge_runner_${host}_${crypto.randomBytes(4).toString('hex')}`;
    this.saasEndpoint = (options?.saasEndpoint || process.env.SIGNET_HYBRID_SAAS_URL || 'https://cloud.signet.techsnitch.com').replace(/\/+$/, '');
    this.tenantId = options?.tenantId || process.env.SIGNET_TENANT_ID || 'tenant-support-lab-01';
    this.heartbeatIntervalSec = options?.heartbeatIntervalSec || parseInt(process.env.SIGNET_HYBRID_HEARTBEAT_SEC || '15', 10);
    this.enabled = options?.enabled !== undefined ? options.enabled : (process.env.SIGNET_HYBRID_EDGE_ENABLED !== 'false');
    this.tunnelStatus = 'CONNECTED';
    this.cachedBundleVersion = `bundle_sgn_edge_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
  }

  setCommandCallback(callback: (cmd: HybridCloudCommand) => Promise<void>) {
    this.onCommandCallback = callback;
  }

  start() {
    if (!this.enabled || this.timer) return;
    // Initial heartbeat attempt
    this.syncHeartbeatNow().catch(() => {});

    this.timer = setInterval(() => {
      this.syncHeartbeatNow().catch(() => {});
    }, this.heartbeatIntervalSec * 1000);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  // Queue sanitized metadata only (NO prompts, NO responses, NO PII)
  queueMetadataDigest(metadata: {
    agentId: string;
    action: string;
    decision: string;
    ruleId?: string;
    latencyMs: number;
    timestamp: string;
    dlpDetected: boolean;
    evidenceRef?: string;
  }) {
    this.queuedDigests.push({
      ...metadata,
      sanitized: true,
      hasPayloads: false
    });

    // Cap memory buffer to prevent unbounded growth in prolonged offline periods
    if (this.queuedDigests.length > 5000) {
      this.queuedDigests = this.queuedDigests.slice(-3000);
    }
  }

  // MID-Server style Outbound Heartbeat Poll
  async syncHeartbeatNow(): Promise<{
    success: boolean;
    tunnelStatus: 'CONNECTED' | 'DISCONNECTED' | 'DEGRADED';
    latencyMs: number;
    commandsExecuted: number;
    syncedMetadataCount: number;
    error?: string;
  }> {
    const start = Date.now();
    const digestsToSync = this.queuedDigests.splice(0, 100);

    const payload: OutboundHeartbeatPayload = {
      runnerId: this.edgeRunnerId,
      hostname: os.hostname(),
      version: '1.0.0-edge-mid',
      tenantId: this.tenantId,
      timestamp: new Date().toISOString(),
      cachedBundleVersion: this.cachedBundleVersion,
      queuedMetadataCount: digestsToSync.length,
      recentDigests: digestsToSync,
      dataResidency: 'STRICT_ON_PREM_ENFORCED'
    };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`${this.saasEndpoint}/api/v1/hybrid/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-signet-tenant-id': this.tenantId,
          'x-signet-edge-runner-id': this.edgeRunnerId,
          'x-signet-edge-version': '1.0.0'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeout);
      const latencyMs = Date.now() - start;
      this.lastSyncLatencyMs = latencyMs;
      this.lastHeartbeatAt = new Date().toISOString();

      if (!res.ok) {
        throw new Error(`SaaS Control Plane returned HTTP ${res.status}`);
      }

      const data = (await res.json()) as InboundHeartbeatResponse;
      this.tunnelStatus = 'CONNECTED';

      let executedCount = 0;
      if (data.commands && Array.isArray(data.commands) && this.onCommandCallback) {
        for (const cmd of data.commands) {
          try {
            await this.onCommandCallback(cmd);
            executedCount++;
          } catch (cmdErr) {
            console.error(`[Signet Hybrid Edge] Failed to execute cloud command ${cmd.id}:`, cmdErr);
          }
        }
      }

      if (data.bundleUpdated && data.newBundleVersion) {
        this.cachedBundleVersion = data.newBundleVersion;
      }

      return {
        success: true,
        tunnelStatus: 'CONNECTED',
        latencyMs,
        commandsExecuted: executedCount,
        syncedMetadataCount: digestsToSync.length
      };
    } catch (err: any) {
      // Re-queue unsent digests for offline replay
      if (digestsToSync.length > 0) {
        this.queuedDigests = [...digestsToSync, ...this.queuedDigests];
      }

      const latencyMs = Date.now() - start;
      this.lastSyncLatencyMs = latencyMs;
      this.lastHeartbeatAt = new Date().toISOString();

      // In hybrid on-prem architectures, if cloud is unreachable, we maintain local offline enforcement
      this.tunnelStatus = 'DEGRADED';

      return {
        success: false,
        tunnelStatus: 'DEGRADED',
        latencyMs,
        commandsExecuted: 0,
        syncedMetadataCount: 0,
        error: err.name === 'AbortError' ? 'Outbound tunnel timeout' : err.message
      };
    }
  }

  getConfig(): SignetHybridEdgeConfig {
    return {
      enabled: this.enabled,
      saasEndpoint: this.saasEndpoint,
      edgeRunnerId: this.edgeRunnerId,
      hostname: os.hostname(),
      tenantId: this.tenantId,
      tunnelStatus: this.tunnelStatus,
      heartbeatIntervalSec: this.heartbeatIntervalSec,
      lastHeartbeatAt: this.lastHeartbeatAt,
      lastSyncLatencyMs: this.lastSyncLatencyMs,
      cachedBundleVersion: this.cachedBundleVersion,
      queuedMetadataCount: this.queuedDigests.length,
      dataResidencyEnforced: true // Always true: customer data never leaves private network
    };
  }

  updateConfig(config: {
    saasEndpoint?: string;
    tenantId?: string;
    heartbeatIntervalSec?: number;
    enabled?: boolean;
  }) {
    if (config.saasEndpoint !== undefined) {
      this.saasEndpoint = config.saasEndpoint.replace(/\/+$/, '');
    }
    if (config.tenantId !== undefined) {
      this.tenantId = config.tenantId;
    }
    if (config.heartbeatIntervalSec !== undefined) {
      this.heartbeatIntervalSec = config.heartbeatIntervalSec;
      if (this.timer) {
        this.stop();
        this.start();
      }
    }
    if (config.enabled !== undefined) {
      this.enabled = config.enabled;
      if (!this.enabled) this.stop();
      else this.start();
    }
  }
}

