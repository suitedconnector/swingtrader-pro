import { Link } from 'wouter';
import { useLogout } from "@/hooks/use-logout";
import { useThemeContext } from './ThemeProvider';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { ChartLine, Moon, Sun, User } from 'lucide-react';

export function Navbar() {
  const { theme, toggleTheme } = useThemeContext();
  const { logout, isLoggingOut } = useLogout();
  const { toast } = useToast();

  const { data: userProfile } = useQuery({
    queryKey: ['/api/profile'],
    queryFn: async () => {
      const res = await fetch('/api/profile');
      if (!res.ok) throw new Error('Failed to fetch profile');
      return res.json();
    },
  });

  const testEmailMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/test-email-alert'),
    onSuccess: () => {
      toast({
        title: "Test Email Sent!",
        description: "Check your account email for a sample trading alert.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Email Test Failed",
        description: error.message || "Failed to send test email",
        variant: "destructive",
      });
    },
  });

  return (
    <nav className="bg-white dark:bg-dark-surface shadow-sm border-b border-gray-200 dark:border-dark-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <ChartLine className="inline-block shrink-0 text-trading-primary h-5 w-5" aria-hidden="true" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">SwingTrader Pro</h1>
            </div>
            <div className="hidden md:flex items-center space-x-1">
              <Link href="/">
                <button className="px-4 py-2 text-sm font-medium text-trading-primary bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  Dashboard
                </button>
              </Link>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm">
              <span className="text-gray-600 dark:text-gray-400">Trading Bankroll:</span>
              <span className="font-mono font-medium text-trading-success">
                ${userProfile?.tradingBankroll || '0.00'}
              </span>
            </div>
            <button 
              onClick={() => testEmailMutation.mutate()}
              disabled={testEmailMutation.isPending}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-3 py-2 rounded-lg font-medium transition-colors text-sm"
            >
              {testEmailMutation.isPending ? 'Sending...' : 'Test Email'}
            </button>
            <Link href="/profile">
              <button className="px-4 py-2 text-sm font-medium text-trading-primary hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                <User className="inline-block shrink-0 h-4 w-4 mr-2" aria-hidden="true" />
                Account
              </button>
            </Link>
            <button 
              onClick={() => logout()}
              disabled={isLoggingOut}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:bg-red-400"
            >
              {isLoggingOut ? 'Logging out...' : 'Log out'}
            </button>
            <button 
              onClick={toggleTheme}
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              {theme === 'light' ? (
                <Moon className="inline-block shrink-0 h-4 w-4" aria-hidden="true" />
              ) : (
                <Sun className="inline-block shrink-0 h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
