import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  Lock,
  ArrowRight
} from 'lucide-react';
import { apiRequest } from '../lib/api';

export function PolicyDecisions() {
  const [filterDecision, setFilterDecision] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: events = [], isLoading, refetch, isFetching } = useQuery<any[]>({
    queryKey: ['policy-events'],
    queryFn: async () => {
      return await apiRequest<any[]>('/signet/events');
    }
  });

  const filteredEvents = events.filter((e) => {
    if (filterDecision !== 'ALL' && e.decision !== filterDecision) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        e.agentId.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q) ||
        (e.reason && e.reason.toLowerCase().includes(q)) ||
        (e.evidenceRef && e.evidenceRef.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-primary/10 text-primary border border-primary/20">
              Audit Stream
            </span>
            <span className="text-xs text-muted-foreground font-mono">Real-time Policy Decisions</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5 mt-1">
            <ShieldCheck className="w-6 h-6 text-primary" />
            Signet Policy Decisions Ledger
          </h1>
          <p className="text-sm text-muted-foreground">
            Complete stream of ALLOW, DENY, and REQUIRE_APPROVAL decisions issued by Signet Gateway.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card border border-border text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh Decisions
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {['ALL', 'ALLOW', 'DENY', 'REQUIRE_APPROVAL', 'QUARANTINE'].map((d) => (
            <button
              key={d}
              onClick={() => setFilterDecision(d)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filterDecision === d
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {d === 'ALL' ? 'All Decisions' : d}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search action or agent..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Decisions Table */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/40 border-b border-border text-xs uppercase font-semibold text-muted-foreground tracking-wider">
              <tr>
                <th className="py-3 px-4">Decision</th>
                <th className="py-3 px-4">Agent</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Policy Reason</th>
                <th className="py-3 px-4">Evidence Reference</th>
                <th className="py-3 px-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-normal">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                    No decisions recorded yet. Run requests or governance tests to populate.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          evt.decision === 'ALLOW'
                            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                            : evt.decision === 'REQUIRE_APPROVAL'
                            ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                            : 'bg-red-500/10 text-red-600 border border-red-500/20'
                        }`}
                      >
                        {evt.decision === 'ALLOW' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {evt.decision}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs font-medium text-foreground">
                      {evt.agentId}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-muted-foreground">
                      {evt.action}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground max-w-sm truncate" title={evt.reason}>
                      {evt.reason}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-indigo-600 dark:text-indigo-400 max-w-[140px] truncate" title={evt.evidenceRef}>
                      {evt.evidenceRef}
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
