import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  ShieldAlert,
  CreditCard,
  Key,
  Flame,
  CheckCircle2,
  RefreshCw,
  Search,
  Eye,
  EyeOff
} from 'lucide-react';
import { apiRequest } from '../lib/api';

interface DlpEvent {
  id: string;
  evidenceRef: string;
  correlationId: string;
  agentId: string;
  action: string;
  decision: string;
  reason: string;
  simulated: boolean;
  source: string;
  dlpCategory?: string;
  maskedPayload?: string;
  timestamp: string;
  metadata?: any;
}

export function DLPDashboard() {
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: events = [], isLoading, refetch, isFetching } = useQuery<DlpEvent[]>({
    queryKey: ['dlp-events'],
    queryFn: async () => {
      return await apiRequest<DlpEvent[]>('/signet/dlp-events');
    }
  });

  const categories = ['ALL', 'PAYMENT_CARD', 'API_TOKEN', 'PROMPT_INJECTION', 'PII'];

  const filteredEvents = events.filter((e) => {
    if (filterCategory !== 'ALL' && e.dlpCategory !== filterCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        e.agentId.toLowerCase().includes(q) ||
        (e.dlpCategory && e.dlpCategory.toLowerCase().includes(q)) ||
        (e.evidenceRef && e.evidenceRef.toLowerCase().includes(q)) ||
        (e.maskedPayload && e.maskedPayload.toLowerCase().includes(q))
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
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-amber-500/10 text-amber-600 border border-amber-500/20">
              Security Governance
            </span>
            <span className="text-xs text-muted-foreground font-mono">Real-Time Data Loss Prevention</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5 mt-1">
            <ShieldAlert className="w-6 h-6 text-amber-500" />
            Data Loss Prevention (DLP) Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Inspect live sensitive data interceptions: payment card redaction, fake API token masks, and prompt injections.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card border border-border text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh DLP Stream
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Payment Cards Intercepted</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {events.filter((e) => e.dlpCategory === 'PAYMENT_CARD').length}
          </p>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-muted-foreground">
            <CreditCard className="w-3.5 h-3.5 text-primary" /> Auto-Masked (PCI-DSS)
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">API Tokens Detected</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {events.filter((e) => e.dlpCategory === 'API_TOKEN').length}
          </p>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-muted-foreground">
            <Key className="w-3.5 h-3.5 text-amber-500" /> Secret Redaction
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Prompt Injection Attempts</p>
          <p className="text-2xl font-bold text-destructive mt-1">
            {events.filter((e) => e.dlpCategory === 'PROMPT_INJECTION').length}
          </p>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-destructive">
            <Flame className="w-3.5 h-3.5" /> Hard Blocked
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Total Scanned Events</p>
          <p className="text-2xl font-bold text-foreground mt-1">{events.length}</p>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-emerald-600">
            <CheckCircle2 className="w-3.5 h-3.5" /> Cryptographic Signatures
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filterCategory === cat
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search payload or evidence..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* DLP Event Log Table */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/40 border-b border-border text-xs uppercase font-semibold text-muted-foreground tracking-wider">
              <tr>
                <th className="py-3 px-4">Detection Category</th>
                <th className="py-3 px-4">Target Agent</th>
                <th className="py-3 px-4">Masked Payload Sample</th>
                <th className="py-3 px-4">Action / Tool</th>
                <th className="py-3 px-4">Decision</th>
                <th className="py-3 px-4">Evidence Reference</th>
                <th className="py-3 px-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-normal">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-muted-foreground">
                    No DLP interception events detected yet. Run scenarios in Governance Lab to generate live detections.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                        {evt.dlpCategory === 'PAYMENT_CARD' && <CreditCard className="w-3 h-3" />}
                        {evt.dlpCategory === 'API_TOKEN' && <Key className="w-3 h-3" />}
                        {evt.dlpCategory === 'PROMPT_INJECTION' && <Flame className="w-3 h-3" />}
                        {evt.dlpCategory || 'DATA_LEAK'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs font-mono font-medium text-foreground">
                      {evt.agentId}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono max-w-xs truncate text-muted-foreground" title={evt.maskedPayload}>
                      {evt.maskedPayload || '—'}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-muted-foreground">
                      {evt.action}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          evt.decision === 'ALLOW'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-red-500/10 text-red-600'
                        }`}
                      >
                        {evt.decision}
                      </span>
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
