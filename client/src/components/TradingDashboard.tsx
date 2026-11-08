import { useState } from "react";
import { Navbar } from './Navbar';
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
  const [currentPhase, setCurrentPhase] = useState(1);

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
      <Navbar />

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
