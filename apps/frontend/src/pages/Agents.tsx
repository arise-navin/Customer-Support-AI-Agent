import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, Activity, Play, Pause, Square, X } from 'lucide-react';
import { z } from 'zod';
import { apiRequest } from '../lib/api';

const agentSchema = z.object({
  id: z.string(), name: z.string(), description: z.string(), model: z.string(), status: z.string(),
  lastActiveAt: z.string().nullable(),
  permissions: z.array(z.object({ toolName: z.string(), isAllowed: z.boolean() })),
  _count: z.object({ executions: z.number() })
});
const trackingSchema = z.object({
  telemetry: z.object({ totalExecutions: z.number(), runningCount: z.number(), totalToolCalls: z.number(), avgLatencyMs: z.number() }),
  auditTrail: z.array(z.object({ id: z.string(), prompt: z.string(), response: z.string(), status: z.string().nullable(),
    createdAt: z.string(), durationMs: z.number(), toolCalls: z.array(z.object({ id: z.string(), toolName: z.string(), status: z.string() })) }))
});
const runSchema = z.object({ response: z.string(), executionId: z.string() });
type ControlRequest = { id: string; action: 'pause' | 'stop' | 'activate' };

export function Agents() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [customerId, setCustomerId] = useState('');
  const agents = useQuery({ queryKey: ['agents'], queryFn: async () => z.array(agentSchema).parse(await apiRequest('/agents', {})), refetchInterval: 2000 });
  const tracking = useQuery({ queryKey: ['agent-track', selectedId], enabled: selectedId !== null,
    queryFn: async () => trackingSchema.parse(await apiRequest(`/agents/${selectedId}/track`, {})), refetchInterval: 2000 });
  const control = useMutation({
    mutationFn: ({ id, action }: ControlRequest) => apiRequest(`/agents/${id}/${action}`, {
      method: 'POST', body: JSON.stringify(action === 'activate' ? {} : { reason: `Agent ${action} requested from dashboard` })
    }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['agents'] }); await queryClient.invalidateQueries({ queryKey: ['agent-track'] }); }
  });
  const run = useMutation({
    mutationFn: async () => runSchema.parse(await apiRequest(`/agents/${selectedId}/run`, {
      method: 'POST', body: JSON.stringify({ message, ...(customerId ? { customerId } : {}) })
    })),
    onSettled: async () => { await queryClient.invalidateQueries({ queryKey: ['agent-track'] }); await queryClient.invalidateQueries({ queryKey: ['agents'] }); }
  });
  return <div className="space-y-6 max-w-7xl mx-auto">
    <div><h1 className="text-2xl font-bold flex items-center gap-2"><Bot />Customer Support AI Agents</h1>
      <p className="text-sm text-muted-foreground mt-2">Run and track your four agents. Pause or stop cancels inference and blocks new work until activated.</p>
      <p className="text-xs text-muted-foreground mt-1">A tool operation already submitted to the database may finish. Activating allows a new request; cancelled requests are not resumed.</p></div>
    {agents.isError && <p role="alert" className="text-rose-500">{agents.error.message}</p>}
    {control.isError && <p role="alert" className="text-rose-500">{control.error.message}</p>}
    {agents.isPending && <p>Loading agents...</p>}
    <div className="grid md:grid-cols-2 gap-6">{agents.data?.map(agent => <article key={agent.id} data-testid={`agent-${agent.id}`} className="rounded-2xl border border-border bg-card p-6 space-y-5">
      <div className="flex justify-between gap-3"><div><h2 className="font-bold">{agent.name}</h2><p className="font-mono text-xs text-muted-foreground">{agent.id}</p></div>
        <span className={`text-xs font-bold ${agent.status === 'ACTIVE' ? 'text-emerald-500' : 'text-amber-500'}`}>{agent.status === 'KILLED' ? 'STOPPED' : agent.status}</span></div>
      <p className="text-sm text-muted-foreground">{agent.description}</p>
      <div className="grid grid-cols-3 gap-3 p-3 bg-secondary/40 rounded-xl text-xs"><div>Model<p className="font-mono mt-1">{agent.model}</p></div><div>Executions<p className="mt-1">{agent._count.executions}</p></div><div>Last active<p className="mt-1">{agent.lastActiveAt ? new Date(agent.lastActiveAt).toLocaleTimeString() : 'Never'}</p></div></div>
      <div className="flex flex-wrap gap-1">{agent.permissions.filter(permission => permission.isAllowed).map(permission => <span key={permission.toolName} className="text-[10px] font-mono bg-secondary rounded px-2 py-1">{permission.toolName}</span>)}</div>
      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <button data-testid={`track-${agent.id}`} onClick={() => { setSelectedId(agent.id); run.reset(); }} className="flex items-center gap-1 text-xs bg-primary text-primary-foreground px-3 py-2 rounded-lg"><Activity size={14} />Run & Track</button>
        <button data-testid={`pause-${agent.id}`} disabled={control.isPending || !['ACTIVE', 'IDLE'].includes(agent.status)} onClick={() => control.mutate({ id: agent.id, action: 'pause' })} className="flex items-center gap-1 text-xs bg-secondary px-3 py-2 rounded-lg disabled:opacity-40"><Pause size={14} />Pause</button>
        <button data-testid={`stop-${agent.id}`} disabled={control.isPending || agent.status === 'KILLED'} onClick={() => control.mutate({ id: agent.id, action: 'stop' })} className="flex items-center gap-1 text-xs bg-rose-500 text-white px-3 py-2 rounded-lg disabled:opacity-40"><Square size={14} />Stop</button>
        {!['ACTIVE', 'IDLE'].includes(agent.status) && <button data-testid={`activate-${agent.id}`} disabled={control.isPending} onClick={() => control.mutate({ id: agent.id, action: 'activate' })} className="text-xs bg-emerald-600 text-white px-3 py-2 rounded-lg disabled:opacity-40">Activate</button>}
      </div>
    </article>)}</div>
    <section className="rounded-2xl border border-border bg-card p-6 space-y-3">
      <h2 className="font-bold">REST API Connection</h2><p className="text-sm text-muted-foreground">Base URL: <code>{window.location.origin}/api/v1</code>. Use your existing API_SECRET_KEY as the x-api-key header.</p>
      <pre className="text-xs overflow-x-auto bg-secondary/40 p-4 rounded-xl">{`GET  /agents
POST /agents/:id/run       { "message": "Hello", "customerId": "customer UUID" }
GET  /agents/:id/track
GET  /agents/executions?agentId=:id
POST /agents/:id/pause     { "reason": "Manual pause" }
POST /agents/:id/stop      { "reason": "Manual stop" }
POST /agents/:id/activate  {}`}</pre>
    </section>
    {selectedId && <div className="fixed inset-0 z-50 bg-background/90 flex items-center justify-center p-6"><section role="dialog" aria-modal="true" aria-labelledby="agent-dialog-title" className="bg-card border border-border rounded-2xl p-6 max-w-3xl w-full max-h-[85vh] overflow-y-auto space-y-4">
      <div className="flex justify-between"><h2 id="agent-dialog-title" className="font-bold">Run & Track: {selectedId}</h2><button aria-label="Close agent details" onClick={() => setSelectedId(null)}><X size={18} /></button></div>
      <label className="block text-sm" htmlFor="agent-message">Message</label><textarea id="agent-message" value={message} onChange={event => setMessage(event.target.value)} className="w-full p-3 rounded-lg bg-secondary border border-border" />
      <label className="block text-sm" htmlFor="agent-customer">Customer UUID (needed for customer specific tools)</label><input id="agent-customer" value={customerId} onChange={event => setCustomerId(event.target.value)} className="w-full p-3 rounded-lg bg-secondary border border-border" />
      <button id="agent-run" disabled={run.isPending || !message.trim()} onClick={() => run.mutate()} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg disabled:opacity-40 flex gap-2 items-center"><Play size={14} />{run.isPending ? 'Running...' : 'Run agent'}</button>
      <div className="flex gap-2">{(['pause', 'stop', 'activate'] as const).map(action => <button key={action} data-testid={`detail-${action}`} disabled={control.isPending} onClick={() => control.mutate({ id: selectedId, action })} className="border border-border rounded-lg px-3 py-2 text-xs capitalize">{action}</button>)}</div>
      {run.isError && <p role="alert" className="text-rose-500">{run.error.message}</p>}{run.data && <p className="whitespace-pre-wrap">{run.data.response}</p>}
      {tracking.isError && <p role="alert">{tracking.error.message}</p>}
      {tracking.data && <><p className="text-sm text-muted-foreground">{tracking.data.telemetry.runningCount} running ? {tracking.data.telemetry.totalExecutions} executions ? {tracking.data.telemetry.totalToolCalls} tool calls ? {tracking.data.telemetry.avgLatencyMs}ms average</p>
        {tracking.data.auditTrail.map(execution => <div key={execution.id} className="border border-border rounded-xl p-4 text-sm space-y-2"><div className="text-xs text-muted-foreground">{execution.status} ? {new Date(execution.createdAt).toLocaleString()} ? {execution.durationMs}ms</div><p>{execution.prompt}</p><p className="text-muted-foreground whitespace-pre-wrap">{execution.response || 'Execution in progress...'}</p>{execution.toolCalls.map(tool => <p key={tool.id} className="text-xs font-mono">{tool.toolName}: {tool.status}</p>)}</div>)}</>}
    </section></div>}
  </div>;
}
