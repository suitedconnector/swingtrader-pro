import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/queryClient';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { cn } from '@/lib/utils';

type Method = 'password' | 'code';

const fieldClass = 'border-0 bg-muted';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [loginMethod, setLoginMethod] = useState<Method>('password');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const signedIn = async () => {
    await queryClient.invalidateQueries({ queryKey: ['/api/user'] });
    setLocation('/');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await apiRequest('POST', '/api/login', { username, password });
      await signedIn();
    } catch (err: any) {
      setError(err?.message ? `Sign-in failed: ${err.message}` : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/request-login-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.message || 'Could not send a code. Try again in a minute.');
        return;
      }
      setShowCodeInput(true);
    } catch {
      setError('Could not send a code. Check your connection.');
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/verify-login-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      if (res.ok) await signedIn();
      else setError('That code is not valid or has expired.');
    } catch {
      setError('Could not verify the code. Check your connection.');
    } finally {
      setBusy(false);
    }
  };

  const switchMethod = (m: Method) => {
    setLoginMethod(m);
    setError('');
  };

  return (
    <AuthLayout
      title="Sign in"
      description="Welcome back."
      footer={
        <>
          No account yet?{' '}
          <Link href="/register" className="text-foreground underline-offset-4 hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <div className="mb-6 inline-flex rounded-md bg-muted p-0.5" role="tablist" aria-label="Sign-in method">
        {(
          [
            ['password', 'Password'],
            ['code', 'Email code'],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={loginMethod === m}
            onClick={() => switchMethod(m)}
            className={cn(
              'rounded px-3 py-1 text-xs transition-colors',
              loginMethod === m ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {loginMethod === 'password' ? (
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={fieldClass}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={fieldClass}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy || !username || !password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      ) : !showCodeInput ? (
        <form onSubmit={sendCode} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldClass}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy || !email}>
            {busy ? 'Sending…' : 'Send code'}
          </Button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            We sent a 6-digit code to <span className="text-foreground">{email}</span>.
          </p>
          <div className="space-y-2">
            <Label htmlFor="code">Code</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={cn(fieldClass, 'font-mono tracking-widest')}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy || !code}>
            {busy ? 'Checking…' : 'Sign in'}
          </Button>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setShowCodeInput(false);
              setCode('');
              setError('');
            }}
          >
            Use a different email
          </button>
        </form>
      )}

      {error && (
        <p className="mt-4 text-sm text-signal-down" role="alert">
          {error}
        </p>
      )}
    </AuthLayout>
  );
}
