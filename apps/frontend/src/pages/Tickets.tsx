import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ticket, Search, Plus, X, MessageSquare, CheckCircle, Clock, AlertCircle, Send } from 'lucide-react';
import { apiRequest } from '../lib/api';

export function Tickets() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [replyText, setReplyText] = useState('');

  // Form state for creating ticket
  const [newSubject, setNewSubject] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [formError, setFormError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['tickets', selectedStatus],
    queryFn: async () => {
      const url = selectedStatus !== 'ALL'
        ? `/tickets?status=${selectedStatus}&limit=100`
        : '/tickets?limit=100';
      const res = await apiRequest<{ total: number; data: any[] }>(url);
      return res.data || [];
    }
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers-list-for-ticket'],
    queryFn: async () => {
      const res = await apiRequest<{ total: number; data: any[] }>('/customers?limit=10');
      return res.data || [];
    }
  });

  const createTicketMutation = useMutation({
    mutationFn: async (payload: any) => {
      return await apiRequest('/tickets', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setIsCreateOpen(false);
      setNewSubject('');
      setNewDesc('');
      setFormError('');
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to create ticket');
    }
  });

  const updateTicketMutation = useMutation({
    mutationFn: async ({ id, status, replyMessage }: { id: string; status?: string; replyMessage?: string }) => {
      return await apiRequest(`/tickets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, replyMessage })
      });
    },
    onSuccess: (updated: any) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setSelectedTicket(updated);
      setReplyText('');
    }
  });

  const tickets = data || [];
  const filtered = tickets.filter(
    (t: any) =>
      t.ticketNumber?.toLowerCase().includes(search.toLowerCase()) ||
      t.subject?.toLowerCase().includes(search.toLowerCase()) ||
      t.customer?.fullName?.toLowerCase().includes(search.toLowerCase())
  );

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      case 'HIGH':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'MEDIUM':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default:
        return 'bg-secondary text-muted-foreground border-border';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RESOLVED':
      case 'CLOSED':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'IN_PROGRESS':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default:
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Ticket className="w-6 h-6 text-primary" />
            Support Tickets
          </h1>
          <p className="text-sm text-muted-foreground">
            {tickets.length} support inquiries managed across human and AI agent workflows.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-md shadow-primary/20 hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Create Support Ticket
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tickets by ticket number, subject, or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div className="flex items-center gap-1.5 bg-card border border-border p-1 rounded-xl text-xs overflow-x-auto">
          {['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((st) => (
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

      {/* Tickets Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase">
              <tr>
                <th className="px-6 py-3.5">Ticket #</th>
                <th className="px-6 py-3.5">Subject</th>
                <th className="px-6 py-3.5">Customer</th>
                <th className="px-6 py-3.5">Priority</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Assigned Agent</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-20"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-48"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-28"></div></td>
                    <td className="px-6 py-4"><div className="h-5 bg-muted rounded-full w-16"></div></td>
                    <td className="px-6 py-4"><div className="h-5 bg-muted rounded-full w-20"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-24"></div></td>
                    <td className="px-6 py-4 text-right"><div className="h-7 bg-muted rounded w-16 ml-auto"></div></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    <Ticket className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium text-foreground">No matching tickets found</p>
                  </td>
                </tr>
              ) : (
                filtered.map((t: any) => (
                  <tr key={t.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-foreground">{t.ticketNumber}</td>
                    <td className="px-6 py-4 font-medium text-foreground">{t.subject}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground">{t.customer?.fullName}</div>
                      <div className="text-xs text-muted-foreground font-mono">{t.customer?.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getPriorityBadge(t.priority)}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadge(t.status)}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-primary">
                      {t.assignedAgentId || 'Unassigned'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedTicket(t)}
                        className="px-3 py-1 rounded-lg bg-secondary text-primary hover:bg-primary hover:text-primary-foreground font-medium text-xs transition-colors"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ticket Details & Reply Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg text-foreground">{selectedTicket.ticketNumber}</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadge(selectedTicket.status)}`}>
                    {selectedTicket.status}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getPriorityBadge(selectedTicket.priority)}`}>
                    {selectedTicket.priority}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 font-semibold text-foreground">
                  {selectedTicket.subject}
                </p>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conversation Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              <div className="p-3.5 rounded-xl bg-secondary/30 border border-border text-xs leading-relaxed">
                <span className="font-bold text-muted-foreground block uppercase text-[10px] mb-1">Original Description</span>
                {selectedTicket.description}
              </div>

              {selectedTicket.messages?.map((msg: any) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-xl text-xs max-w-[85%] ${
                    msg.senderType === 'CUSTOMER'
                      ? 'bg-secondary/40 border border-border mr-auto'
                      : 'bg-primary/10 border border-primary/20 text-foreground ml-auto'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 font-bold text-[10px] text-muted-foreground mb-1">
                    <span>{msg.senderType}</span>
                    <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="leading-relaxed">{msg.message}</div>
                </div>
              ))}
            </div>

            {/* Action Bar & Reply */}
            <div className="p-4 border-t border-border bg-secondary/30 space-y-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateTicketMutation.mutate({ id: selectedTicket.id, status: 'RESOLVED' })}
                  disabled={selectedTicket.status === 'RESOLVED'}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs font-semibold hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  Mark Resolved
                </button>
                <button
                  onClick={() => updateTicketMutation.mutate({ id: selectedTicket.id, status: 'IN_PROGRESS' })}
                  disabled={selectedTicket.status === 'IN_PROGRESS'}
                  className="px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20 text-xs font-semibold hover:bg-blue-500/20 disabled:opacity-50"
                >
                  Mark In Progress
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Type an agent reply to update the ticket..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="flex-1 px-3.5 py-2 rounded-xl bg-card border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button
                  onClick={() => {
                    if (!replyText.trim()) return;
                    updateTicketMutation.mutate({ id: selectedTicket.id, replyMessage: replyText });
                  }}
                  disabled={!replyText.trim() || updateTicketMutation.isPending}
                  className="px-3 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  Reply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Ticket Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-base text-foreground">Create Support Ticket</h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Subject</label>
                <input
                  type="text"
                  placeholder="Summary of issue..."
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-secondary/50 border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Priority</label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as any)}
                  className="w-full px-3.5 py-2 rounded-xl bg-secondary/50 border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="URGENT">URGENT</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
                <textarea
                  rows={4}
                  placeholder="Detailed description of customer issue..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-secondary/50 border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            <div className="p-4 bg-secondary/30 border-t border-border flex justify-end gap-2">
              <button
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2 rounded-xl bg-secondary text-foreground text-xs font-semibold hover:bg-secondary/80"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const cust = customersData?.[0];
                  if (!cust) return;
                  createTicketMutation.mutate({
                    customerId: cust.id,
                    subject: newSubject,
                    description: newDesc,
                    priority: newPriority
                  });
                }}
                disabled={!newSubject || !newDesc || createTicketMutation.isPending}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {createTicketMutation.isPending ? 'Creating...' : 'Submit Ticket'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
