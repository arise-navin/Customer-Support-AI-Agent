import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck,
  Server,
  KeyRound,
  Radio,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Cpu,
  Layers,
  Activity,
  Zap,
  Lock,
  Globe,
  Network,
  ArrowUpRight,
  HardDrive,
  ShieldAlert,
  Check
} from 'lucide-react';
import { apiRequest } from '../lib/api';

interface SignetCertificate {
  agentId: string;
  workloadIdentity: string;
  certificateId: string;
  riskTier: string;
  autonomyLevel: string;
  allowedModel: string;
  allowedTools: string[];
  dataClasses: string[];
  limits: {
    maxRequestsPerMinute: number;
    maxTokensPerTurn: number;
  };
  validity: {
    issuedAt: string;
    expiresAt: string;
    status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'QUARANTINED' | 'KILLED';
    revocationReason?: string;
  };
}

interface SignetHybridEdgeConfig {
  enabled: boolean;
  saasEndpoint: string;
  edgeRunnerId: string;
  hostname: string;
  tenantId: string;
  tunnelStatus: 'CONNECTED' | 'DISCONNECTED' | 'DEGRADED';
  heartbeatIntervalSec: number;
  lastHeartbeatAt?: string;
  lastSyncLatencyMs?: number;
  cachedBundleVersion: string;
  queuedMetadataCount: number;
  dataResidencyEnforced: boolean;
}

interface SignetConfigData {
  executionMode: 'DIRECT_OLLAMA' | 'SIGNET_MOCK' | 'SIGNET_REAL' | 'SIGNET_HYBRID_EDGE';
  gatewayUrl: string;
  tenantId: string;
  enforcementRequired: boolean;
  isConnected: boolean;
  lastPingMs?: number;
  lastError?: string | null;
  agentCertificates: SignetCertificate[];
  hybridEdge?: Partial<SignetHybridEdgeConfig>;
}

export function SignetSettings() {
  const queryClient = useQueryClient();
  const [gatewayUrl, setGatewayUrl] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [saasEndpoint, setSaasEndpoint] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const { data: config, isLoading, refetch, isFetching } = useQuery<SignetConfigData>({
    queryKey: ['signet-config'],
    queryFn: async () => {
      const data = await apiRequest<SignetConfigData>('/signet/config');
      if (!gatewayUrl) setGatewayUrl(data.gatewayUrl);
      if (!tenantId) setTenantId(data.tenantId);
      if (!saasEndpoint && data.hybridEdge?.saasEndpoint) {
        setSaasEndpoint(data.hybridEdge.saasEndpoint);
      }
      return data;
    }
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (payload: Partial<SignetConfigData>) => {
      return await apiRequest<SignetConfigData>('/signet/config', {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signet-config'] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  });

  const updateCertStatusMutation = useMutation({
    mutationFn: async ({ agentId, status, reason }: { agentId: string; status: string; reason?: string }) => {
      return await apiRequest(`/signet/certificates/${agentId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reason })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signet-config'] });
    }
  });

  const manualSyncMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest<any>('/signet/hybrid/sync', {
        method: 'POST'
      });
    },
    onSuccess: (data) => {
      setSyncStatus(`Synced! Status: ${data.tunnelStatus} (${data.latencyMs}ms)`);
      setTimeout(() => setSyncStatus(null), 4000);
      queryClient.invalidateQueries({ queryKey: ['signet-config'] });
    },
    onError: (err: any) => {
      setSyncStatus(`Sync error: ${err.message}`);
      setTimeout(() => setSyncStatus(null), 4000);
    }
  });

  const handleModeChange = (mode: 'DIRECT_OLLAMA' | 'SIGNET_MOCK' | 'SIGNET_REAL' | 'SIGNET_HYBRID_EDGE') => {
    updateConfigMutation.mutate({ executionMode: mode });
  };

  const handleSaveConnection = (e: React.FormEvent) => {
    e.preventDefault();
    updateConfigMutation.mutate({
      gatewayUrl,
      tenantId,
      hybridEdge: {
        saasEndpoint: saasEndpoint || undefined
      }
    });
  };

  const isHybrid = config?.executionMode === 'SIGNET_HYBRID_EDGE';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-primary" />
            Signet AI Governance & Runtime Architecture
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure gateway enforcement modes, cryptographic certificates, fail-closed rules, and MID-Server style Hybrid Edge tunnels.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-card border border-border text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh Status
          </button>
        </div>
      </div>

      {/* Execution Mode Selector (4 Options) */}
      <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Radio className="w-4 h-4 text-primary" />
            Execution Architecture & Governance Modes
          </h2>
          <span className="text-xs font-mono font-medium text-muted-foreground">
            Current: <strong className="text-primary">{config?.executionMode}</strong>
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Select how agent model invocations, tool calls, and data privacy policies are governed.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. DIRECT_OLLAMA */}
          <button
            onClick={() => handleModeChange('DIRECT_OLLAMA')}
            className={`p-4 rounded-xl border text-left transition-all ${
              config?.executionMode === 'DIRECT_OLLAMA'
                ? 'bg-primary/5 border-primary shadow-sm'
                : 'bg-secondary/30 border-border hover:bg-secondary/60'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-primary" />
                DIRECT_OLLAMA
              </span>
              {config?.executionMode === 'DIRECT_OLLAMA' && (
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Direct connection to local Ollama. Standalone baseline without governance overhead.
            </p>
            <div className="mt-3 text-[10px] font-mono px-2 py-0.5 rounded bg-secondary text-muted-foreground w-fit">
              Baseline Mode
            </div>
          </button>

          {/* 2. SIGNET_MOCK */}
          <button
            onClick={() => handleModeChange('SIGNET_MOCK')}
            className={`p-4 rounded-xl border text-left transition-all ${
              config?.executionMode === 'SIGNET_MOCK'
                ? 'bg-amber-500/10 border-amber-500/50 shadow-sm'
                : 'bg-secondary/30 border-border hover:bg-secondary/60'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-500" />
                SIGNET_MOCK
              </span>
              {config?.executionMode === 'SIGNET_MOCK' && (
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-500/20 text-amber-600 font-bold">
                  SIMULATED
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Deterministic offline simulation. Evaluates certificates, DLP patterns, and risk tiers locally.
            </p>
            <div className="mt-3 text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 w-fit">
              Marked SIMULATED
            </div>
          </button>

          {/* 3. SIGNET_REAL */}
          <button
            onClick={() => handleModeChange('SIGNET_REAL')}
            className={`p-4 rounded-xl border text-left transition-all ${
              config?.executionMode === 'SIGNET_REAL'
                ? 'bg-indigo-500/10 border-indigo-500/50 shadow-sm'
                : 'bg-secondary/30 border-border hover:bg-secondary/60'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-indigo-500" />
                SIGNET_REAL
              </span>
              {config?.executionMode === 'SIGNET_REAL' && (
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Proxies traffic through live Signet Gateway. Strictly fails closed on gateway outage.
            </p>
            <div className="mt-3 text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-500 w-fit">
              Fail-Closed Enforced
            </div>
          </button>

          {/* 4. SIGNET_HYBRID_EDGE (MID SERVER STYLE) */}
          <button
            onClick={() => handleModeChange('SIGNET_HYBRID_EDGE')}
            className={`p-4 rounded-xl border text-left transition-all ${
              config?.executionMode === 'SIGNET_HYBRID_EDGE'
                ? 'bg-emerald-500/10 border-emerald-500/50 shadow-sm ring-1 ring-emerald-500/20'
                : 'bg-secondary/30 border-border hover:bg-secondary/60'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                <Network className="w-4 h-4 text-emerald-500" />
                SIGNET_HYBRID_EDGE
              </span>
              {config?.executionMode === 'SIGNET_HYBRID_EDGE' && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              MID Server style outbound tunnel. 0 inbound ports. Data never leaves on-prem; local DLP & Ollama.
            </p>
            <div className="mt-3 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold w-fit">
              D5 Data Never Leaves
            </div>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SIGNET HYBRID EDGE CONTROL PANEL (MID SERVER STYLE)             */}
      {/* ============================================================== */}
      <div className={`p-6 rounded-2xl border transition-all ${
        isHybrid ? 'bg-card border-emerald-500/40 shadow-sm' : 'bg-card/60 border-border'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-foreground">Signet Hybrid Edge Runner (MID Server Style)</h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  Blueprint Section 16.3
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Runs inside your private network. Initiates outbound mTLS heartbeats to Signet Cloud. Never opens inbound ports.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => manualSyncMutation.mutate()}
              disabled={manualSyncMutation.isPending}
              className="px-3.5 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold flex items-center gap-1.5 border border-border"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${manualSyncMutation.isPending ? 'animate-spin' : ''}`} />
              {manualSyncMutation.isPending ? 'Syncing...' : 'Trigger Outbound Sync'}
            </button>
            {syncStatus && (
              <span className="text-xs font-mono text-primary animate-in fade-in">{syncStatus}</span>
            )}
          </div>
        </div>

        {/* Status Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="p-3.5 rounded-xl bg-secondary/40 border border-border">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">Tunnel Status</span>
            <span className="text-xs font-bold font-mono text-emerald-500 flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              OUTBOUND ONLY (ACTIVE)
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-secondary/40 border border-border">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">Inbound Ports Open</span>
            <span className="text-xs font-bold font-mono text-foreground mt-0.5 block">
              0 Ports (Strictly Isolated)
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-secondary/40 border border-border">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">Queued Metadata</span>
            <span className="text-xs font-bold font-mono text-primary mt-0.5 block">
              {config?.hybridEdge?.queuedMetadataCount ?? 0} records
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-secondary/40 border border-border">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">Edge Runner ID</span>
            <span className="text-[11px] font-mono text-muted-foreground truncate block mt-0.5" title={config?.hybridEdge?.edgeRunnerId}>
              {config?.hybridEdge?.edgeRunnerId || 'edge_runner_local'}
            </span>
          </div>
        </div>

        {/* Data Privacy Checklist */}
        <div className="p-4 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/20 text-xs space-y-2">
          <span className="font-bold text-foreground text-[11px] flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Signet D5 Guarantee: Customer Content Stays On-Premise
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span><strong>Prompts & Responses:</strong> 100% on-premise</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span><strong>Local DLP Engine:</strong> PII/Cards masked locally</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span><strong>Offline Tolerant:</strong> Enforces with cached bundle</span>
            </div>
          </div>
        </div>
      </div>

      {/* Gateway & Cloud Connection Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Connection Form */}
        <div className="p-5 rounded-2xl bg-card border border-border shadow-sm lg:col-span-2">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
            <Server className="w-4 h-4 text-primary" />
            Gateway & SaaS Cloud Parameters
          </h2>
          <form onSubmit={handleSaveConnection} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  SIGNET_GATEWAY_URL (Local / Real Gateway)
                </label>
                <input
                  type="text"
                  value={gatewayUrl}
                  onChange={(e) => setGatewayUrl(e.target.value)}
                  placeholder="http://localhost:8080"
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-secondary/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  SIGNET_TENANT_ID
                </label>
                <input
                  type="text"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder="tenant-support-lab-01"
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-secondary/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  SIGNET_HYBRID_SAAS_URL (Cloud Control Plane Outbound Target)
                </label>
                <input
                  type="text"
                  value={saasEndpoint}
                  onChange={(e) => setSaasEndpoint(e.target.value)}
                  placeholder="https://cloud.signet.techsnitch.com"
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-secondary/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-muted-foreground">
                Config changes persist across backend restarts in <code className="text-primary font-mono">.env</code>.
              </span>
              <button
                type="submit"
                disabled={updateConfigMutation.isPending}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
              >
                {saveSuccess ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Saved!
                  </>
                ) : (
                  'Save & Apply'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Live Status Card */}
        <div className="p-5 rounded-2xl bg-card border border-border shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-primary" />
              Live Gateway Health
            </h2>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Gateway Reachability:</span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    config?.isConnected
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : 'bg-red-500/10 text-red-500'
                  }`}
                >
                  {config?.isConnected ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      CONNECTED
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3 h-3" />
                      OFFLINE
                    </>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Ping / Sync Latency:</span>
                <span className="text-xs font-mono text-foreground font-semibold">
                  {config?.lastPingMs !== undefined ? `${config.lastPingMs}ms` : '—'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Fail-Closed Enforcement:</span>
                <span className="text-xs font-semibold text-foreground">
                  {config?.enforcementRequired ? 'STRICT' : 'PERMISSIVE'}
                </span>
              </div>

              {config?.lastError && (
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[11px]">
                  <strong>Error:</strong> {config.lastError}
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-border text-[11px] text-muted-foreground">
            {config?.executionMode === 'SIGNET_REAL' && (
              <span className="text-amber-500 flex items-center gap-1 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                Zero-fallback rule active: Gateway errors reject inference.
              </span>
            )}
            {config?.executionMode === 'SIGNET_HYBRID_EDGE' && (
              <span className="text-emerald-500 flex items-center gap-1 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                Hybrid Edge active: Outbound polling to Cloud SaaS.
              </span>
            )}
            {config?.executionMode === 'SIGNET_MOCK' && (
              <span className="text-muted-foreground">Offline mock: suitable for local functional test runs.</span>
            )}
            {config?.executionMode === 'DIRECT_OLLAMA' && (
              <span className="text-muted-foreground">Direct Ollama: standalone mode without Signet gateway.</span>
            )}
          </div>
        </div>
      </div>

      {/* Cryptographic Agent Certificates Registry */}
      <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Cryptographic Agent Certificates (Seal Registry)
            </h2>
            <p className="text-xs text-muted-foreground">
              Pre-authorized certificate seals compiled into the runtime policy bundle.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            {config?.agentCertificates?.length || 0} Registered Seals
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {config?.agentCertificates?.map((cert) => {
            const isKill = cert.validity.status === 'KILLED';
            const isQuarantine = cert.validity.status === 'QUARANTINED';
            const isRevoked = cert.validity.status === 'REVOKED';
            const isExpired = cert.validity.status === 'EXPIRED';

            return (
              <div
                key={cert.agentId}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                  isKill
                    ? 'border-red-500/40 bg-red-500/[0.02]'
                    : isQuarantine
                    ? 'border-amber-500/40 bg-amber-500/[0.02]'
                    : isRevoked || isExpired
                    ? 'border-muted bg-muted/10 opacity-75'
                    : 'border-border bg-secondary/20 hover:border-primary/40'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="font-bold text-sm text-foreground block font-mono">
                        {cert.agentId}
                      </span>
                      <span className="text-[11px] font-mono text-muted-foreground block truncate max-w-[280px]">
                        {cert.workloadIdentity}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        cert.validity.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                          : isKill
                          ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                          : isQuarantine
                          ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {cert.validity.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3 p-2.5 rounded-lg bg-card/60 border border-border text-[11px] text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Cert ID:</span>
                      <span className="font-mono text-foreground truncate max-w-[100px]">{cert.certificateId}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Risk Tier:</span>
                      <span className="font-bold text-primary">{cert.riskTier}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Rate Limit:</span>
                      <span className="font-mono text-foreground">{cert.limits.maxRequestsPerMinute} req/min</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Allowed Model:</span>
                      <span className="font-mono text-primary">{cert.allowedModel}</span>
                    </div>
                  </div>

                  <div className="mt-3">
                    <span className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Permitted Tools ({cert.allowedTools.length}):
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {cert.allowedTools.map((tool) => (
                        <span
                          key={tool}
                          className="px-1.5 py-0.5 rounded bg-secondary text-[10px] font-mono text-foreground"
                        >
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* State simulation buttons */}
                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-1 text-[11px]">
                  <span className="text-muted-foreground text-[10px]">Simulate State:</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateCertStatusMutation.mutate({ agentId: cert.agentId, status: 'ACTIVE' })}
                      className="px-2 py-0.5 rounded bg-secondary hover:bg-emerald-500/10 hover:text-emerald-600 transition-colors"
                    >
                      Active
                    </button>
                    <button
                      onClick={() => updateCertStatusMutation.mutate({ agentId: cert.agentId, status: 'EXPIRED', reason: 'Simulated certificate expiration' })}
                      className="px-2 py-0.5 rounded bg-secondary hover:bg-amber-500/10 hover:text-amber-600 transition-colors"
                    >
                      Expire
                    </button>
                    <button
                      onClick={() => updateCertStatusMutation.mutate({ agentId: cert.agentId, status: 'REVOKED', reason: 'Simulated certificate revocation' })}
                      className="px-2 py-0.5 rounded bg-secondary hover:bg-red-500/10 hover:text-red-600 transition-colors"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
