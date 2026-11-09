import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Section } from '@/components/layout/primitives';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface UserProfileData {
  id: number;
  username: string;
  email: string | null;
  emailAlerts: boolean;
  tradingBankroll: string | null;
}

export function UserProfile() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [username, setUsername] = useState('');
  const [formData, setFormData] = useState({
    emailAlerts: true,
    tradingBankroll: '',
  });
  const [newEmail, setNewEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);

  const { data: profile, isLoading } = useQuery<UserProfileData>({
    queryKey: ['/api/profile'],
    queryFn: async () => {
      const res = await fetch('/api/profile');
      if (!res.ok) throw new Error('Failed to fetch profile');
      return res.json();
    },
  });

  useEffect(() => {
    if (profile) {
      setUsername(profile.username || '');
      setFormData({
        emailAlerts: profile.emailAlerts,
        tradingBankroll: profile.tradingBankroll || '',
      });
    }
  }, [profile]);

  const refreshProfile = () =>
    queryClient.invalidateQueries({ queryKey: ['/api/profile'] });

  const updateProfileMutation = useMutation({
    mutationFn: (updates: {
      username?: string;
      emailAlerts?: boolean;
      tradingBankroll?: string;
    }) => apiRequest('PATCH', '/api/profile', updates),
    onSuccess: () => {
      toast({
        title: 'Profile Updated',
        description: 'Your profile settings have been saved.',
      });
      refreshProfile();
    },
    onError: () => {
      toast({
        title: 'Update Failed',
        description: 'There was an error updating your profile. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const requestEmailCodeMutation = useMutation({
    mutationFn: () =>
      apiRequest('POST', '/api/profile/email/request', {
        email: newEmail.trim(),
      }),
    onSuccess: () => {
      setCodeSent(true);
      setVerificationCode('');
      toast({
        title: 'Verification Code Sent',
        description: 'Check your new email address for the six-digit code.',
      });
    },
    onError: () => {
      toast({
        title: 'Unable to Send Code',
        description: 'Check the email address and try again.',
        variant: 'destructive',
      });
    },
  });

  const verifyEmailMutation = useMutation({
    mutationFn: () =>
      apiRequest('POST', '/api/profile/email/verify', {
        code: verificationCode.trim(),
      }),
    onSuccess: () => {
      setNewEmail('');
      setVerificationCode('');
      setCodeSent(false);
      toast({
        title: 'Email Address Updated',
        description: 'Your new email address has been verified.',
      });
      refreshProfile();
    },
    onError: () => {
      toast({
        title: 'Verification Failed',
        description: 'The code may be incorrect or expired. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const testEmailMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/test-email-alert'),
    onSuccess: () => {
      toast({
        title: 'Test Alert Sent!',
        description: 'Check your account email for the sample alert.',
      });
    },
    onError: () => {
      toast({
        title: 'Test Failed',
        description: 'Could not send the test alert. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(formData);
  };

  const handleUsernameBlur = () => {
    const cleanedUsername = username.trim();

    if (!cleanedUsername || cleanedUsername === profile?.username) {
      setUsername(profile?.username || '');
      return;
    }

    updateProfileMutation.mutate({ username: cleanedUsername });
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4 py-6" aria-busy="true">
        <div className="h-3 w-24 rounded bg-muted" />
        <div className="h-9 rounded bg-muted" />
        <div className="h-9 rounded bg-muted" />
      </div>
    );
  }

  const hint = 'text-xs text-muted-foreground';

  return (
    <form onSubmit={handleSubmit} className="divide-y divide-border">
      <Section title="Account">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onBlur={handleUsernameBlur}
            placeholder="Your username"
          />
          <p className={hint}>Saved when you leave this field.</p>
        </div>
      </Section>

      <Section title="Email">
        <div className="space-y-5">
          <div>
            <div className="text-xs text-muted-foreground">Current verified email</div>
            <div className="mt-1 truncate text-sm text-foreground">{profile?.email || '—'}</div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="newEmail">Change email address</Label>
            <Input
              id="newEmail"
              type="email"
              placeholder="new@example.com"
              value={newEmail}
              disabled={codeSent}
              onChange={(e) => setNewEmail(e.target.value)}
            />

            {!codeSent ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={!newEmail.trim() || requestEmailCodeMutation.isPending}
                onClick={() => requestEmailCodeMutation.mutate()}
              >
                {requestEmailCodeMutation.isPending ? 'Sending code…' : 'Send verification code'}
              </Button>
            ) : (
              <div className="space-y-2 pt-1">
                <p className={hint}>
                  Enter the six-digit code sent to your new address. Your current email stays
                  active until verification succeeds.
                </p>
                <Input
                  id="verificationCode"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Six-digit code"
                  value={verificationCode}
                  onChange={(e) =>
                    setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    className="flex-1"
                    disabled={verificationCode.length !== 6 || verifyEmailMutation.isPending}
                    onClick={() => verifyEmailMutation.mutate()}
                  >
                    {verifyEmailMutation.isPending ? 'Verifying…' : 'Verify new email'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setCodeSent(false);
                      setVerificationCode('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Section>

      <Section title="Trading">
        <div className="space-y-2">
          <Label htmlFor="accountBalance">Account balance</Label>
          <Input
            id="accountBalance"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            className="font-mono tabular-nums"
            value={formData.tradingBankroll}
            onChange={(e) => setFormData({ ...formData, tradingBankroll: e.target.value })}
          />
          <p className={hint}>Used for position sizing.</p>
        </div>
      </Section>

      <Section title="Notifications">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="email-alerts">Email alerts</Label>
            <p className={`${hint} mt-1`}>Breakout, stop-loss and target emails.</p>
          </div>
          <Switch
            id="email-alerts"
            checked={formData.emailAlerts}
            onCheckedChange={(checked) => setFormData({ ...formData, emailAlerts: checked })}
          />
        </div>
      </Section>

      <div className="flex flex-col gap-2 pt-6">
        <Button type="submit" className="w-full" disabled={updateProfileMutation.isPending}>
          {updateProfileMutation.isPending ? 'Saving…' : 'Save settings'}
        </Button>

        {profile?.email && (
          <Button
            type="button"
            variant="ghost"
            className="w-full text-muted-foreground hover:text-foreground"
            disabled={testEmailMutation.isPending}
            onClick={() => testEmailMutation.mutate()}
          >
            {testEmailMutation.isPending ? 'Sending…' : 'Send test alert'}
          </Button>
        )}
      </div>
    </form>
  );
}
