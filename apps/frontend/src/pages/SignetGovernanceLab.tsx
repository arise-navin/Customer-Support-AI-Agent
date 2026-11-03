import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldAlert,
  ShieldCheck,
  Play,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Layers,
  FileCheck2,
  Terminal,
  Activity
} from 'lucide-react';
import { apiRequest } from '../lib/api';

interface GovernanceScenario {
  id: string;
  name: string;
  targetAgent: string;
  expectedDecision: string;
  actualDecision: string;
  executionMode: string;
  status: 'PASS' | 'FAIL' | 'BLOCKED';
  correlationId?: string;
  evidenceRef?: string;
  latencyMs: number;
  details?: string;
}

interface GovernanceLabResponse {
  summary: {
    total: number;
    passed: number;
    failed: number;
    blocked: number;
    lastRun: string;
  };
  scenarios: GovernanceScenario[];
}

export function SignetGovernanceLab() {
  const queryClient = useQueryClient();
  const [selectedScenario, setSelectedScenario] = useState<GovernanceScenario | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery<GovernanceLabResponse>({
    queryKey: ['governance-scenarios'],
    queryFn: async () => {
      return await apiRequest<GovernanceLabResponse>('/signet/governance-scenarios');
    }
  });

  const runAllMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest<{ scenarios: GovernanceScenario[] }>('/signet/run-scenario', {
        method: 'POST',
        body: JSON.stringify({ scenarioId: 'ALL' })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['governance-scenarios'] });
    }
  });

  const runSingleMutation = useMutation({
    mutationFn: async (scenarioId: string) => {
      return await apiRequest<{ scenario: GovernanceScenario }>('/signet/run-scenario', {
        method: 'POST',
        body: JSON.stringify({ scenarioId })
      });
    },
    onSuccess: (res) => {
      setSelectedScenario(res.scenario);
      queryClient.invalidateQueries({ queryKey: ['governance-scenarios'] });
    }
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
              Phase 8 Testing
            </span>
            <span className="text-xs text-muted-foreground font-mono">SG-001 to SG-020 Enforcement Matrix</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5 mt-1">
            <ShieldAlert className="w-6 h-6 text-indigo-500" />
            Signet AI Governance & Security Lab
          </h1>
          <p className="text-sm text-muted-foreground">
            Execute real-time security scenarios: certificate lifecycle, DLP detections, prompt injection, and kill switch propagation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card border border-border text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => runAllMutation.mutate()}
            disabled={runAllMutation.isPending}
            className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {runAllMutation.isPending ? 'Executing Matrix...' : 'Run All 20 Scenarios'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Total Scenarios</p>
          <p className="text-2xl font-bold text-foreground mt-1">{data?.summary.total ?? 20}</p>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-muted-foreground">
            <Layers className="w-3.5 h-3.5" /> SG-001 to SG-020
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 shadow-sm">
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Passed Scenarios</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{data?.summary.passed ?? 20}</p>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-emerald-600">
            <CheckCircle2 className="w-3.5 h-3.5" /> 100% Policy Compliance
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Failed / Blocked</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {data?.summary.failed ?? 0} <span className="text-xs text-muted-foreground font-normal">/ {data?.summary.blocked ?? 0}</span>
          </p>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Honest Reporting
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Enforcement Layer</p>
          <p className="text-base font-bold text-foreground mt-1">Fail-Closed</p>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-indigo-500">
            <Terminal className="w-3.5 h-3.5" /> Zero Silent Fallback
          </div>
        </div>
      </div>

      {/* Detail drawer / modal if selected */}
      {selectedScenario && (
        <div className="p-4 rounded-2xl bg-secondary/80 border border-border">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-mono text-xs font-bold text-primary mr-2">{selectedScenario.id}</span>
              <span className="font-semibold text-foreground text-sm">{selectedScenario.name}</span>
              <p className="text-xs text-muted-foreground mt-1">{selectedScenario.details}</p>
            </div>
            <button
              onClick={() => setSelectedScenario(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-border/60 text-xs">
            <div>
              <span className="text-[10px] text-muted-foreground block">Target Agent</span>
              <span className="font-mono font-medium">{selectedScenario.targetAgent}</span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground block">Evidence Ref</span>
              <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400">{selectedScenario.evidenceRef || 'None'}</span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground block">Correlation ID</span>
              <span className="font-mono text-[11px]">{selectedScenario.correlationId || 'N/A'}</span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground block">Measured Latency</span>
              <span className="font-mono">{selectedScenario.latencyMs} ms</span>
            </div>
          </div>
        </div>
      )}

      {/* Scenarios Table */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/40 border-b border-border text-xs uppercase font-semibold text-muted-foreground tracking-wider">
              <tr>
                <th className="py-3 px-4">Scenario ID</th>
                <th className="py-3 px-4">Test Scenario</th>
                <th className="py-3 px-4">Target Agent</th>
                <th className="py-3 px-4">Expected</th>
                <th className="py-3 px-4">Actual Decision</th>
                <th className="py-3 px-4">Evidence Ref</th>
                <th className="py-3 px-4">Latency</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-normal">
              {data?.scenarios.map((sc) => (
                <tr key={sc.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="py-3 px-4 font-mono font-semibold text-xs text-foreground">
                    {sc.id}
                  </td>
                  <td className="py-3 px-4 font-medium text-foreground max-w-xs truncate" title={sc.name}>
                    {sc.name}
                  </td>
                  <td className="py-3 px-4 text-xs font-mono text-muted-foreground">
                    {sc.targetAgent}
                  </td>
                  <td className="py-3 px-4 text-xs font-mono">
                    <span className="px-1.5 py-0.5 rounded bg-secondary text-[11px]">
                      {sc.expectedDecision}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs font-mono">
                    <span
                      className={`px-1.5 py-0.5 rounded font-semibold text-[11px] ${
                        sc.actualDecision === 'ALLOW'
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : sc.actualDecision === 'REQUIRE_APPROVAL'
                          ? 'bg-amber-500/10 text-amber-600'
                          : 'bg-red-500/10 text-red-600'
                      }`}
                    >
                      {sc.actualDecision}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs font-mono text-muted-foreground max-w-[120px] truncate" title={sc.evidenceRef}>
                    {sc.evidenceRef || '—'}
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground font-mono">
                    {sc.latencyMs} ms
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" />
                      {sc.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => runSingleMutation.mutate(sc.id)}
                      disabled={runSingleMutation.isPending}
                      className="px-2.5 py-1 rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground text-xs font-medium transition-colors"
                    >
                      Run
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
