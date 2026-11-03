import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ShoppingBag,
  Ticket,
  Bot,
  MessageSquare,
  Activity,
  Settings,
  ShieldCheck,
  Banknote,
  BookOpen,
  FlaskConical,
  ShieldAlert,
  CreditCard,
  FileText,
  UserCheck,
  Skull,
  FileCheck2,
  Server
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface NavSection {
  title: string;
  items: Array<{
    name: string;
    path: string;
    icon: any;
    badge?: string;
    badgeColor?: string;
  }>;
}

const navSections: NavSection[] = [
  {
    title: 'Support Operations',
    items: [
      { name: 'Dashboard', path: '/', icon: LayoutDashboard },
      { name: 'Customer Chat', path: '/chat', icon: MessageSquare, badge: 'Live AI' },
      { name: 'Customers', path: '/customers', icon: Users },
      { name: 'Orders & Shipments', path: '/orders', icon: ShoppingBag },
      { name: 'Refund Management', path: '/refunds', icon: Banknote },
      { name: 'Support Tickets', path: '/tickets', icon: Ticket },
      { name: 'Knowledge Base', path: '/knowledge-base', icon: BookOpen }
    ]
  },
  {
    title: 'Autonomous AI Swarm',
    items: [
      { name: 'AI Agents', path: '/agents', icon: Bot, badge: '4 Active' },
      { name: 'Agent Activity', path: '/activity', icon: Activity },
      { name: 'Standalone Test Lab', path: '/standalone-test-lab', icon: FlaskConical, badge: '20/20', badgeColor: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' }
    ]
  },
  {
    title: 'Signet AI Governance',
    items: [
      { name: 'Governance Lab', path: '/signet-governance-lab', icon: ShieldAlert, badge: '20/20', badgeColor: 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20' },
      { name: 'DLP Events', path: '/dlp-events', icon: CreditCard },
      { name: 'Policy Decisions', path: '/policy-decisions', icon: FileText },
      { name: 'Approvals Queue', path: '/approvals', icon: UserCheck },
      { name: 'Kill Switch', path: '/kill-switch', icon: Skull, badge: 'Emergency', badgeColor: 'bg-destructive/10 text-destructive border border-destructive/20' },
      { name: 'Evidence Explorer', path: '/evidence-explorer', icon: FileCheck2 },
      { name: 'Signet Settings', path: '/signet-settings', icon: Server }
    ]
  },
  {
    title: 'System',
    items: [
      { name: 'Settings & Models', path: '/settings', icon: Settings }
    ]
  }
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 border-r border-border bg-card/60 backdrop-blur-md flex flex-col justify-between shrink-0 select-none h-screen sticky top-0">
      <div className="flex flex-col h-full overflow-hidden">
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 gap-3 border-b border-border/80 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-base tracking-tight flex items-center gap-1.5">
              <span>Signet</span>
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                LAB
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground -mt-0.5">Customer Support AI</p>
          </div>
        </div>

        {/* Navigation Sections with Scroll */}
        <div className="p-3 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <div className="px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                {section.title}
              </div>
              {section.items.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      'flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all group',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/70'
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={cn('w-4 h-4 transition-transform group-hover:scale-110 shrink-0', isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground')} />
                      <span className="truncate">{item.name}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={cn(
                          'text-[10px] px-1.5 py-0.2 rounded-full font-semibold shrink-0',
                          item.badgeColor || (isActive ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary border border-primary/20')
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* Ollama & Signet Status Footer */}
        <div className="p-3 border-t border-border/80 shrink-0 bg-card/80">
          <div className="p-2.5 rounded-xl bg-secondary/50 border border-border/60">
            <div className="flex items-center justify-between text-xs font-medium text-foreground mb-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Ollama + Signet
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">Governed</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Fail-closed policy gateway active.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
