import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { apiRequest } from '@/lib/queryClient';
import { AuthLayout } from '@/components/layout/AuthLayout';

interface RegistrationData {
  username: string;
  password: string;
  email: string;
  emailAlerts: boolean;
  tradingBankroll: string;
}

const fieldClass = 'border-0 bg-muted';

export default function Register() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const [formData, setFormData] = useState<RegistrationData>({
    username: '',
    password: '',
    email: '',
    emailAlerts: true,
    tradingBankroll: '',
  });

  const registerMutation = useMutation({
    mutationFn: (data: RegistrationData) => apiRequest('POST', '/api/register', data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      setLocation('/');
    },
    onError: (err: any) => {
      setError(err?.message ? `Could not create the account: ${err.message}` : 'Could not create the account.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.username || !formData.password || !formData.email) {
      setError('Username, password and email are required.');
      return;
    }
    registerMutation.mutate(formData);
  };

  const set = <K extends keyof RegistrationData>(key: K, value: RegistrationData[K]) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  return (
    <AuthLayout
      title="Create account"
      description="Track scans, plan trades and log your results."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            autoComplete="username"
            value={formData.username}
            onChange={(e) => set('username', e.target.value)}
            className={fieldClass}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={formData.password}
            onChange={(e) => set('password', e.target.value)}
            className={fieldClass}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={formData.email}
            onChange={(e) => set('email', e.target.value)}
            className={fieldClass}
          />
          <p className="text-xs text-muted-foreground">Used for sign-in codes and trade emails.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tradingBankroll">Bankroll</Label>
          <Input
            id="tradingBankroll"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            placeholder="e.g. 10000"
            value={formData.tradingBankroll}
            onChange={(e) => set('tradingBankroll', e.target.value)}
            className={`${fieldClass} font-mono`}
          />
          <p className="text-xs text-muted-foreground">Used to size positions. You can change it later in Settings.</p>
        </div>
        <div className="flex items-center justify-between gap-4 py-1">
          <div>
            <Label htmlFor="email-alerts">Email alerts</Label>
            <p className="text-xs text-muted-foreground">Email me when a trade hits its stop or target.</p>
          </div>
          <Switch
            id="email-alerts"
            checked={formData.emailAlerts}
            onCheckedChange={(checked) => set('emailAlerts', checked)}
          />
        </div>

        <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
          {registerMutation.isPending ? 'Creating account…' : 'Create account'}
        </Button>

        {error && (
          <p className="text-sm text-signal-down" role="alert">
            {error}
          </p>
        )}
      </form>
    </AuthLayout>
  );
}
