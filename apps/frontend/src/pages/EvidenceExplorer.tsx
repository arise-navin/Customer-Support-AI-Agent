import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileCheck2,
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Layers,
  Database,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { apiRequest } from '../lib/api';

interface EvidenceItem {
  id: string;
  evidenceRef: string;
  correlationId: string;
  agentId: string;
  action: string;
  decision: string;
  reason: string;
  simulated: boolean;
  source: 'APPLICATION_AUDIT' | 'SIGNET_MOCK' | 'SIGNET_REAL';
  verificationLevel: 'EXTERNALLY_VERIFIED_SIGNET' | 'SIMULATED_MOCK_SIGNET' | 'APPLICATION_INTERNAL';
  dlpCategory?: string;
  maskedPayload?: string;
  timestamp: string;
  metadata?: any;
}

export function EvidenceExplorer() {
  const [activeTier, setActiveTier] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: events = [], isLoading, refetch, isFetching } = useQuery<EvidenceItem[]>({
    queryKey: ['signet-evidence'],
    queryFn: async () => {
      return await apiRequest<EvidenceItem[]>('/signet/evidence');
    }
  });

  const filteredEvents = events.filter((e) => {
    if (activeTier === 'REAL' && e.verificationLevel !== 'EXTERNALLY_VERIFIED_SIGNET') return false;
    if (activeTier === 'MOCK' && e.verificationLevel !== 'SIMULATED_MOCK_SIGNET') return false;
    if (activeTier === 'APP' && e.verificationLevel !== 'APPLICATION_INTERNAL') return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        e.evidenceRef.toLowerCase().includes(q) ||
        e.agentId.toLowerCase().includes(q) ||
        e.correlationId.toLowerCase().includes(q) ||
        e.reason.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const realCount = events.filter((e) => e.verificationLevel === 'EXTERNALLY_VERIFIED_SIGNET').length;
  const mockCount = events.filter((e) => e.verificationLevel === 'SIMULATED_MOCK_SIGNET').length;
  const appCount = events.filter((e) => e.verificationLevel === 'APPLICATION_INTERNAL').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-primary/10 text-primary border border-primary/20">
              Cryptographic Audit
            </span>
            <span className="text-xs text-muted-foreground font-mono">Multi-Tier Evidence Verification</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5 mt-1">
            <FileCheck2 className="w-6 h-6 text-primary" />
            Signet Evidence & Provenance Explorer
          </h1>
          <p className="text-sm text-muted-foreground">
            Strictly distinguishes between internal application logs, mock simulations, and externally verified Signet cryptographic evidence.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card border border-border text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh Ledger
        </button>
      </div>

      {/* Verification Level Tabs / Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => setActiveTier('REAL')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeTier === 'REAL'
              ? 'bg-indigo-500/10 border-indigo-500/40 shadow-sm ring-1 ring-indigo-500/30'
              : 'bg-card border-border hover:bg-secondary/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              Real Signet Evidence
            </span>
            <span className="font-mono text-sm font-bold text-foreground">{realCount}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Externally signed cryptographic proof minted by live Signet Gateway.
          </p>
          <div className="mt-2 text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 w-fit font-bold">
            EXTERNALLY_VERIFIED
          </div>
        </button>

        <button
          onClick={() => setActiveTier('MOCK')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeTier === 'MOCK'
              ? 'bg-amber-500/10 border-amber-500/40 shadow-sm ring-1 ring-amber-500/30'
              : 'bg-card border-border hover:bg-secondary/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <Layers className="w-4 h-4" />
              Mock Signet Events
            </span>
            <span className="font-mono text-sm font-bold text-foreground">{mockCount}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Simulated policy enforcement records generated by local test adapter.
          </p>
          <div className="mt-2 text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 w-fit font-bold">
            SIMULATED
          </div>
        </button>

        <button
          onClick={() => setActiveTier('APP')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeTier === 'APP'
              ? 'bg-secondary border-primary/30 shadow-sm ring-1 ring-primary/20'
              : 'bg-card border-border hover:bg-secondary/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Database className="w-4 h-4 text-primary" />
              Application Audit Logs
            </span>
            <span className="font-mono text-sm font-bold text-foreground">{appCount}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Internal PostgreSQL transactional logs and tool execution records.
          </p>
          <div className="mt-2 text-[10px] px-2 py-0.5 rounded bg-secondary text-muted-foreground w-fit font-bold">
            APPLICATION_INTERNAL
          </div>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {['ALL', 'REAL', 'MOCK', 'APP'].map((t) => (
            <button
              key={t}
              onClick={() => setActiveTier(t)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                activeTier === t
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'ALL' ? 'All Evidence Tiers' : t}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search evidence ref or reason..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Evidence Table */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/40 border-b border-border text-xs uppercase font-semibold text-muted-foreground tracking-wider">
              <tr>
                <th className="py-3 px-4">Evidence Reference</th>
                <th className="py-3 px-4">Verification Tier</th>
                <th className="py-3 px-4">Agent ID</th>
                <th className="py-3 px-4">Policy Decision & Rule</th>
                <th className="py-3 px-4">Correlation ID</th>
                <th className="py-3 px-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-normal">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                    No evidence records matching the filter. Run scenarios in Governance Lab to generate cryptographic logs.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-foreground">
                      <span className="flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-primary" />
                        {evt.evidenceRef}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          evt.verificationLevel === 'EXTERNALLY_VERIFIED_SIGNET'
                            ? 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20'
                            : evt.verificationLevel === 'SIMULATED_MOCK_SIGNET'
                            ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                            : 'bg-secondary text-muted-foreground border-border'
                        }`}
                      >
                        {evt.verificationLevel === 'EXTERNALLY_VERIFIED_SIGNET'
                          ? 'Real Signet Evidence'
                          : evt.verificationLevel === 'SIMULATED_MOCK_SIGNET'
                          ? 'Mock Signet Event'
                          : 'Application Audit'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-foreground font-medium">
                      {evt.agentId}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground max-w-sm truncate" title={evt.reason}>
                      <span className="font-semibold text-foreground mr-1.5">{evt.decision}:</span>
                      {evt.reason}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-muted-foreground max-w-[120px] truncate" title={evt.correlationId}>
                      {evt.correlationId}
                    </td>
                    <td className="py-3 px-4 text-right text-xs text-muted-foreground font-mono">
                      {new Date(evt.timestamp).toLocaleTimeString()}
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
