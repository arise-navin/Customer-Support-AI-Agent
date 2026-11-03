import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShoppingBag, Search, Truck, CheckCircle2, Clock, MapPin, X, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { apiRequest } from '../lib/api';

export function Orders() {
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [activeTrackingOrder, setActiveTrackingOrder] = useState<any | null>(null);
  const [activeDetailsOrder, setActiveDetailsOrder] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['orders', selectedStatus],
    queryFn: async () => {
      const url = selectedStatus !== 'ALL'
        ? `/orders?status=${selectedStatus}&limit=100`
        : '/orders?limit=100';
      const res = await apiRequest<{ total: number; data: any[] }>(url);
      return res.data || [];
    }
  });

  const orders = data || [];
  const filtered = orders.filter(
    (o: any) =>
      o.orderNumber?.toLowerCase().includes(search.toLowerCase()) ||
      o.customer?.fullName?.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'SHIPPED':
      case 'PROCESSING':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'PAID':
        return 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20';
      case 'CANCELLED':
      case 'REFUNDED':
        return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      default:
        return 'bg-secondary text-foreground border-border';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <ShoppingBag className="w-6 h-6 text-primary" />
            Orders & Shipment Tracking
          </h1>
          <p className="text-sm text-muted-foreground">
            {orders.length} simulated orders with real-time carrier tracking and line items.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by order number (e.g. ORD-1005) or customer name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div className="flex items-center gap-1.5 bg-card border border-border p-1 rounded-xl text-xs overflow-x-auto max-w-full">
          {['ALL', 'PAID', 'SHIPPED', 'DELIVERED', 'REFUNDED', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStatus(st)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all shrink-0 ${
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

      {/* Orders Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase">
              <tr>
                <th className="px-6 py-3.5">Order Number</th>
                <th className="px-6 py-3.5">Customer</th>
                <th className="px-6 py-3.5">Items</th>
                <th className="px-6 py-3.5">Total Amount</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Carrier Tracking</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-32 mb-1"></div><div className="h-3 bg-muted rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-16"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-20"></div></td>
                    <td className="px-6 py-4"><div className="h-5 bg-muted rounded-full w-20"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-28"></div></td>
                    <td className="px-6 py-4 text-right"><div className="h-7 bg-muted rounded w-20 ml-auto"></div></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium text-foreground">No matching orders found</p>
                  </td>
                </tr>
              ) : (
                filtered.map((order: any) => (
                  <tr key={order.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-foreground">
                      {order.orderNumber}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-foreground">{order.customer?.fullName}</div>
                      <div className="text-xs text-muted-foreground font-mono">{order.customer?.email}</div>
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">
                      {order.items?.length ?? 1} items
                    </td>
                    <td className="px-6 py-4 font-semibold text-foreground">
                      ₹{order.totalAmount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadge(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {order.shipment ? (
                        <button
                          onClick={() => setActiveTrackingOrder(order)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary/80 hover:bg-primary/10 hover:text-primary transition-colors text-xs font-mono"
                        >
                          <Truck className="w-3.5 h-3.5 text-primary" />
                          <span>{order.shipment.trackingNumber}</span>
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Pre-dispatch</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setActiveDetailsOrder(order)}
                        className="px-3 py-1 rounded-lg bg-secondary text-primary hover:bg-primary hover:text-primary-foreground font-medium text-xs transition-colors"
                      >
                        View Order
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Shipment Tracking Modal */}
      {activeTrackingOrder && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-card border border-border rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">
                    Shipment Tracking: {activeTrackingOrder.shipment?.trackingNumber}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Carrier: {activeTrackingOrder.shipment?.carrier} • Order {activeTrackingOrder.orderNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTrackingOrder(null)}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="p-4 rounded-xl bg-secondary/40 border border-border flex items-center justify-between">
                <div>
                  <span className="text-xs text-muted-foreground uppercase font-bold block">Current Status</span>
                  <span className="font-bold text-sm text-emerald-500 flex items-center gap-1.5 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                    {activeTrackingOrder.shipment?.status}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground uppercase font-bold block">Current Location</span>
                  <span className="text-xs font-semibold text-foreground">
                    {activeTrackingOrder.shipment?.currentLocation || 'Distribution Hub'}
                  </span>
                </div>
              </div>

              {/* Milestones list */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  Tracking Milestones
                </h4>
                <div className="space-y-3 relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                  {((activeTrackingOrder.shipment?.trackingHistory as any[]) || [
                    { status: 'LABEL_CREATED', location: 'Central Warehouse', timestamp: new Date().toISOString() },
                    { status: 'PICKED_UP', location: 'Origin Facility', timestamp: new Date().toISOString() },
                    { status: 'IN_TRANSIT', location: 'Regional Transit Hub', timestamp: new Date().toISOString() }
                  ]).map((h: any, idx: number) => (
                    <div key={idx} className="relative">
                      <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-primary border-2 border-card"></div>
                      <div className="text-xs font-semibold text-foreground">{h.status}</div>
                      <div className="text-[11px] text-muted-foreground">{h.location} • {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 bg-secondary/30 border-t border-border flex justify-end">
              <button
                onClick={() => setActiveTrackingOrder(null)}
                className="px-4 py-2 rounded-xl bg-secondary text-foreground text-xs font-semibold hover:bg-secondary/80"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      {activeDetailsOrder && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg text-foreground">Order {activeDetailsOrder.orderNumber}</h3>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadge(activeDetailsOrder.status)}`}>
                    {activeDetailsOrder.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Placed by {activeDetailsOrder.customer?.fullName} ({activeDetailsOrder.customer?.email})
                </p>
              </div>
              <button
                onClick={() => setActiveDetailsOrder(null)}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Purchased Items
                </h4>
                <div className="space-y-2">
                  {activeDetailsOrder.items?.map((item: any) => (
                    <div key={item.id} className="p-3 rounded-xl bg-secondary/30 border border-border flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-foreground">{item.productName}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">SKU: {item.sku} • Qty: {item.quantity}</div>
                      </div>
                      <div className="font-bold text-foreground">
                        ₹{(item.totalPrice || item.unitPrice * item.quantity).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="p-4 rounded-xl bg-secondary/20 border border-border text-xs space-y-1.5">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>₹{activeDetailsOrder.subtotal?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>GST (18%)</span>
                  <span>₹{activeDetailsOrder.tax?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Shipping</span>
                  <span>₹{activeDetailsOrder.shipping?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-bold text-foreground text-sm pt-2 border-t border-border">
                  <span>Total Paid</span>
                  <span>₹{activeDetailsOrder.totalAmount?.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-secondary/30 border-t border-border flex justify-end">
              <button
                onClick={() => setActiveDetailsOrder(null)}
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
