import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Clock,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { apiRequest } from '../lib/api';

export function Approvals() {
  const queryClient = useQueryClient();
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const { data: refunds = [], isLoading, refetch, isFetching } = useQuery<any[]>({
    queryKey: ['refund-approvals'],
    queryFn: async () => {
      return await apiRequest<any[]>('/refunds?status=PENDING');
    }
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/refunds/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ notes: 'Supervisor approved high-value return under Signet policy' })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refund-approvals'] });
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
      setRejectingId(null);
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['refund-approvals'] });
    }
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-primary/10 text-primary border border-primary/20">
              Human-in-the-Loop
            </span>
            <span className="text-xs text-muted-foreground font-mono">Supervisor Authorization Gate</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5 mt-1">
            <UserCheck className="w-6 h-6 text-primary" />
            Pending Supervisor Approvals
          </h1>
          <p className="text-sm text-muted-foreground">
            Review and authorize high-value transactions (&gt; INR 2,000) flagged by the Refund Specialist under Signet Governance.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card border border-border text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh Queue
        </button>
      </div>

      {/* Queue Table */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/40 border-b border-border text-xs uppercase font-semibold text-muted-foreground tracking-wider">
              <tr>
                <th className="py-3 px-4">Request ID</th>
                <th className="py-3 px-4">Order Number</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Return Reason</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-normal">
              {refunds.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-60" />
                    All refund requests have been processed. Queue is currently clear.
                  </td>
                </tr>
              ) : (
                refunds.map((req) => (
                  <tr key={req.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs text-foreground font-semibold">
                      {req.id.substring(0, 8)}...
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-primary font-medium">
                      {req.order?.orderNumber || req.orderId}
                    </td>
                    <td className="py-3 px-4 text-xs text-foreground">
                      {req.customer?.fullName || req.customerId}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-foreground">
                      INR {req.amount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground max-w-xs truncate" title={req.reason}>
                      {req.reason}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                        {req.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {rejectingId === req.id ? (
                        <div className="flex items-center gap-1 justify-end">
                          <input
                            type="text"
                            placeholder="Rejection reason..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="px-2 py-1 rounded-md bg-secondary text-xs text-foreground border border-border w-40"
                          />
                          <button
                            onClick={() => rejectMutation.mutate({ id: req.id, reason: rejectReason || 'Supervisor declined' })}
                            className="px-2 py-1 rounded-md bg-destructive text-destructive-foreground text-xs font-semibold"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => setRejectingId(null)}
                            className="px-2 py-1 rounded-md bg-secondary text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 justify-end">
                          <button
                            onClick={() => approveMutation.mutate(req.id)}
                            disabled={approveMutation.isPending}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold transition-colors shadow-sm"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setRejectingId(req.id)}
                            className="px-2.5 py-1 rounded-lg bg-card border border-border hover:bg-secondary text-xs font-medium text-foreground transition-colors"
                          >
                            Reject
                          </button>
                        </div>
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
