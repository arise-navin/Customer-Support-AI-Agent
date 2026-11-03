import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bot,
  Wrench,
  Ban,
  Shield,
  Play,
  RefreshCw,
  AlertTriangle,
  Key,
  Copy,
  Check,
  Skull,
  Activity,
  Eye,
  EyeOff,
  Trash2,
  Lock,
  Clock,
  Sparkles,
  ExternalLink,
  CheckCircle2
} from 'lucide-react';
import { apiRequest } from '../lib/api';

export function Agents() {
  const queryClient = useQueryClient();

  // Modals & Active Selections
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [trackingAgentId, setTrackingAgentId] = useState<string | null>(null);
  const [killModalAgent, setKillModalAgent] = useState<any | null>(null);
  const [killReason, setKillReason] = useState('Suspected policy violation or administrative override');
  const [credentialsModalData, setCredentialsModalData] = useState<{
    agentId: string;
    agentName: string;
    clientId: string;
    clientSecret: string;
  } | null>(null);

  // Test Execution State
  const [testPrompt, setTestPrompt] = useState('Where is my order ORD-1005?');
  const [testClientId, setTestClientId] = useState('');
  const [testClientSecret, setTestClientSecret] = useState('');
  const [executionResult, setExecutionResult] = useState<any | null>(null);

  // Copy state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showSecretInModal, setShowSecretInModal] = useState(false);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // 1. Fetch Agents
  const { data: agents = [], isLoading, refetch } = useQuery({
    queryKey: ['agents-list'],
    queryFn: async () => {
      return await apiRequest<any[]>('/agents');
    }
  });

  // 2. Fetch Tracking Telemetry for Selected Agent
  const { data: trackingData, isLoading: isTrackingLoading } = useQuery({
    queryKey: ['agent-tracking', trackingAgentId],
    queryFn: async () => {
      if (!trackingAgentId) return null;
      return await apiRequest<any>(`/agents/${trackingAgentId}/track`);
    },
    enabled: !!trackingAgentId
  });

  // 3. Generate Credentials Mutation
  const generateCredentialsMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest<any>(`/agents/${id}/credentials`, {
        method: 'POST'
      });
    },
    onSuccess: (data) => {
      setCredentialsModalData(data);
      setShowSecretInModal(true);
      queryClient.invalidateQueries({ queryKey: ['agents-list'] });
      queryClient.invalidateQueries({ queryKey: ['agent-tracking', data.agentId] });
    }
  });

  // 4. Revoke Credentials Mutation
  const revokeCredentialsMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest<any>(`/agents/${id}/credentials`, {
        method: 'DELETE'
      });
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['agents-list'] });
      queryClient.invalidateQueries({ queryKey: ['agent-tracking', id] });
      setCredentialsModalData(null);
    }
  });

  // 5. Emergency Kill Mutation
  const killAgentMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return await apiRequest(`/agents/${id}/kill`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
    },
    onSuccess: () => {
      setKillModalAgent(null);
      queryClient.invalidateQueries({ queryKey: ['agents-list'] });
      queryClient.invalidateQueries({ queryKey: ['agent-tracking'] });
    }
  });

  // 6. Quarantine Mutation
  const quarantineAgentMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      return await apiRequest(`/agents/${id}/quarantine`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason || 'Placed under quarantine' })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents-list'] });
      queryClient.invalidateQueries({ queryKey: ['agent-tracking'] });
    }
  });

  // 7. Activate Mutation
  const activateAgentMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/agents/${id}/activate`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents-list'] });
      queryClient.invalidateQueries({ queryKey: ['agent-tracking'] });
    }
  });

  // 8. Run Agent Mutation
  const runAgentMutation = useMutation({
    mutationFn: async ({
      id,
      message,
      clientId,
      clientSecret
    }: {
      id: string;
      message: string;
      clientId?: string;
      clientSecret?: string;
    }) => {
      return await apiRequest<any>(`/agents/${id}/run`, {
        method: 'POST',
        body: JSON.stringify({
          message,
          clientId: clientId || undefined,
          clientSecret: clientSecret || undefined
        })
      });
    },
    onSuccess: (data) => {
      setExecutionResult(data);
      queryClient.invalidateQueries({ queryKey: ['agents-list'] });
      queryClient.invalidateQueries({ queryKey: ['agent-tracking'] });
    },
    onError: (err: any) => {
      setExecutionResult({ error: err.message });
    }
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Bot className="w-6 h-6 text-primary" />
            AI Agent Governance, Tracking & Kill Switch Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage Client IDs, rotate cryptographic secrets, track real-time telemetry, and execute emergency kill switch controls across {agents.length} autonomous support agents.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-card border border-border text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Agents
          </button>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-6 animate-pulse space-y-4">
              <div className="h-6 bg-muted rounded w-48"></div>
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-20 bg-muted rounded w-full"></div>
            </div>
          ))
        ) : (
          agents.map((agent: any) => {
            const isKilled = agent.status === 'KILLED';
            const isQuarantined = agent.status === 'QUARANTINED';
            const isPaused = agent.status === 'PAUSED';
            const isActive = agent.status === 'ACTIVE';

            return (
              <div
                key={agent.id}
                className={`rounded-2xl border bg-card p-6 shadow-sm flex flex-col justify-between transition-all ${
                  isKilled
                    ? 'border-rose-500/50 bg-rose-500/[0.02]'
                    : isQuarantined
                    ? 'border-amber-500/50 bg-amber-500/[0.02]'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <div>
                  {/* Top Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold ${
                          isKilled
                            ? 'bg-rose-500/10 text-rose-500'
                            : isQuarantined
                            ? 'bg-amber-500/10 text-amber-500'
                            : 'bg-primary/10 text-primary'
                        }`}
                      >
                        {isKilled ? <Skull className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base text-foreground">{agent.name}</h3>
                        </div>
                        <div className="text-xs font-mono text-muted-foreground">{agent.id}</div>
                      </div>
                    </div>

                    {/* Status Badges */}
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        Tier {agent.riskTier}
                      </span>
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                          isActive
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                            : isQuarantined
                            ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                            : isPaused
                            ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                            : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                        }`}
                      >
                        {isKilled && <Skull className="w-3 h-3" />}
                        {agent.status}
                      </span>
                    </div>
                  </div>

                  {/* Killed Alert Notice */}
                  {isKilled && (
                    <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-start gap-2.5">
                      <Ban className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">AGENT TERMINATED (KILL SWITCH ACTIVE)</span>
                        <span className="text-muted-foreground text-[11px]">
                          Reason: {agent.killedReason || 'Manual kill switch invoked'}
                        </span>
                        {agent.killedAt && (
                          <span className="text-muted-foreground text-[10px] block mt-0.5">
                            Terminated at: {new Date(agent.killedAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Quarantined Alert Notice */}
                  {isQuarantined && (
                    <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">AGENT QUARANTINED</span>
                        <span className="text-muted-foreground text-[11px]">
                          {agent.killedReason || 'Agent suspended due to security violation.'}
                        </span>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                    {agent.description}
                  </p>

                  {/* Client Credentials Card */}
                  <div className="mb-4 p-3.5 rounded-xl bg-secondary/50 border border-border space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                        <Lock className="w-3.5 h-3.5 text-primary" />
                        Client Credentials & Identity
                      </div>
                      <button
                        onClick={() => generateCredentialsMutation.mutate(agent.id)}
                        disabled={generateCredentialsMutation.isPending}
                        className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 disabled:opacity-50"
                      >
                        <Key className="w-3 h-3" />
                        {agent.clientId ? 'Rotate Credentials' : 'Create Client ID & Secret'}
                      </button>
                    </div>

                    {agent.clientId ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs bg-card p-2 rounded-lg border border-border">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground">Client ID:</span>
                            <span className="font-mono text-xs text-foreground truncate">{agent.clientId}</span>
                          </div>
                          <button
                            onClick={() => handleCopy(agent.clientId, `client-id-${agent.id}`)}
                            className="p-1 text-muted-foreground hover:text-foreground shrink-0"
                            title="Copy Client ID"
                          >
                            {copiedKey === `client-id-${agent.id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        <div className="flex items-center justify-between text-xs bg-card p-2 rounded-lg border border-border">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground">Secret:</span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {agent.clientSecretMasked || '••••••••••••••••••••••••'}
                            </span>
                          </div>
                          <button
                            onClick={() => revokeCredentialsMutation.mutate(agent.id)}
                            className="p-1 text-rose-500 hover:text-rose-600 shrink-0"
                            title="Revoke Credentials"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-muted-foreground italic flex items-center gap-1.5 py-1">
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                        No Client ID or Secret assigned. Click 'Create Client ID & Secret' to generate credentials.
                      </div>
                    )}
                  </div>

                  {/* Status Toggle & Metrics */}
                  <div className="grid grid-cols-4 gap-2 p-3 rounded-xl bg-secondary/30 border border-border text-xs mb-4">
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold">Model</span>
                      <span className="font-mono font-medium text-foreground text-[11px]">{agent.model}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold">Autonomy</span>
                      <span className="font-medium text-foreground text-[11px]">{agent.autonomyLevel}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold">Executions</span>
                      <span className="font-bold text-primary">{agent._count?.executions ?? 0}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold">Last Active</span>
                      <span className="font-medium text-muted-foreground text-[10px]">
                        {agent.lastActiveAt ? new Date(agent.lastActiveAt).toLocaleTimeString() : 'Never'}
                      </span>
                    </div>
                  </div>

                  {/* Permitted Tools */}
                  <div className="space-y-1.5 mb-4">
                    <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5 text-emerald-500" />
                      Permitted Tools ({agent.permissions?.length || 0})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {agent.permissions?.map((p: any) => (
                        <span
                          key={p.toolName}
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-secondary text-foreground"
                        >
                          {p.toolName}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Action Controls & Kill Switch */}
                <div className="pt-4 border-t border-border flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setSelectedAgentId(agent.id);
                        setTestClientId(agent.clientId || '');
                        setTestClientSecret('');
                        setExecutionResult(null);
                      }}
                      disabled={isKilled}
                      className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs flex items-center gap-1.5 hover:opacity-90 disabled:opacity-40"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Test Run
                    </button>

                    <button
                      onClick={() => setTrackingAgentId(agent.id)}
                      className="px-3 py-1.5 rounded-lg bg-secondary text-foreground font-semibold text-xs flex items-center gap-1.5 hover:bg-secondary/80 border border-border"
                    >
                      <Activity className="w-3.5 h-3.5 text-primary" />
                      Track & Logs
                    </button>
                  </div>

                  {/* Lifecycle & Kill Switch Controls */}
                  <div className="flex items-center gap-1.5">
                    {isActive && (
                      <>
                        <button
                          onClick={() => quarantineAgentMutation.mutate({ id: agent.id })}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 text-xs font-medium border border-amber-500/20"
                          title="Quarantine this agent"
                        >
                          Quarantine
                        </button>
                        <button
                          onClick={() => setKillModalAgent(agent)}
                          className="px-3 py-1.5 rounded-lg bg-rose-500 text-white hover:bg-rose-600 text-xs font-bold flex items-center gap-1 shadow-sm"
                          title="Trigger emergency kill switch"
                        >
                          <Skull className="w-3.5 h-3.5" />
                          Kill Agent
                        </button>
                      </>
                    )}

                    {(isKilled || isQuarantined || isPaused) && (
                      <button
                        onClick={() => activateAgentMutation.mutate(agent.id)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 flex items-center gap-1 shadow-sm"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Restore to Active
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ============================================================== */}
      {/* MODAL 1: NEW CREDENTIALS GENERATED                             */}
      {/* ============================================================== */}
      {credentialsModalData && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">Client Credentials Generated</h3>
                  <p className="text-xs text-muted-foreground">Agent: {credentialsModalData.agentId}</p>
                </div>
              </div>
              <button
                onClick={() => setCredentialsModalData(null)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Save Client Secret Now!</span>
                For security reasons, this secret cannot be viewed in full again once you close this window.
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Client ID
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={credentialsModalData.clientId}
                    className="w-full px-3 py-2 rounded-xl bg-secondary font-mono text-xs text-foreground border border-border"
                  />
                  <button
                    onClick={() => handleCopy(credentialsModalData.clientId, 'modal-client-id')}
                    className="p-2.5 rounded-xl bg-card border border-border text-foreground hover:bg-secondary shrink-0"
                    title="Copy Client ID"
                  >
                    {copiedKey === 'modal-client-id' ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Client Secret
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type={showSecretInModal ? 'text' : 'password'}
                    readOnly
                    value={credentialsModalData.clientSecret}
                    className="w-full px-3 py-2 rounded-xl bg-secondary font-mono text-xs text-foreground border border-border"
                  />
                  <button
                    onClick={() => setShowSecretInModal(!showSecretInModal)}
                    className="p-2.5 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground shrink-0"
                    title={showSecretInModal ? 'Hide secret' : 'Show secret'}
                  >
                    {showSecretInModal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleCopy(credentialsModalData.clientSecret, 'modal-client-secret')}
                    className="p-2.5 rounded-xl bg-card border border-border text-foreground hover:bg-secondary shrink-0"
                    title="Copy Client Secret"
                  >
                    {copiedKey === 'modal-client-secret' ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setCredentialsModalData(null)}
                className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90"
              >
                I Have Stored the Secret
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: EMERGENCY KILL SWITCH CONFIRMATION                   */}
      {/* ============================================================== */}
      {killModalAgent && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-rose-500/50 rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-500">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
                <Skull className="w-6 h-6 text-rose-500" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">Emergency Kill Switch</h3>
                <p className="text-xs text-muted-foreground font-mono">{killModalAgent.id}</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to terminate <strong className="text-foreground">{killModalAgent.name}</strong>? All future execution requests will be immediately rejected with HTTP 403 Forbidden.
            </p>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Kill Reason / Audit Note
              </label>
              <textarea
                value={killReason}
                onChange={(e) => setKillReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-xl bg-secondary/60 border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500/40"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setKillModalAgent(null)}
                className="px-4 py-2 rounded-xl bg-secondary text-foreground text-xs font-semibold hover:bg-secondary/80"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  killAgentMutation.mutate({
                    id: killModalAgent.id,
                    reason: killReason
                  })
                }
                disabled={killAgentMutation.isPending}
                className="px-4 py-2 rounded-xl bg-rose-500 text-white text-xs font-bold hover:bg-rose-600 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Skull className="w-3.5 h-3.5" />
                {killAgentMutation.isPending ? 'Killing Agent...' : 'Confirm Immediate Kill'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: TRACKING & TELEMETRY AUDIT TRAIL                     */}
      {/* ============================================================== */}
      {trackingAgentId && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[85vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="p-6 border-b border-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">
                    Agent Tracking & Telemetry: {trackingData?.agent?.name || trackingAgentId}
                  </h3>
                  <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                    <span className="font-mono">{trackingAgentId}</span>
                    <span>•</span>
                    <span className="font-semibold text-primary">{trackingData?.agent?.status || 'ACTIVE'}</span>
                    {trackingData?.agent?.clientId && (
                      <>
                        <span>•</span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          Client ID: {trackingData.agent.clientId}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setTrackingAgentId(null)}
                className="text-muted-foreground hover:text-foreground p-1 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {isTrackingLoading ? (
                <div className="py-12 text-center text-xs text-muted-foreground">Loading telemetry metrics...</div>
              ) : trackingData ? (
                <>
                  {/* Telemetry Stat Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-4 rounded-xl bg-secondary/40 border border-border">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                        Total Invocations
                      </span>
                      <span className="text-xl font-bold text-foreground">
                        {trackingData.telemetry?.totalExecutions ?? 0}
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-secondary/40 border border-border">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                        Allowed / Blocked
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xl font-bold text-emerald-500">
                          {trackingData.telemetry?.allowedCount ?? 0}
                        </span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-xl font-bold text-rose-500">
                          {trackingData.telemetry?.blockedCount ?? 0}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-secondary/40 border border-border">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                        Avg Latency
                      </span>
                      <span className="text-xl font-bold text-foreground">
                        {trackingData.telemetry?.avgLatencyMs ?? 0}ms
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-secondary/40 border border-border">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                        Total Tool Calls
                      </span>
                      <span className="text-xl font-bold text-primary">
                        {trackingData.telemetry?.totalToolCalls ?? 0}
                      </span>
                    </div>
                  </div>

                  {/* Audit Trail Table */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-foreground flex items-center justify-between">
                      <span>Recent Execution Audit Trail ({trackingData.auditTrail?.length || 0})</span>
                      <span className="text-[10px] text-muted-foreground">Most recent executions first</span>
                    </div>

                    {trackingData.auditTrail && trackingData.auditTrail.length > 0 ? (
                      <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
                        {trackingData.auditTrail.map((item: any) => (
                          <div key={item.id} className="p-3 hover:bg-secondary/20 transition-colors text-xs space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {new Date(item.timestamp).toLocaleString()}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-muted-foreground">
                                  {item.durationMs}ms
                                </span>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    item.governanceDecision === 'ALLOW'
                                      ? 'bg-emerald-500/10 text-emerald-500'
                                      : 'bg-rose-500/10 text-rose-500'
                                  }`}
                                >
                                  {item.governanceDecision}
                                </span>
                              </div>
                            </div>

                            <div>
                              <span className="text-[10px] uppercase font-bold text-muted-foreground mr-1.5">User:</span>
                              <span className="text-foreground">{item.promptPreview}</span>
                            </div>

                            <div>
                              <span className="text-[10px] uppercase font-bold text-muted-foreground mr-1.5">Agent:</span>
                              <span className="text-muted-foreground">{item.responsePreview}</span>
                            </div>

                            {item.tools && item.tools.length > 0 && (
                              <div className="flex items-center gap-1.5 pt-1">
                                <span className="text-[10px] text-muted-foreground font-semibold">Tools used:</span>
                                {item.tools.map((t: string, idx: number) => (
                                  <span key={idx} className="text-[10px] font-mono bg-secondary px-1.5 py-0.5 rounded text-foreground">
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                        No recorded executions for this agent yet.
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: TEST EXECUTION WITH OPTIONAL CREDENTIALS              */}
      {/* ============================================================== */}
      {selectedAgentId && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-card border border-border rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-foreground">Test In-Process Agent Execution</h3>
                <p className="text-xs text-muted-foreground font-mono">Agent: {selectedAgentId}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedAgentId(null);
                  setExecutionResult(null);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Customer Message</label>
                <input
                  type="text"
                  value={testPrompt}
                  onChange={(e) => setTestPrompt(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-secondary/50 border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
                />
              </div>

              {/* Optional Client Credentials for verification test */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-secondary/30 border border-border text-xs">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">
                    Client ID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="agt_cli_..."
                    value={testClientId}
                    onChange={(e) => setTestClientId(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-card border border-border font-mono text-xs text-foreground focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">
                    Client Secret (Optional)
                  </label>
                  <input
                    type="password"
                    placeholder="agt_sec_..."
                    value={testClientSecret}
                    onChange={(e) => setTestClientSecret(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-card border border-border font-mono text-xs text-foreground focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() =>
                    runAgentMutation.mutate({
                      id: selectedAgentId,
                      message: testPrompt,
                      clientId: testClientId || undefined,
                      clientSecret: testClientSecret || undefined
                    })
                  }
                  disabled={runAgentMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50"
                >
                  <Play className={`w-3.5 h-3.5 ${runAgentMutation.isPending ? 'animate-spin' : ''}`} />
                  {runAgentMutation.isPending ? 'Executing with Ollama beam:cloud...' : 'Dispatch Request'}
                </button>
              </div>

              {executionResult && (
                <div className="p-4 rounded-xl bg-secondary/30 border border-border text-xs space-y-2 max-h-[40vh] overflow-y-auto">
                  {executionResult.error ? (
                    <div className="text-rose-500 font-semibold p-2 bg-rose-500/10 rounded-lg border border-rose-500/20">
                      {executionResult.error}
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between text-muted-foreground border-b border-border pb-1.5 text-[11px]">
                        <span>Agent: {executionResult.agentName}</span>
                        <span>Latency: {executionResult.durationMs}ms</span>
                      </div>
                      <div className="text-foreground leading-relaxed whitespace-pre-wrap">
                        {executionResult.response}
                      </div>
                      {executionResult.toolCallsExecuted && executionResult.toolCallsExecuted.length > 0 && (
                        <div className="pt-2 border-t border-border">
                          <span className="font-bold text-[10px] text-muted-foreground block uppercase mb-1">
                            Executed Tools
                          </span>
                          {executionResult.toolCallsExecuted.map((tc: any, i: number) => (
                            <div key={i} className="p-2 rounded bg-card text-[11px] font-mono flex justify-between">
                              <span>{tc.name}</span>
                              <span className="text-emerald-500 font-bold">{tc.status}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
