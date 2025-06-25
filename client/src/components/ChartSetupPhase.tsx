import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface SetupAnalysis {
  symbol: string;
  sector: string;
  setup_score: number;
  setup_quality: string;
  adr_percent: number;
  moving_averages: {
    current_price: number;
    sma_10: number;
    sma_20: number;
    sma_50: number;
    sma_200: number;
    perfect_alignment: boolean;
    price_above_10: boolean;
    price_above_20: boolean;
    price_above_50: boolean;
    price_above_200: boolean;
    sma_10_inclining: boolean;
    sma_20_inclining: boolean;
    sma_50_inclining: boolean;
    sma_200_inclining: boolean;
  };
  range_structure: {
    higher_lows: boolean;
    range_tightening: boolean;
    range_high: number;
    range_low: number;
    range_size_percent: number;
    current_position_in_range: number;
  };
  volume_pattern: {
    avg_volume_50d: number;
    recent_avg_volume: number;
    volume_drying_up: boolean;
    thin_volume_days: number;
    volume_ratio: number;
  };
  breakout_levels: {
    previous_day_high: number;
    range_high: number;
    resistance_level: number;
    distance_to_prev_high_percent: number;
    distance_to_range_high_percent: number;
    near_breakout: boolean;
  };
}

export function ChartSetupPhase() {
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [analysisSymbol, setAnalysisSymbol] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get watchlist stocks for analysis
  const { data: watchlists } = useQuery({
    queryKey: ['/api/watchlists'],
  });

  const focusListStocks = watchlists?.find(w => w.type === 'focus')?.stocks || [];

  // Setup analysis query
  const { data: setupAnalysis, isLoading: analysisLoading, error: analysisError } = useQuery<SetupAnalysis>({
    queryKey: ['/api/setup-analysis', analysisSymbol],
    enabled: !!analysisSymbol,
  });

  const handleAnalyzeStock = () => {
    if (selectedSymbol.trim()) {
      setAnalysisSymbol(selectedSymbol.toUpperCase());
    }
  };

  const addToWatchlistMutation = useMutation({
    mutationFn: async (symbol: string) => {
      const focusList = watchlists?.find(w => w.type === 'focus');
      if (!focusList) throw new Error('Focus list not found');
      
      const updatedStocks = [...(focusList.stocks || []), symbol];
      return apiRequest(`/api/watchlists/${focusList.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ stocks: updatedStocks }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
      toast({ title: 'Stock added to Focus List' });
    },
  });

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'Excellent': return 'bg-green-500';
      case 'Good': return 'bg-blue-500';
      case 'Fair': return 'bg-yellow-500';
      default: return 'bg-red-500';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <i className="fas fa-chart-line text-trading-primary mr-2"></i>
        Phase 2: Chart Setup Analysis
      </h3>

      {/* Analysis Input */}
      <div className="mb-6">
        <div className="flex space-x-2 mb-4">
          <Input
            placeholder="Enter symbol (e.g., AAPL)"
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value.toUpperCase())}
            className="flex-1"
          />
          <Button 
            onClick={handleAnalyzeStock}
            disabled={!selectedSymbol.trim() || analysisLoading}
          >
            {analysisLoading ? 'Analyzing...' : 'Analyze Setup'}
          </Button>
        </div>

        {/* Quick Select from Focus List */}
        {focusListStocks.length > 0 && (
          <div className="mb-4">
            <label className="text-sm font-medium mb-2 block">Or select from Focus List:</label>
            <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
              <SelectTrigger>
                <SelectValue placeholder="Select from Focus List" />
              </SelectTrigger>
              <SelectContent>
                {focusListStocks.map((symbol) => (
                  <SelectItem key={symbol} value={symbol}>
                    {symbol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Analysis Results */}
      {analysisLoading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-trading-primary mx-auto"></div>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Analyzing chart setup...</p>
        </div>
      )}

      {analysisError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
          <p className="text-red-800 dark:text-red-200">
            Failed to analyze setup. Please try again.
          </p>
        </div>
      )}

      {setupAnalysis && (
        <div className="space-y-6">
          {/* Setup Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{setupAnalysis.symbol} Setup Analysis</span>
                <Badge className={getQualityColor(setupAnalysis.setup_quality)}>
                  {setupAnalysis.setup_quality}
                </Badge>
              </CardTitle>
              <CardDescription>
                {setupAnalysis.sector} • ADR: {setupAnalysis.adr_percent}%
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Setup Score</span>
                  <span className="text-sm font-bold">{setupAnalysis.setup_score}/100</span>
                </div>
                <Progress value={setupAnalysis.setup_score} className="h-3" />
              </div>
              
              {setupAnalysis.setup_score >= 65 && (
                <Button 
                  onClick={() => addToWatchlistMutation.mutate(setupAnalysis.symbol)}
                  disabled={addToWatchlistMutation.isPending}
                  className="w-full"
                >
                  {addToWatchlistMutation.isPending ? 'Adding...' : 'Add to Focus List'}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Moving Averages Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Moving Average Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Current Price</div>
                  <div className="font-bold">{formatCurrency(setupAnalysis.moving_averages.current_price)}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600 dark:text-gray-400">10 SMA</div>
                  <div className={`font-bold ${setupAnalysis.moving_averages.price_above_10 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(setupAnalysis.moving_averages.sma_10)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600 dark:text-gray-400">20 SMA</div>
                  <div className={`font-bold ${setupAnalysis.moving_averages.price_above_20 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(setupAnalysis.moving_averages.sma_20)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600 dark:text-gray-400">50 SMA</div>
                  <div className={`font-bold ${setupAnalysis.moving_averages.price_above_50 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(setupAnalysis.moving_averages.sma_50)}
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Perfect Alignment (10>20>50>200)</span>
                  <span className={setupAnalysis.moving_averages.perfect_alignment ? 'text-green-600' : 'text-red-600'}>
                    {setupAnalysis.moving_averages.perfect_alignment ? '✓' : '✗'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Price Above 20 SMA</span>
                  <span className={setupAnalysis.moving_averages.price_above_20 ? 'text-green-600' : 'text-red-600'}>
                    {setupAnalysis.moving_averages.price_above_20 ? '✓' : '✗'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Moving Averages Inclining</span>
                  <span className="text-sm">
                    {[setupAnalysis.moving_averages.sma_10_inclining, setupAnalysis.moving_averages.sma_20_inclining,
                      setupAnalysis.moving_averages.sma_50_inclining, setupAnalysis.moving_averages.sma_200_inclining]
                      .filter(Boolean).length}/4
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Range Structure */}
          <Card>
            <CardHeader>
              <CardTitle>Range Structure</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Range High</div>
                  <div className="font-bold">{formatCurrency(setupAnalysis.range_structure.range_high)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Range Low</div>
                  <div className="font-bold">{formatCurrency(setupAnalysis.range_structure.range_low)}</div>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Higher Lows Pattern</span>
                  <span className={setupAnalysis.range_structure.higher_lows ? 'text-green-600' : 'text-red-600'}>
                    {setupAnalysis.range_structure.higher_lows ? '✓' : '✗'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Range Tightening</span>
                  <span className={setupAnalysis.range_structure.range_tightening ? 'text-green-600' : 'text-red-600'}>
                    {setupAnalysis.range_structure.range_tightening ? '✓' : '✗'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Range Size</span>
                  <span>{setupAnalysis.range_structure.range_size_percent.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Position in Range</span>
                  <span>{setupAnalysis.range_structure.current_position_in_range.toFixed(0)}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Volume Pattern */}
          <Card>
            <CardHeader>
              <CardTitle>Volume Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Volume Drying Up</span>
                  <span className={setupAnalysis.volume_pattern.volume_drying_up ? 'text-green-600' : 'text-red-600'}>
                    {setupAnalysis.volume_pattern.volume_drying_up ? '✓' : '✗'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Thin Volume Days</span>
                  <span>{setupAnalysis.volume_pattern.thin_volume_days}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Volume Ratio (Recent/Average)</span>
                  <span>{setupAnalysis.volume_pattern.volume_ratio.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Breakout Levels */}
          <Card>
            <CardHeader>
              <CardTitle>Breakout Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Previous Day High</div>
                  <div className="font-bold">{formatCurrency(setupAnalysis.breakout_levels.previous_day_high)}</div>
                  <div className="text-xs text-gray-500">
                    {setupAnalysis.breakout_levels.distance_to_prev_high_percent.toFixed(1)}% away
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Range High</div>
                  <div className="font-bold">{formatCurrency(setupAnalysis.breakout_levels.range_high)}</div>
                  <div className="text-xs text-gray-500">
                    {setupAnalysis.breakout_levels.distance_to_range_high_percent.toFixed(1)}% away
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Near Breakout (&lt;2% away)</span>
                  <span className={setupAnalysis.breakout_levels.near_breakout ? 'text-green-600' : 'text-red-600'}>
                    {setupAnalysis.breakout_levels.near_breakout ? '✓' : '✗'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}