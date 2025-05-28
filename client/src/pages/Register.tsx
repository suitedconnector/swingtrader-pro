import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { UserPlus, Mail, Lock, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';

interface RegistrationData {
  username: string;
  password: string;
  email: string;
  emailAlerts: boolean;
  tradingBankroll: string;
}

export default function Register() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [formData, setFormData] = useState<RegistrationData>({
    username: '',
    password: '',
    email: '',
    emailAlerts: true,
    tradingBankroll: '',
  });

  const registerMutation = useMutation({
    mutationFn: (data: RegistrationData) =>
      apiRequest('POST', '/api/register', data),
    onSuccess: () => {
      toast({
        title: "Account Created!",
        description: "Welcome to your trading dashboard. You're now ready to receive price alerts.",
      });
      setLocation('/');
    },
    onError: (error: any) => {
      toast({
        title: "Registration Failed",
        description: error.message || "Please try again with different credentials.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.password || !formData.email) {
      toast({
        title: "Missing Information",
        description: "Please fill in username, password, and email address.",
        variant: "destructive",
      });
      return;
    }
    registerMutation.mutate(formData);
  };

  const getCarrierInfo = () => {
    return (
      <div className="text-sm text-muted-foreground space-y-1">
        <p className="font-medium">For SMS alerts via email forwarding:</p>
        <div className="grid grid-cols-1 gap-1 text-xs">
          <p>• Verizon: 5551234567@vtext.com</p>
          <p>• AT&T: 5551234567@txt.att.net</p>
          <p>• T-Mobile: 5551234567@tmomail.net</p>
          <p>• Sprint: 5551234567@messaging.sprintpcs.com</p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center p-6">
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-2xl">
            <UserPlus className="h-6 w-6" />
            Create Trading Account
          </CardTitle>
          <CardDescription>
            Set up your account and notification preferences for price alerts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Account Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Account Information</h3>
              
              <div className="space-y-2">
                <Label htmlFor="username" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Username
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>
            </div>

            <Separator />

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Contact & Alerts</h3>
              
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email Address *
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Required for price alert notifications
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tradingBankroll" className="flex items-center gap-2">
                  <i className="fas fa-dollar-sign h-4 w-4"></i>
                  Trading Bankroll
                </Label>
                <Input
                  id="tradingBankroll"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Enter your starting balance (e.g., 10000.00)"
                  value={formData.tradingBankroll}
                  onChange={(e) => setFormData({ ...formData, tradingBankroll: e.target.value })}
                />
                <p className="text-sm text-muted-foreground">
                  Your initial trading account balance for position sizing calculations
                </p>
              </div>
            </div>

            <Separator />

            {/* Notification Preferences */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Alert Preferences</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="email-alerts" className="text-sm font-medium">
                      Email Alerts
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified by email when price targets are hit
                    </p>
                  </div>
                  <Switch
                    id="email-alerts"
                    checked={formData.emailAlerts}
                    onCheckedChange={(checked) => setFormData({ ...formData, emailAlerts: checked })}
                  />
                </div>


              </div>
            </div>

            <div className="pt-4">
              <Button
                type="submit"
                className="w-full"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? "Creating Account..." : "Create Trading Account"}
              </Button>
            </div>

            <div className="text-center text-sm text-muted-foreground">
              <p>
                By creating an account, you'll be able to track trades, receive price alerts,
                and access all trading workflow features.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}