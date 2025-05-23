import { TradingPhase } from '@/lib/types';

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
          <i className="fas fa-tasks text-trading-primary mr-2"></i>
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
                <i
                  className={`${phase.icon} text-xl mb-2 ${
                    phase.id === currentPhase ? 'text-trading-primary' : 'text-gray-500'
                  }`}
                ></i>
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
