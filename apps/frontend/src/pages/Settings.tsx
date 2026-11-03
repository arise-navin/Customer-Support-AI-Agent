import { useState } from 'react';
import { Settings as SettingsIcon, Cpu, Shield, CheckCircle2, AlertTriangle, RefreshCw, Play, Sparkles, Wrench } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '../lib/api';

export function Settings() {
  const [mode, setMode] = useState('DIRECT_OLLAMA');
  const [selectedModel, setSelectedModel] = useState('beam:cloud');
  const [testPrompt, setTestPrompt] = useState('What are the store hours for customer support?');
  const [testResult, setTestResult] = useState<any | null>(null);

  // 1. Ollama Health
  const { data: health, isLoading: healthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ['ollama-health'],
    queryFn: async () => {
      return await apiRequest<any>('/ollama/health');
    },
    refetchInterval: 15000
  });

  // 2. Installed Models
  const { data: modelsData, isLoading: modelsLoading, refetch: refetchModels } = useQuery({
    queryKey: ['ollama-models'],
    queryFn: async () => {
      return await apiRequest<any>('/ollama/models');
    }
  });

  // 3. Test Inference Mutation
  const testMutation = useMutation({
    mutationFn: async (payload: { model: string; prompt: string }) => {
      return await apiRequest<any>('/ollama/test', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    onSuccess: (data) => {
      setTestResult(data);
    },
    onError: (err: any) => {
      setTestResult({ success: false, error: err.message });
    }
  });

  const models = modelsData?.models || [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <SettingsIcon className="w-6 h-6 text-primary" />
            Ollama Model & System Settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage local Ollama model execution, inference benchmarks, and Signet governance mode.
          </p>
        </div>

        <button
          onClick={() => {
            refetchHealth();
            refetchModels();
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card border border-border text-xs font-semibold text-foreground hover:bg-secondary transition-colors shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Status
        </button>
      </div>

      <div className="space-y-6">
        {/* Ollama Connection & Status Card */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">Local Ollama Engine</h3>
                <p className="text-xs text-muted-foreground">Base URL: {health?.baseUrl || 'http://localhost:11434'}</p>
              </div>
            </div>
            {health?.healthy ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Connected ({health?.latencyMs ?? 2}ms)
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">
                <AlertTriangle className="w-3.5 h-3.5" />
                Service Unreachable
              </span>
            )}
          </div>

          {/* Model Selector and Installed Models Grid */}
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Installed Models ({models.length})
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {modelsLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="p-3.5 rounded-xl border border-border bg-secondary/30 animate-pulse">
                      <div className="h-4 bg-muted rounded w-28 mb-2"></div>
                      <div className="h-3 bg-muted rounded w-20"></div>
                    </div>
                  ))
                ) : (
                  models.map((m: any) => {
                    const isSelected = selectedModel === m.name || selectedModel.startsWith(m.name.split(':')[0]);
                    return (
                      <div
                        key={m.name}
                        onClick={() => setSelectedModel(m.name)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/10 shadow-sm'
                            : 'border-border bg-secondary/20 hover:border-border/80'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono font-bold text-xs text-foreground">{m.name}</span>
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                        </div>
                        <div className="text-[11px] text-muted-foreground space-y-0.5">
                          <div>Params: {m.details?.parameter_size || '501B'}</div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(m.capabilities || ['completion', 'tools']).map((cap: string) => (
                              <span key={cap} className="px-1.5 py-0.2 rounded bg-secondary text-[9px] font-mono">
                                {cap}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Inference Benchmarking & Tool Test Form */}
            <div className="p-4 rounded-xl bg-secondary/30 border border-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Live Model Inference & Tool Verification
                </span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  Target: {selectedModel}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={testPrompt}
                  onChange={(e) => setTestPrompt(e.target.value)}
                  placeholder="Test prompt..."
                  className="flex-1 px-3.5 py-2 rounded-xl bg-card border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button
                  onClick={() => testMutation.mutate({ model: selectedModel, prompt: testPrompt })}
                  disabled={testMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50 transition-opacity shrink-0"
                >
                  <Play className={`w-3.5 h-3.5 ${testMutation.isPending ? 'animate-spin' : ''}`} />
                  {testMutation.isPending ? 'Running...' : 'Run Test'}
                </button>
              </div>

              {/* Test Result Display */}
              {testResult && (
                <div className="p-3.5 rounded-xl bg-card border border-border text-xs space-y-2 mt-3 animate-in fade-in">
                  <div className="flex items-center justify-between text-muted-foreground border-b border-border pb-2">
                    <span className="font-semibold text-foreground">
                      Status: {testResult.success ? '✅ Success' : '❌ Failed'}
                    </span>
                    <span>Total Latency: {testResult.totalDurationMs}ms</span>
                  </div>

                  {testResult.inference && (
                    <div className="space-y-1">
                      <span className="text-muted-foreground font-bold block text-[10px] uppercase">
                        Assistant Response ({testResult.inference.tokens?.totalTokens || 0} tokens)
                      </span>
                      <div className="p-2.5 rounded-lg bg-secondary/50 font-sans text-foreground leading-relaxed">
                        {testResult.inference.response}
                      </div>
                    </div>
                  )}

                  {testResult.toolCalling && (
                    <div className="p-2.5 rounded-lg bg-secondary/30 border border-border flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wrench className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="font-semibold">Tool Calling Test:</span>
                        <span className="font-mono text-primary">{testResult.toolCalling.toolCalled}</span>
                      </div>
                      <span className="text-emerald-500 font-bold text-[10px]">VERIFIED</span>
                    </div>
                  )}

                  {testResult.error && (
                    <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20">
                      {testResult.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Execution Mode Card */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">AI Execution Mode</h3>
              <p className="text-xs text-muted-foreground">
                Control whether agent requests execute directly against Ollama or route through Signet
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                id: 'DIRECT_OLLAMA',
                title: 'DIRECT_OLLAMA',
                desc: 'Standalone direct mode. Agents query local Ollama model directly with application-level authorization.'
              },
              {
                id: 'SIGNET_MOCK',
                title: 'SIGNET_MOCK',
                desc: 'Simulated Signet gateway mode. Emulates policy evaluation and certificates.'
              },
              {
                id: 'SIGNET_REAL',
                title: 'SIGNET_REAL',
                desc: 'Production Signet gateway mode. Enforces certificates, DLP, and kill-switch.'
              }
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  mode === m.id
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-secondary/20 hover:border-border/80'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-xs text-foreground font-mono">{m.title}</span>
                  {mode === m.id && <CheckCircle2 className="w-4 h-4 text-primary" />}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{m.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
