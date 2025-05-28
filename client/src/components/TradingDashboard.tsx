import { useState } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useThemeContext } from './ThemeProvider';
import { PhaseSelector } from './PhaseSelector';
import { ScanningPhase } from './ScanningPhase';
import { ChartSetupPhase } from './ChartSetupPhase';
import { PreEntryPhase } from './PreEntryPhase';
import { EntryPhase } from './EntryPhase';
import { ManagementPhase } from './ManagementPhase';
import { AnalysisPhase } from './AnalysisPhase';
import { Sidebar } from './Sidebar';
import type { TradingPhase } from '@/lib/types';

const TRADING_PHASES: TradingPhase[] = [
  { id: 1, name: 'Scanning', description: 'Scanning & ID', icon: 'fas fa-search', isActive: true },
  { id: 2, name: 'Chart Setup', description: 'Chart Setup', icon: 'fas fa-chart-bar', isActive: false },
  { id: 3, name: 'Pre-Entry', description: 'Pre-Entry', icon: 'fas fa-bell', isActive: false },
  { id: 4, name: 'Entry', description: 'Entry', icon: 'fas fa-play', isActive: false },
  { id: 5, name: 'Management', description: 'Management', icon: 'fas fa-chart-line', isActive: false },
  { id: 6, name: 'Analysis', description: 'Analysis', icon: 'fas fa-analytics', isActive: false },
];

export function TradingDashboard() {
  const { theme, toggleTheme } = useThemeContext();
  const [currentPhase, setCurrentPhase] = useState(1);
  const userId = 1; // For now, using default user ID
  
  // Fetch user profile to get account balance
  const { data: userProfile } = useQuery({
    queryKey: ['/api/profile', userId],
    queryFn: () => fetch(`/api/profile/${userId}`).then(res => res.json()),
  });

  const renderPhaseContent = () => {
    switch (currentPhase) {
      case 1:
        return <ScanningPhase />;
      case 2:
        return <ChartSetupPhase />;
      case 3:
        return <PreEntryPhase />;
      case 4:
        return <EntryPhase />;
      case 5:
        return <ManagementPhase />;
      case 6:
        return <AnalysisPhase />;
      default:
        return <ScanningPhase />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg text-gray-900 dark:text-gray-100 transition-colors duration-200">
      {/* Navigation Header */}
      <nav className="bg-white dark:bg-dark-surface shadow-sm border-b border-gray-200 dark:border-dark-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <i className="fas fa-chart-line text-trading-primary text-xl"></i>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">SwingTrader Pro</h1>
              </div>
              <div className="hidden md:flex items-center space-x-1">
                <button className="px-4 py-2 text-sm font-medium text-trading-primary bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  Dashboard
                </button>
                <button className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                  Watchlists
                </button>
                <button className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                  Trade Journal
                </button>
                <button className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                  Analytics
                </button>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm">
                <span className="text-gray-600 dark:text-gray-400">Trading Bankroll:</span>
                <span className="font-mono font-medium text-trading-success">
                  ${userProfile?.tradingBankroll || '0.00'}
                </span>
              </div>
              <Link href="/register">
                <button className="px-4 py-2 text-sm font-medium text-white bg-trading-primary hover:bg-blue-600 rounded-lg transition-colors">
                  <i className="fas fa-user-plus mr-2"></i>
                  Register
                </button>
              </Link>
              <button 
                onClick={toggleTheme}
                className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                {theme === 'light' ? (
                  <i className="fas fa-moon"></i>
                ) : (
                  <i className="fas fa-sun"></i>
                )}
              </button>
              <button className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <i className="fas fa-cog"></i>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <PhaseSelector 
          phases={TRADING_PHASES}
          currentPhase={currentPhase}
          onPhaseChange={setCurrentPhase}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {renderPhaseContent()}
          </div>
          <Sidebar />
        </div>
      </div>
    </div>
  );
}
