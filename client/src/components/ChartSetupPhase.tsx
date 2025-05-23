import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import TradingViewChart from './TradingViewChart';
import { useTheme } from '@/hooks/useTheme';
import type { Watchlist } from '@shared/schema';

export function ChartSetupPhase() {
  const { theme } = useTheme();
  const [selectedStock, setSelectedStock] = useState<string>('');
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { data: watchlists = [] } = useQuery<Watchlist[]>({
    queryKey: ['/api/watchlists'],
  });

  // Get all unique symbols from both Focus and Flagged lists
  const allStocks = watchlists.reduce((stocks: string[], watchlist) => {
    return [...stocks, ...watchlist.symbols];
  }, []);

  const runTechnicalAnalysis = async (symbol: string) => {
    if (!symbol) return;
    
    setIsAnalyzing(true);
    try {
      const response = await fetch(`/api/technical-analysis/${symbol}`);
      const responseText = await response.text();
      
      console.log('Raw response:', responseText.slice(0, 500)); // Debug log
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('Response was:', responseText.slice(0, 200));
        setAnalysisData(null);
        return;
      }
      
      if (response.ok && data) {
        console.log('Setting analysis data:', data);
        setAnalysisData(data);
      } else {
        console.error('Analysis failed:', data?.message || 'Invalid response');
        setAnalysisData(null);
      }
    } catch (error) {
      console.error('Error running analysis:', error);
      setAnalysisData(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStockChange = (symbol: string) => {
    setSelectedStock(symbol);
    setAnalysisData(null);
    if (symbol) {
      runTechnicalAnalysis(symbol);
    }
  };

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600 dark:text-green-400';
    if (percentage >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBackground = (percentage: number) => {
    return 'bg-gray-50 dark:bg-gray-800';
  };

  return (
    <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <i className="fas fa-chart-bar text-trading-primary mr-2"></i>
        Phase 2: Daily Chart Setup Analysis
      </h3>
      
      {/* Stock Selection */}
      <div className="flex items-center space-x-4 mb-6">
        <h4 className="font-medium text-gray-900 dark:text-white">Select Stock to Analyze:</h4>
        <Select value={selectedStock} onValueChange={handleStockChange}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Choose a stock" />
          </SelectTrigger>
          <SelectContent>
            {allStocks.map((symbol) => (
              <SelectItem key={symbol} value={symbol}>
                {symbol}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isAnalyzing && (
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-trading-primary"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Analyzing...</span>
          </div>
        )}
      </div>

      {/* Debug Info */}
      {selectedStock && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 mb-6">
          <div className="text-sm">
            <div>Selected Stock: {selectedStock}</div>
            <div>Is Analyzing: {isAnalyzing ? 'Yes' : 'No'}</div>
            <div>Analysis Data: {analysisData ? 'Received' : 'None'}</div>
            {analysisData && <div>Symbol in Data: {analysisData.symbol || 'Missing'}</div>}
          </div>
        </div>
      )}

      {isAnalyzing && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-trading-primary"></div>
            <span className="text-sm">Running technical analysis...</span>
          </div>
        </div>
      )}

      {/* Chart Section */}
      <div className="mb-6 space-y-4">
        {selectedStock && (
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <TradingViewChart
              symbol={selectedStock}
              height={500}
              theme={theme === 'dark' ? 'dark' : 'light'}
              interval="D"
              allow_symbol_change={false}
              enable_publishing={false}
            />
          </div>
        )}
      </div>



      {/* Analysis Results */}
      {analysisData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Overall Score */}
          <div className={`rounded-lg p-4 ${getScoreBackground(analysisData.scorePercentage || 0)}`}>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Technical Score</h4>
            <div className={`text-3xl font-bold ${getScoreColor(analysisData.scorePercentage || 0)}`}>
              {analysisData.scorePercentage || 0}%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {analysisData.technicalScore}/{analysisData.maxScore} criteria met
            </div>
          </div>

          {/* Key Metrics */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Key Metrics</h4>
            <div className="space-y-1 text-sm">
              <div>Current Price: <span className="font-mono">${analysisData.currentPrice}</span></div>
              <div>30-day Move: <span className="font-mono">{analysisData.marketData.priceChange30d}%</span></div>
              <div>Volume: <span className="font-mono">{(analysisData.marketData.volume/1000000).toFixed(1)}M</span></div>
            </div>
          </div>

          {/* Moving Averages */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Moving Averages</h4>
            <div className="space-y-1 text-sm">
              <div>10 SMA: <span className={`font-mono ${analysisData.technicalIndicators?.sma10 === 'bullish' ? 'text-green-600' : 'text-red-600'}`}>{analysisData.technicalIndicators?.sma10 || 'N/A'}</span></div>
              <div>20 SMA: <span className={`font-mono ${analysisData.technicalIndicators?.sma20 === 'bullish' ? 'text-green-600' : 'text-red-600'}`}>{analysisData.technicalIndicators?.sma20 || 'N/A'}</span></div>
              <div>50 SMA: <span className={`font-mono ${analysisData.technicalIndicators?.sma50 === 'bullish' ? 'text-green-600' : 'text-red-600'}`}>{analysisData.technicalIndicators?.sma50 || 'N/A'}</span></div>
              <div>200 SMA: <span className={`font-mono ${analysisData.technicalIndicators?.sma200 === 'bullish' ? 'text-green-600' : 'text-red-600'}`}>{analysisData.technicalIndicators?.sma200 || 'N/A'}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Criteria Analysis */}
      {analysisData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 dark:text-white">Technical Analysis Results</h4>
            <div className="space-y-3">
              {Object.entries(analysisData.criteria).slice(0, 5).map(([key, criterion]: [string, any]) => (
                <div key={key} className="flex items-center space-x-3">
                  <Checkbox checked={criterion.value} disabled />
                  <div className="flex-1">
                    <span className="text-sm">{criterion.label}</span>
                    {criterion.weight > 1 && (
                      <span className="ml-2 px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded">
                        High Priority
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 dark:text-white">Moving Average Analysis</h4>
            <div className="space-y-3">
              {Object.entries(analysisData.criteria).slice(5).map(([key, criterion]: [string, any]) => (
                <div key={key} className="flex items-center space-x-3">
                  <Checkbox checked={criterion.value} disabled />
                  <span className="text-sm">{criterion.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!selectedStock && allStocks.length === 0 && (
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-8 text-center">
          <i className="fas fa-chart-candlestick text-4xl text-gray-400 mb-4"></i>
          <p className="text-gray-600 dark:text-gray-400">Add stocks to your watchlists from Phase 1 to analyze them here</p>
        </div>
      )}

      {!selectedStock && allStocks.length > 0 && (
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-8 text-center">
          <i className="fas fa-chart-line text-4xl text-gray-400 mb-4"></i>
          <p className="text-gray-600 dark:text-gray-400">Select a stock from the dropdown to view its chart and get automatic analysis</p>
        </div>
      )}
    </div>
  );
}
