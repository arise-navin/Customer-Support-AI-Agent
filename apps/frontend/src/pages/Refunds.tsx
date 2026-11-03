import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Banknote, Search, CheckCircle2, XCircle, Clock, ShieldCheck, AlertTriangle } from 'lucide-react';
import { apiRequest } from '../lib/api';

export function Refunds() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['refunds', selectedStatus],
    queryFn: async () => {
      const url = selectedStatus !== 'ALL'
        ? `/refunds?status=${selectedStatus}&limit=100`
        : '/refunds?limit=100';
      const res = await apiRequest<{ total: number; data: any[] }>(url);
      return res.data || [];
    }
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/refunds/${id}/approve`, { method: 'POST' });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
      setActionMessage(`✅ Refund approved: Simulated transaction ref ${data.refund?.transactionRef}`);
      setTimeout(() => setActionMessage(null), 5000);
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return await apiRequest(`/refunds/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
      setActionMessage('❌ Refund request rejected.');
      setTimeout(() => setActionMessage(null), 5000);
    }
  });

  const refunds = data || [];
  const filtered = refunds.filter(
    (r: any) =>
      r.order?.orderNumber?.toLowerCase().includes(search.toLowerCase()) ||
      r.customer?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      r.reason?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Banknote className="w-6 h-6 text-primary" />
            Refund Management & Approval Tiers
          </h1>
          <p className="text-sm text-muted-foreground">
            {refunds.length} simulated refund requests with tiered supervisor & security approvals.
          </p>
        </div>
      </div>

      {actionMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-semibold animate-in fade-in">
          {actionMessage}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by order number or customer name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div className="flex items-center gap-1.5 bg-card border border-border p-1 rounded-xl text-xs">
          {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStatus(st)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                selectedStatus === st
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Refunds Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase">
              <tr>
                <th className="px-6 py-3.5">Order & Customer</th>
                <th className="px-6 py-3.5">Refund Amount</th>
                <th className="px-6 py-3.5">Reason</th>
                <th className="px-6 py-3.5">Approval Tier</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Supervisor Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-32 mb-1"></div><div className="h-3 bg-muted rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-16"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-44"></div></td>
                    <td className="px-6 py-4"><div className="h-5 bg-muted rounded-full w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-5 bg-muted rounded-full w-20"></div></td>
                    <td className="px-6 py-4 text-right"><div className="h-7 bg-muted rounded w-24 ml-auto"></div></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    <Banknote className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium text-foreground">No refund requests found</p>
                  </td>
                </tr>
              ) : (
                filtered.map((req: any) => (
                  <tr key={req.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-foreground font-mono">{req.order?.orderNumber}</div>
                      <div className="text-xs text-muted-foreground">{req.customer?.fullName}</div>
                    </td>
                    <td className="px-6 py-4 font-bold text-foreground">
                      ₹{req.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-foreground max-w-xs truncate">
                      {req.reason}
                    </td>
                    <td className="px-6 py-4">
                      {req.requiresSecurityApproval ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500 border border-purple-500/20">
                          Tier 3: SecOps + Super
                        </span>
                      ) : req.requiresSupervisorApproval ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          Tier 2: Supervisor
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          Tier 1: Automated
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          req.status === 'APPROVED'
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                            : req.status === 'REJECTED'
                            ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {req.status === 'PENDING' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => approveMutation.mutate(req.id)}
                            disabled={approveMutation.isPending}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => rejectMutation.mutate({ id: req.id, reason: 'Exceeded policy window' })}
                            disabled={rejectMutation.isPending}
                            className="px-2.5 py-1 rounded-lg bg-secondary text-rose-500 hover:bg-rose-500/10 text-xs font-semibold transition-colors disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground font-mono">
                          {req.refund?.transactionRef || 'Completed'}
                        </span>
                      )}
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
