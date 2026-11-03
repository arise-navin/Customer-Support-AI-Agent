import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Moon, Sun, RefreshCw, Cpu, Database, Server } from 'lucide-react';
import { apiRequest, fetchDetailedHealth } from '../../lib/api';
import { useTheme } from '../../context/ThemeContext';

export function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const queryClient = useQueryClient();
  const logout = useMutation({
    mutationFn: () => apiRequest('/auth/logout', { method: 'POST', body: '{}' }),
    onSuccess: () => {
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'auth-session' });
      queryClient.setQueryData(['auth-session'], null);
    }
  });

  const { data: health, isLoading, refetch } = useQuery({
    queryKey: ['system-health'],
    queryFn: fetchDetailedHealth,
    refetchInterval: 10000,
  });

  return (
    <header className="h-16 border-b border-border bg-card/60 backdrop-blur-md px-6 flex items-center justify-between z-10">
      {/* Left: System Status Overview */}
      <div className="flex items-center gap-4">
        {/* Backend API Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/80 border border-border text-xs font-medium">
          <Server className="w-3.5 h-3.5 text-muted-foreground" />
          <span>API:</span>
          {isLoading ? (
            <span className="text-muted-foreground animate-pulse">Checking...</span>
          ) : health?.status === 'healthy' ? (
            <span className="flex items-center gap-1.5 text-emerald-500 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Healthy
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-amber-500 font-semibold">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              {health?.status || 'Degraded'}
            </span>
          )}
        </div>

        {/* Database Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/80 border border-border text-xs font-medium">
          <Database className="w-3.5 h-3.5 text-muted-foreground" />
          <span>DB:</span>
          {health?.database === 'connected' ? (
            <span className="text-emerald-500 font-semibold">PostgreSQL (Connected)</span>
          ) : (
            <span className="text-rose-500 font-semibold">Disconnected</span>
          )}
        </div>

        {/* Ollama Status */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/80 border border-border text-xs font-medium">
          <Cpu className="w-3.5 h-3.5 text-muted-foreground" />
          <span>Ollama:</span>
          {health?.ollama === 'connected' ? (
            <span className="text-emerald-500 font-semibold">{health.activeModel}</span>
          ) : (
            <span className="text-amber-500 font-semibold">{isLoading ? 'Checking...' : 'Unreachable'}</span>
          )}
        </div>
      </div>

      {/* Right: Controls & Profile */}
      <div className="flex items-center gap-3">
        {/* Refresh button */}
        <button
          onClick={() => refetch()}
          title="Refresh system status"
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>

        {/* Dark/Light mode toggle */}
        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
        </button>

        {/* Mode pill */}
        <div className="px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border border-indigo-500/20">
          MODE: {health?.executionMode || 'Checking...'}
        </div>
        <button id="logout" onClick={() => logout.mutate()} disabled={logout.isPending} className="text-xs font-semibold px-3 py-2 rounded-lg border border-border hover:bg-secondary">{logout.isPending ? 'Signing out...' : 'Sign out'}</button>
        {logout.isError ? <span role="alert" className="text-xs text-rose-500">{logout.error.message}</span> : null}
      </div>
    </header>
  );
}
