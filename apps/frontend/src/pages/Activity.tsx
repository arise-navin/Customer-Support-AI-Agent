import { useQuery } from '@tanstack/react-query';
import { Activity as ActivityIcon, Bot, Wrench, Clock, ShieldCheck, RefreshCw } from 'lucide-react';
import { apiRequest } from '../lib/api';

export function Activity() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['agent-executions'],
    queryFn: async () => {
      const res = await apiRequest<{ total: number; data: any[] }>('/agents/executions?limit=50');
      return res.data || [];
    },
    refetchInterval: 5000
  });

  const executions = data || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <ActivityIcon className="w-6 h-6 text-primary" />
            Agent Activity & Tool Execution Traces
          </h1>
          <p className="text-sm text-muted-foreground">
            {executions.length} real-time agent execution traces and tool invocations recorded in PostgreSQL.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card border border-border text-xs font-semibold text-foreground hover:bg-secondary transition-colors shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Activity
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase">
              <tr>
                <th className="px-6 py-3.5">Agent Persona</th>
                <th className="px-6 py-3.5">Prompt</th>
                <th className="px-6 py-3.5">Response Summary</th>
                <th className="px-6 py-3.5">Tool Calls</th>
                <th className="px-6 py-3.5">Tokens & Latency</th>
                <th className="px-6 py-3.5">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-28"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-40"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-48"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-20"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-16"></div></td>
                  </tr>
                ))
              ) : executions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    <ActivityIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium text-foreground">No agent executions recorded yet</p>
                    <p className="text-xs mt-1">Run an agent from the AI Agents page or send a message in Customer Chat.</p>
                  </td>
                </tr>
              ) : (
                executions.map((ex: any) => (
                  <tr key={ex.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-foreground text-xs">{ex.agent?.name || ex.agentId}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">{ex.agentId}</div>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-foreground max-w-xs truncate">
                      {ex.prompt}
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-foreground max-w-md truncate">
                      {ex.response}
                    </td>
                    <td className="px-6 py-4">
                      {ex.toolCalls && ex.toolCalls.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {ex.toolCalls.map((tc: any, idx: number) => (
                            <span
                              key={idx}
                              className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                            >
                              {tc.toolName}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Direct response</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-muted-foreground">
                      <div>{ex.durationMs}ms</div>
                      <div className="text-[10px] text-primary">{ex.completionTokens ? `${ex.completionTokens} tokens` : ''}</div>
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">
                      {new Date(ex.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
