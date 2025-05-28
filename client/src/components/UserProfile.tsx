import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { User, Mail, Phone, Bell, BellOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface UserProfileData {
  id: number;
  username: string;
  email: string | null;
  phone: string | null;
  emailAlerts: boolean;
  smsAlerts: boolean;
  accountBalance: string | null;
}

export function UserProfile() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userId = 1; // For now, using default user ID

  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    emailAlerts: true,
    smsAlerts: true,
    accountBalance: '',
  });

  const { data: profile, isLoading } = useQuery({
    queryKey: ['/api/profile', userId],
    queryFn: () => fetch(`/api/profile/${userId}`).then(res => res.json()) as Promise<UserProfileData>,
    onSuccess: (data) => {
      setFormData({
        email: data.email || '',
        phone: data.phone || '',
        emailAlerts: data.emailAlerts,
        smsAlerts: data.smsAlerts,
      });
    }
  });

  const updateProfileMutation = useMutation({
    mutationFn: (updates: Partial<UserProfileData>) =>
      apiRequest(`/api/profile/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your notification preferences have been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/profile', userId] });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "There was an error updating your profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const testEmailMutation = useMutation({
    mutationFn: (email: string) =>
      apiRequest('/api/test-email-alert', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    onSuccess: () => {
      toast({
        title: "Test Alert Sent!",
        description: "Check your email for a sample price breakout alert.",
      });
    },
    onError: () => {
      toast({
        title: "Test Failed",
        description: "Couldn't send test alert. Make sure you have a valid email address.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(formData);
  };

  const getCarrierInfo = () => {
    return (
      <div className="text-sm text-muted-foreground space-y-1">
        <p className="font-medium">SMS Gateway Format Examples:</p>
        <div className="grid grid-cols-1 gap-1 text-xs">
          <p>• Verizon: 5551234567@vtext.com</p>
          <p>• AT&T: 5551234567@txt.att.net</p>
          <p>• T-Mobile: 5551234567@tmomail.net</p>
          <p>• Sprint: 5551234567@messaging.sprintpcs.com</p>
        </div>
      </div>
    );
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
          Configure your contact information and notification preferences for price alerts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* User Info */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Username</Label>
            <Input value={profile?.username || ''} disabled className="bg-muted" />
          </div>

          <Separator />

          {/* Contact Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Contact Information</h3>
            
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                Used for price alert notifications and account updates
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Phone Number (SMS Gateway)
              </Label>
              <Input
                id="phone"
                type="text"
                placeholder="5551234567@vtext.com"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Enter your phone number with carrier email gateway for SMS alerts
                </p>
                {getCarrierInfo()}
              </div>
            </div>
          </div>

          <Separator />

          {/* Account Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Account Settings</h3>
            
            <div className="space-y-2">
              <Label htmlFor="accountBalance" className="flex items-center gap-2">
                <i className="fas fa-dollar-sign h-4 w-4"></i>
                Account Balance
              </Label>
              <Input
                id="accountBalance"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.accountBalance || ''}
                onChange={(e) => setFormData({ ...formData, accountBalance: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                Your trading account balance for position sizing calculations
              </p>
            </div>
          </div>

          <Separator />

          {/* Notification Preferences */}
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
                onCheckedChange={(checked) => setFormData({ ...formData, emailAlerts: checked })}
              />
            </div>
            <p className="text-sm text-muted-foreground ml-6">
              Receive price breakout alerts via email
            </p>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <Label htmlFor="sms-alerts">SMS Alerts</Label>
              </div>
              <Switch
                id="sms-alerts"
                checked={formData.smsAlerts}
                onCheckedChange={(checked) => setFormData({ ...formData, smsAlerts: checked })}
              />
            </div>
            <p className="text-sm text-muted-foreground ml-6">
              Receive price breakout alerts via SMS (requires phone number above)
            </p>
          </div>

          <div className="pt-4 space-y-3">
            <Button
              type="submit"
              className="w-full"
              disabled={updateProfileMutation.isPending}
            >
              {updateProfileMutation.isPending ? "Saving..." : "Save Profile"}
            </Button>
            
            {formData.email && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={testEmailMutation.isPending}
                onClick={() => testEmailMutation.mutate(formData.email)}
              >
                {testEmailMutation.isPending ? "Sending..." : "📧 Send Test Alert"}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}