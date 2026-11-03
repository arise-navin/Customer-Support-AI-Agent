import { Routes, Route, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Login } from './pages/Login';
import { AppLayout } from './components/layout/AppLayout';
import { Agents } from './pages/Agents';
import { Chat } from './pages/Chat';
import { Activity } from './pages/Activity';
import { Settings } from './pages/Settings';

export function App() {
  const session = useQuery({
    queryKey: ['auth-session'],
    queryFn: async (): Promise<{ username: string } | null> => {
      const response = await fetch('/api/v1/auth/session');
      if (response.status === 401) return null;
      if (!response.ok) throw new Error(`Session check failed (${response.status})`);
      const data: { username?: string } = await response.json();
      if (data.username !== 'admin') throw new Error('Invalid session response');
      return { username: data.username };
    },
    retry: false
  });
  if (session.isPending) return <main className="min-h-screen bg-background text-foreground grid place-items-center">Checking session...</main>;
  if (session.isError) return <main role="alert" className="min-h-screen bg-background text-foreground grid place-items-center"><div>{session.error.message}<button onClick={() => session.refetch()} className="block mt-4 text-primary">Retry</button></div></main>;
  if (!session.data) return <Login />;

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Agents />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
