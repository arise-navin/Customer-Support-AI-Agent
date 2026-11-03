import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Skull,
  ShieldCheck,
  AlertOctagon,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Activity,
  Zap,
  RotateCcw,
  AlertTriangle
} from 'lucide-react';
import { apiRequest } from '../lib/api';

interface AgentStatusItem {
  agentId: string;
  certificateId: string;
  riskTier: string;
  status: 'ACTIVE' | 'IDLE' | 'PAUSED' | 'QUARANTINED' | 'KILLED';
  certStatus: string;
  isTerminated: boolean;
  isQuarantined: boolean;
}

export function KillSwitchDashboard() {
  const queryClient = useQueryClient();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [actionToConfirm, setActionToConfirm] = useState<'KILL' | 'QUARANTINE' | 'RESTORE' | null>(null);
  const [lastKillMetrics, setLastKillMetrics] = useState<{
    agentId: string;
    action: string;
    propagationTimeMs: number;
    timestamp: string;
  } | null>(null);

  const { data: agents = [], isLoading, refetch, isFetching } = useQuery<AgentStatusItem[]>({
    queryKey: ['kill-switch-status'],
    queryFn: async () => {
      return await apiRequest<AgentStatusItem[]>('/signet/kill-switch-status');
    }
  });

  const killSwitchMutation = useMutation({
    mutationFn: async ({ agentId, action, reason }: { agentId: string; action: 'KILL' | 'QUARANTINE' | 'RESTORE'; reason?: string }) => {
      return await apiRequest<any>('/signet/kill-switch', {
        method: 'POST',
        body: JSON.stringify({ agentId, action, reason })
      });
    },
    onSuccess: (data) => {
      setLastKillMetrics({
        agentId: data.agentId,
        action: data.action,
        propagationTimeMs: data.measuredPropagationTimeMs,
        timestamp: data.timestamp
      });
      setSelectedAgent(null);
      setActionToConfirm(null);
      queryClient.invalidateQueries({ queryKey: ['kill-switch-status'] });
    }
  });

  const handleAction = (agentId: string, action: 'KILL' | 'QUARANTINE' | 'RESTORE') => {
    setSelectedAgent(agentId);
    setActionToConfirm(action);
  };

  const confirmAction = () => {
    if (selectedAgent && actionToConfirm) {
      killSwitchMutation.mutate({
        agentId: selectedAgent,
        action: actionToConfirm,
        reason: `Operator executed ${actionToConfirm} via Emergency Control Dashboard`
      });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-destructive/10 text-destructive border border-destructive/20">
              Critical Control
            </span>
            <span className="text-xs text-muted-foreground font-mono">Emergency Kill & Quarantine Switch</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5 mt-1">
            <AlertOctagon className="w-6 h-6 text-destructive" />
            Agent Kill Switch & Isolation Center
          </h1>
          <p className="text-sm text-muted-foreground">
            Instantly revoke agent credentials, sever database access, and measure real-time policy propagation latency.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card border border-border text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh Agent Fleet
        </button>
      </div>

      {/* Measured Latency Banner */}
      {lastKillMetrics && (
        <div className="p-4 rounded-2xl bg-secondary/80 border border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              lastKillMetrics.action === 'KILL' ? 'bg-red-500/20 text-red-600' : 'bg-emerald-500/20 text-emerald-600'
            }`}>
              {lastKillMetrics.action === 'KILL' ? <Skull className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">
                Action Broadcast: <span className="font-mono">{lastKillMetrics.action}</span> on <span className="font-mono">{lastKillMetrics.agentId}</span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                Enforcement verified at {new Date(lastKillMetrics.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] text-muted-foreground block">Actual Measured Propagation</span>
              <span className="font-mono text-base font-bold text-foreground">
                {lastKillMetrics.propagationTimeMs} ms
              </span>
            </div>
            <div className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-xs font-semibold">
              Acknowledged
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {selectedAgent && actionToConfirm && (
        <div className="p-5 rounded-2xl bg-destructive/5 border border-destructive/30 space-y-3">
          <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
            <AlertTriangle className="w-4 h-4" />
            Confirm Emergency Action: {actionToConfirm} on {selectedAgent}
          </div>
          <p className="text-xs text-muted-foreground">
            {actionToConfirm === 'KILL'
              ? `Terminating this agent will immediately invalidate its workload certificate and abort all active/queued invocations.`
              : actionToConfirm === 'QUARANTINE'
              ? `Quarantining will freeze tool executions while preserving diagnostic session logs.`
              : `Restoring will re-arm the agent workload identity and resume normal customer request processing.`}
          </p>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={confirmAction}
              disabled={killSwitchMutation.isPending}
              className={`px-4 py-1.5 rounded-xl text-xs font-semibold text-white shadow-sm ${
                actionToConfirm === 'KILL' ? 'bg-destructive hover:opacity-90' : 'bg-primary hover:opacity-90'
              }`}
            >
              {killSwitchMutation.isPending ? 'Executing...' : `Confirm ${actionToConfirm}`}
            </button>
            <button
              onClick={() => { setSelectedAgent(null); setActionToConfirm(null); }}
              className="px-3 py-1.5 rounded-xl bg-card border border-border text-xs text-foreground hover:bg-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Agents Fleet Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {agents.map((agent) => {
          const isKilled = agent.status === 'KILLED' || agent.isTerminated;
          const isQuarantined = agent.status === 'QUARANTINED' || agent.isQuarantined;

          return (
            <div
              key={agent.agentId}
              className={`p-5 rounded-2xl border shadow-sm transition-all ${
                isKilled
                  ? 'bg-red-500/5 border-red-500/30'
                  : isQuarantined
                  ? 'bg-amber-500/5 border-amber-500/30'
                  : 'bg-card border-border'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-sm font-bold text-foreground">
                    {agent.agentId}
                  </span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Cert: <span className="font-mono">{agent.certificateId}</span> ({agent.riskTier})
                  </p>
                </div>

                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    isKilled
                      ? 'bg-red-500/10 text-red-600 border-red-500/30'
                      : isQuarantined
                      ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                      : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                  }`}
                >
                  {agent.status}
                </span>
              </div>

              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Emergency Controls:</span>
                <div className="flex items-center gap-2">
                  {!isKilled && (
                    <button
                      onClick={() => handleAction(agent.agentId, 'KILL')}
                      className="px-3 py-1 rounded-lg bg-red-600/10 text-red-600 hover:bg-red-600 hover:text-white border border-red-600/20 text-xs font-semibold transition-colors"
                    >
                      Kill Agent
                    </button>
                  )}
                  {!isQuarantined && !isKilled && (
                    <button
                      onClick={() => handleAction(agent.agentId, 'QUARANTINE')}
                      className="px-3 py-1 rounded-lg bg-amber-500/10 text-amber-600 hover:bg-amber-500 hover:text-white border border-amber-500/20 text-xs font-semibold transition-colors"
                    >
                      Quarantine
                    </button>
                  )}
                  {(isKilled || isQuarantined) && (
                    <button
                      onClick={() => handleAction(agent.agentId, 'RESTORE')}
                      className="px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 text-xs font-semibold transition-colors flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Restore
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
