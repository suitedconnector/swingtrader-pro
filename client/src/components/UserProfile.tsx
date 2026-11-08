import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { User, Mail, Bell } from 'lucide-react';
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
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            User Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-10 bg-muted rounded"></div>
            <div className="h-10 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          User Profile
        </CardTitle>
        <CardDescription>
          Configure your account information and notification preferences
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={handleUsernameBlur}
              placeholder="Your username"
            />
            <p className="text-sm text-muted-foreground">
              Your username is saved when you leave this field.
            </p>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Contact Information</h3>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Current Verified Email
              </Label>
              <Input
                value={profile?.email || ''}
                disabled
                className="bg-muted"
              />
              <p className="text-sm text-muted-foreground">
                This is the email address currently associated with your account.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newEmail">Change Email Address</Label>
              <Input
                id="newEmail"
                type="email"
                placeholder="Enter your new email address"
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
                  {requestEmailCodeMutation.isPending
                    ? 'Sending Code...'
                    : 'Send Verification Code'}
                </Button>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Enter the six-digit code sent to your new email address.
                    Your current email remains active until verification succeeds.
                  </p>
                  <Input
                    id="verificationCode"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Six-digit verification code"
                    value={verificationCode}
                    onChange={(e) =>
                      setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                  />
                  <Button
                    type="button"
                    className="w-full"
                    disabled={
                      verificationCode.length !== 6 ||
                      verifyEmailMutation.isPending
                    }
                    onClick={() => verifyEmailMutation.mutate()}
                  >
                    {verifyEmailMutation.isPending
                      ? 'Verifying...'
                      : 'Verify New Email'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setCodeSent(false);
                      setVerificationCode('');
                    }}
                  >
                    Cancel Email Change
                  </Button>
                </>
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Account Settings</h3>

            <div className="space-y-2">
              <Label htmlFor="accountBalance">Account Balance</Label>
              <Input
                id="accountBalance"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.tradingBankroll}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    tradingBankroll: e.target.value,
                  })
                }
              />
              <p className="text-sm text-muted-foreground">
                Your trading account balance for position sizing calculations.
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Notification Preferences</h3>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                <Label htmlFor="email-alerts">Email Alerts</Label>
              </div>
              <Switch
                id="email-alerts"
                checked={formData.emailAlerts}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, emailAlerts: checked })
                }
              />
            </div>

            <p className="text-sm text-muted-foreground ml-6">
              Receive price breakout alerts via email.
            </p>
          </div>

          <div className="pt-4 space-y-3">
            <Button
              type="submit"
              className="w-full"
              disabled={updateProfileMutation.isPending}
            >
              {updateProfileMutation.isPending ? 'Saving...' : 'Save Profile'}
            </Button>

            {profile?.email && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={testEmailMutation.isPending}
                onClick={() => testEmailMutation.mutate()}
              >
                {testEmailMutation.isPending
                  ? 'Sending...'
                  : '📧 Send Test Alert'}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
