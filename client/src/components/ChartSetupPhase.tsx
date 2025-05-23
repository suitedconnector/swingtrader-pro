import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';

export function ChartSetupPhase() {
  const [technicalChecklist, setTechnicalChecklist] = useState({
    initialMove: false,
    pullback: false,
    higherLows: false,
    holdingSMA: false,
    volumeDrying: false,
  });

  const [maAlignment, setMaAlignment] = useState({
    sma10Above20: false,
    sma20Above50: false,
    sma50Above200: false,
    priceAbove200: false,
    marketTrending: false,
  });

  const handleTechnicalChange = (key: keyof typeof technicalChecklist) => {
    setTechnicalChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleMAChange = (key: keyof typeof maAlignment) => {
    setMaAlignment(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <i className="fas fa-chart-bar text-trading-primary mr-2"></i>
        Phase 2: Daily Chart Setup Analysis
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900 dark:text-white">Technical Analysis Checklist</h4>
          <div className="space-y-3">
            <label className="flex items-center space-x-3">
              <Checkbox
                checked={technicalChecklist.initialMove}
                onCheckedChange={() => handleTechnicalChange('initialMove')}
              />
              <span className="text-sm">Initial move up ≥30%</span>
            </label>
            <label className="flex items-center space-x-3">
              <Checkbox
                checked={technicalChecklist.pullback}
                onCheckedChange={() => handleTechnicalChange('pullback')}
              />
              <span className="text-sm">Orderly pullback/consolidation</span>
            </label>
            <label className="flex items-center space-x-3">
              <Checkbox
                checked={technicalChecklist.higherLows}
                onCheckedChange={() => handleTechnicalChange('higherLows')}
              />
              <span className="text-sm">Higher lows pattern</span>
            </label>
            <label className="flex items-center space-x-3">
              <Checkbox
                checked={technicalChecklist.holdingSMA}
                onCheckedChange={() => handleTechnicalChange('holdingSMA')}
              />
              <span className="text-sm">Holding 10/20 SMA during pullback</span>
            </label>
            <label className="flex items-center space-x-3">
              <Checkbox
                checked={technicalChecklist.volumeDrying}
                onCheckedChange={() => handleTechnicalChange('volumeDrying')}
              />
              <span className="text-sm">Volume drying up</span>
            </label>
          </div>
        </div>
        
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900 dark:text-white">Moving Average Alignment</h4>
          <div className="space-y-3">
            <label className="flex items-center space-x-3">
              <Checkbox
                checked={maAlignment.sma10Above20}
                onCheckedChange={() => handleMAChange('sma10Above20')}
              />
              <span className="text-sm">10 SMA {'>'} 20 SMA</span>
            </label>
            <label className="flex items-center space-x-3">
              <Checkbox
                checked={maAlignment.sma20Above50}
                onCheckedChange={() => handleMAChange('sma20Above50')}
              />
              <span className="text-sm">20 SMA {'>'} 50 SMA</span>
            </label>
            <label className="flex items-center space-x-3">
              <Checkbox
                checked={maAlignment.sma50Above200}
                onCheckedChange={() => handleMAChange('sma50Above200')}
              />
              <span className="text-sm">50 SMA {'>'} 200 SMA</span>
            </label>
            <label className="flex items-center space-x-3">
              <Checkbox
                checked={maAlignment.priceAbove200}
                onCheckedChange={() => handleMAChange('priceAbove200')}
              />
              <span className="text-sm">Price above 200 SMA</span>
            </label>
            <label className="flex items-center space-x-3">
              <Checkbox
                checked={maAlignment.marketTrending}
                onCheckedChange={() => handleMAChange('marketTrending')}
              />
              <span className="text-sm">Market trending higher</span>
            </label>
          </div>
        </div>
      </div>

      <div className="mt-6 bg-gray-100 dark:bg-gray-800 rounded-lg p-8 text-center">
        <i className="fas fa-chart-candlestick text-4xl text-gray-400 mb-4"></i>
        <p className="text-gray-600 dark:text-gray-400">Chart visualization would integrate here</p>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">TradingView widget or similar charting solution</p>
      </div>
    </div>
  );
}
