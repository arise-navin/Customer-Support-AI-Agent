import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Search, Filter, Mail, Phone, MapPin, ShoppingBag, X, Calendar, Shield } from 'lucide-react';
import { apiRequest } from '../lib/api';

export function Customers() {
  const [search, setSearch] = useState('');
  const [selectedTier, setSelectedTier] = useState<string>('ALL');
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', selectedTier],
    queryFn: async () => {
      const url = selectedTier !== 'ALL'
        ? `/customers?tier=${selectedTier}&limit=100`
        : '/customers?limit=100';
      const res = await apiRequest<{ total: number; data: any[] }>(url);
      return res.data || [];
    }
  });

  const customers = data || [];
  const filtered = customers.filter(
    (c: any) =>
      c.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Users className="w-6 h-6 text-primary" />
            Customers Management
          </h1>
          <p className="text-sm text-muted-foreground">
            {customers.length} synthetic customer profiles loaded directly from PostgreSQL.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search customers by name, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div className="flex items-center gap-1.5 bg-card border border-border p-1 rounded-xl text-xs">
          {['ALL', 'VIP', 'GOLD', 'SILVER', 'STANDARD'].map((t) => (
            <button
              key={t}
              onClick={() => setSelectedTier(t)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                selectedTier === t
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Customer Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase">
              <tr>
                <th className="px-6 py-3.5">Customer Name & Email</th>
                <th className="px-6 py-3.5">Tier</th>
                <th className="px-6 py-3.5">Phone</th>
                <th className="px-6 py-3.5">City & State</th>
                <th className="px-6 py-3.5">Total Orders</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-36 mb-1"></div><div className="h-3 bg-muted rounded w-28"></div></td>
                    <td className="px-6 py-4"><div className="h-5 bg-muted rounded-full w-16"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-28"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-12"></div></td>
                    <td className="px-6 py-4 text-right"><div className="h-7 bg-muted rounded w-20 ml-auto"></div></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium text-foreground">No matching customers found</p>
                  </td>
                </tr>
              ) : (
                filtered.map((customer: any) => {
                  const addr = customer.addresses?.[0];
                  return (
                    <tr key={customer.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-foreground">{customer.fullName}</div>
                        <div className="text-xs text-muted-foreground font-mono">{customer.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                          customer.tier === 'VIP' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' :
                          customer.tier === 'GOLD' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                          customer.tier === 'SILVER' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                          'bg-secondary text-muted-foreground border-border'
                        }`}>
                          {customer.tier}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground">
                        {customer.phone || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-xs text-foreground">
                        {addr ? `${addr.city}, ${addr.state}` : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold text-foreground">
                        {customer._count?.orders ?? 0}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setSelectedCustomer(customer)}
                          className="px-3 py-1 rounded-lg bg-secondary text-primary hover:bg-primary hover:text-primary-foreground font-medium text-xs transition-colors"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Details Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  {selectedCustomer.fullName.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground">{selectedCustomer.fullName}</h3>
                  <p className="text-xs text-muted-foreground font-mono">{selectedCustomer.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-secondary/30 border border-border">
                <div>
                  <span className="text-xs text-muted-foreground uppercase font-bold block">Email</span>
                  <span className="font-mono text-foreground">{selectedCustomer.email}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground uppercase font-bold block">Phone</span>
                  <span className="text-foreground">{selectedCustomer.phone || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground uppercase font-bold block">Membership Tier</span>
                  <span className="font-bold text-primary">{selectedCustomer.tier}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground uppercase font-bold block">Joined Date</span>
                  <span className="text-foreground">{new Date(selectedCustomer.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {selectedCustomer.addresses && selectedCustomer.addresses.length > 0 && (
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    Delivery Addresses
                  </h4>
                  <div className="p-3 rounded-xl bg-secondary/20 border border-border text-xs space-y-1">
                    <div className="font-semibold text-foreground">{selectedCustomer.addresses[0].street}</div>
                    <div className="text-muted-foreground">
                      {selectedCustomer.addresses[0].city}, {selectedCustomer.addresses[0].state} - {selectedCustomer.addresses[0].postalCode}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-secondary/30 border-t border-border flex justify-end">
              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-2 rounded-xl bg-secondary text-foreground text-xs font-semibold hover:bg-secondary/80"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
