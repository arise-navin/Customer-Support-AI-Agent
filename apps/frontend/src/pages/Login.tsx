import { FormEvent, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { apiRequest } from '../lib/api';

export function Login() {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError('');
    setPending(true);
    try {
      await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: data.get('username'), password: data.get('password') })
      });
      queryClient.setQueryData(['auth-session'], { username: 'admin' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-xl space-y-5">
        <ShieldCheck className="h-10 w-10 text-primary" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-bold">Sign in to AI Support</h1>
          <p className="text-sm text-muted-foreground mt-2">Customer Support AI Agents</p>
        </div>
        <div className="space-y-2">
          <label htmlFor="username" className="block text-sm font-medium">Username</label>
          <input id="username" name="username" autoComplete="username" required maxLength={100} className="w-full rounded-lg border border-border bg-background p-3" />
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={100} className="w-full rounded-lg border border-border bg-background p-3" />
        </div>
        {error ? <p role="alert" className="text-sm text-rose-500">{error}</p> : null}
        <button id="login-submit" type="submit" disabled={pending} className="w-full rounded-lg bg-primary text-primary-foreground p-3 font-semibold disabled:opacity-50">{pending ? 'Signing in...' : 'Sign in'}</button>
      </form>
    </main>
  );
}
