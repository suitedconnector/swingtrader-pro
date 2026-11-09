import { TradingPhase } from '@/lib/types';
import { ListChecks } from 'lucide-react';

interface PhaseSelectorProps {
  phases: TradingPhase[];
  currentPhase: number;
  onPhaseChange: (phaseId: number) => void;
}

export function PhaseSelector({ phases, currentPhase, onPhaseChange }: PhaseSelectorProps) {
  return (
    <div className="mb-6">
      <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center">
          <ListChecks className="inline-block shrink-0 h-4 w-4 text-trading-primary mr-2" aria-hidden="true" />
          Trading Phase Workflow
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {phases.map((phase) => (
            <button
              key={phase.id}
              onClick={() => onPhaseChange(phase.id)}
              className="phase-btn"
            >
              <div
                className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
                  phase.id === currentPhase
                    ? 'border-trading-primary bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-trading-primary'
                }`}
              >
                <phase.icon
                  aria-hidden="true"
                  className={`h-5 w-5 mb-2 ${
                    phase.id === currentPhase ? 'text-trading-primary' : 'text-gray-500'
                  }`}
                />
                <span
                  className={`text-sm font-medium ${
                    phase.id === currentPhase
                      ? 'text-trading-primary'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  Phase {phase.id}
                </span>
                <span
                  className={`text-xs text-center ${
                    phase.id === currentPhase
                      ? 'text-trading-primary'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {phase.description}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
