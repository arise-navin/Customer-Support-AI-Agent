import { ExecutionMode, SignetGatewayConfig, SignetAgentCertificate, SignetHybridEdgeConfig } from '@signet/shared';
import { SignetAdapter, DEFAULT_AGENT_CERTIFICATES } from './types.js';
import { DirectOllamaAdapter } from './adapters/directOllamaAdapter.js';
import { MockSignetAdapter } from './adapters/mockSignetAdapter.js';
import { RealSignetAdapter } from './adapters/realSignetAdapter.js';
import { HybridEdgeAdapter } from './adapters/hybridEdgeAdapter.js';
import { HybridEdgeRunnerService } from './hybrid/hybridEdgeRunner.js';
import { SignetGatewayClient } from './clients/gatewayClient.js';

export class SignetAdapterManager {
  private activeMode: ExecutionMode;
  private gatewayClient: SignetGatewayClient;
  private directAdapter: DirectOllamaAdapter;
  private mockAdapter: MockSignetAdapter;
  private realAdapter: RealSignetAdapter;
  private hybridAdapter: HybridEdgeAdapter;
  private hybridRunner: HybridEdgeRunnerService;
  private certificates: Record<string, SignetAgentCertificate>;
  private enforcementRequired: boolean;

  constructor() {
    this.activeMode = (process.env.AI_EXECUTION_MODE as ExecutionMode) || 'DIRECT_OLLAMA';
    this.enforcementRequired = process.env.SIGNET_ENFORCEMENT_REQUIRED !== 'false';

    this.gatewayClient = new SignetGatewayClient({
      gatewayUrl: process.env.SIGNET_GATEWAY_URL || 'http://localhost:8080',
      tenantId: process.env.SIGNET_TENANT_ID || 'tenant-support-lab'
    });

    this.certificates = JSON.parse(JSON.stringify(DEFAULT_AGENT_CERTIFICATES));
    this.directAdapter = new DirectOllamaAdapter();
    this.mockAdapter = new MockSignetAdapter(this.certificates);
    this.realAdapter = new RealSignetAdapter(this.gatewayClient);

    this.hybridRunner = new HybridEdgeRunnerService({
      saasEndpoint: process.env.SIGNET_HYBRID_SAAS_URL || 'https://cloud.signet.techsnitch.com',
      tenantId: process.env.SIGNET_TENANT_ID || 'tenant-support-lab-01',
      heartbeatIntervalSec: parseInt(process.env.SIGNET_HYBRID_HEARTBEAT_SEC || '15', 10),
      enabled: process.env.SIGNET_HYBRID_EDGE_ENABLED !== 'false'
    });

    this.hybridAdapter = new HybridEdgeAdapter(this.hybridRunner, this.certificates);

    // Wire cloud commands to local certificate and state manager
    this.hybridRunner.setCommandCallback(async (cmd) => {
      if (cmd.action === 'KILL_AGENT' && cmd.agentId) {
        this.updateCertificateStatus(cmd.agentId, 'KILLED', cmd.reason || 'Cloud kill switch signal');
      } else if (cmd.action === 'QUARANTINE_AGENT' && cmd.agentId) {
        this.updateCertificateStatus(cmd.agentId, 'QUARANTINED', cmd.reason || 'Cloud quarantine signal');
      } else if (cmd.action === 'ACTIVATE_AGENT' && cmd.agentId) {
        this.updateCertificateStatus(cmd.agentId, 'ACTIVE');
      }
    });

    if (this.activeMode === 'SIGNET_HYBRID_EDGE') {
      this.hybridRunner.start();
    }
  }

  getMode(): ExecutionMode {
    return this.activeMode;
  }

  setMode(mode: ExecutionMode) {
    this.activeMode = mode;
    if (mode === 'SIGNET_HYBRID_EDGE') {
      this.hybridRunner.start();
    }
  }

  getAdapter(mode?: ExecutionMode): SignetAdapter {
    const selectedMode = mode || this.activeMode;
    switch (selectedMode) {
      case 'DIRECT_OLLAMA':
        return this.directAdapter;
      case 'SIGNET_MOCK':
        return this.mockAdapter;
      case 'SIGNET_REAL':
        return this.realAdapter;
      case 'SIGNET_HYBRID_EDGE':
        return this.hybridAdapter;
      default:
        return this.directAdapter;
    }
  }

  getDirectAdapter(): DirectOllamaAdapter {
    return this.directAdapter;
  }

  getMockAdapter(): MockSignetAdapter {
    return this.mockAdapter;
  }

  getRealAdapter(): RealSignetAdapter {
    return this.realAdapter;
  }

  getHybridAdapter(): HybridEdgeAdapter {
    return this.hybridAdapter;
  }

  getHybridRunner(): HybridEdgeRunnerService {
    return this.hybridRunner;
  }

  getGatewayClient(): SignetGatewayClient {
    return this.gatewayClient;
  }

  getCertificates(): Record<string, SignetAgentCertificate> {
    return this.certificates;
  }

  updateCertificateStatus(agentId: string, status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'QUARANTINED' | 'KILLED', reason?: string) {
    if (this.certificates[agentId]) {
      this.certificates[agentId].validity.status = status;
      if (reason) this.certificates[agentId].validity.revocationReason = reason;
    }
    this.mockAdapter.setCertificateStatus(agentId, status, reason);
    this.hybridAdapter.setCertificateStatus(agentId, status, reason);
  }

  async checkGatewayConnection(): Promise<{ isConnected: boolean; latencyMs?: number; error?: string }> {
    try {
      const res = await this.gatewayClient.checkHealth();
      return { isConnected: true, latencyMs: res.latencyMs };
    } catch (err: any) {
      return { isConnected: false, error: err.message };
    }
  }

  async getFullConfig(): Promise<SignetGatewayConfig & { hybridEdge?: SignetHybridEdgeConfig }> {
    const gw = this.gatewayClient.getConfig();
    let isConnected = false;
    let latencyMs: number | undefined;
    let lastError: string | null = null;

    if (this.activeMode === 'SIGNET_REAL') {
      try {
        const probe = await this.gatewayClient.checkHealth();
        isConnected = true;
        latencyMs = probe.latencyMs;
      } catch (err: any) {
        isConnected = false;
        lastError = err.message;
      }
    } else if (this.activeMode === 'SIGNET_MOCK') {
      isConnected = true;
      latencyMs = 4;
    } else if (this.activeMode === 'SIGNET_HYBRID_EDGE') {
      const edgeConf = this.hybridRunner.getConfig();
      isConnected = edgeConf.tunnelStatus === 'CONNECTED';
      latencyMs = edgeConf.lastSyncLatencyMs || 5;
    }

    return {
      executionMode: this.activeMode,
      gatewayUrl: gw.gatewayUrl,
      tenantId: gw.tenantId,
      enforcementRequired: this.enforcementRequired,
      isConnected,
      lastPingMs: latencyMs,
      lastError,
      agentCertificates: Object.values(this.certificates),
      hybridEdge: this.hybridRunner.getConfig()
    };
  }

  updateConfig(config: {
    executionMode?: ExecutionMode;
    gatewayUrl?: string;
    tenantId?: string;
    enforcementRequired?: boolean;
    hybridEdge?: {
      saasEndpoint?: string;
      heartbeatIntervalSec?: number;
      enabled?: boolean;
    };
  }) {
    if (config.executionMode) this.setMode(config.executionMode);
    if (config.enforcementRequired !== undefined) this.enforcementRequired = config.enforcementRequired;
    if (config.hybridEdge) this.hybridRunner.updateConfig(config.hybridEdge);
    this.gatewayClient.updateConfig({
      gatewayUrl: config.gatewayUrl,
      tenantId: config.tenantId
    });
  }
}

export const signetAdapterManager = new SignetAdapterManager();
