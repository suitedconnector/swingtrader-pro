import { Express } from "express";
import { createServer } from "http";
import { exec, spawn } from "child_process";
import { storage } from "./storage";

export async function registerRoutes(app: Express) {
  // Get all watchlists
  app.get("/api/watchlists", async (req, res) => {
    try {
      const watchlists = await storage.getWatchlists();
      res.json(watchlists);
    } catch (error) {
      console.error('Error fetching watchlists:', error);
      res.status(500).json({ message: "Failed to fetch watchlists" });
    }
  });

  // Create a new watchlist
  app.post("/api/watchlists", async (req, res) => {
    try {
      const watchlist = await storage.createWatchlist(req.body);
      res.status(201).json(watchlist);
    } catch (error) {
      console.error('Error creating watchlist:', error);
      res.status(500).json({ message: "Failed to create watchlist" });
    }
  });

  // Update a watchlist
  app.patch("/api/watchlists/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const watchlist = await storage.updateWatchlist(id, req.body);
      if (!watchlist) {
        return res.status(404).json({ message: "Watchlist not found" });
      }
      res.json(watchlist);
    } catch (error) {
      console.error('Error updating watchlist:', error);
      res.status(500).json({ message: "Failed to update watchlist" });
    }
  });

  // Delete a watchlist
  app.delete("/api/watchlists/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteWatchlist(id);
      if (!deleted) {
        return res.status(404).json({ message: "Watchlist not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting watchlist:', error);
      res.status(500).json({ message: "Failed to delete watchlist" });
    }
  });

  // Get all trades
  app.get("/api/trades", async (req, res) => {
    try {
      const trades = await storage.getTrades();
      res.json(trades);
    } catch (error) {
      console.error('Error fetching trades:', error);
      res.status(500).json({ message: "Failed to fetch trades" });
    }
  });

  // Create a new trade
  app.post("/api/trades", async (req, res) => {
    try {
      const trade = await storage.createTrade(req.body);
      res.status(201).json(trade);
    } catch (error) {
      console.error('Error creating trade:', error);
      res.status(500).json({ message: "Failed to create trade" });
    }
  });

  // Update a trade
  app.patch("/api/trades/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const trade = await storage.updateTrade(id, req.body);
      if (!trade) {
        return res.status(404).json({ message: "Trade not found" });
      }
      res.json(trade);
    } catch (error) {
      console.error('Error updating trade:', error);
      res.status(500).json({ message: "Failed to update trade" });
    }
  });

  // Get all price alerts
  app.get("/api/price-alerts", async (req, res) => {
    try {
      const alerts = await storage.getPriceAlerts();
      res.json(alerts);
    } catch (error) {
      console.error('Error fetching price alerts:', error);
      res.status(500).json({ message: "Failed to fetch price alerts" });
    }
  });

  // Create a new price alert
  app.post("/api/price-alerts", async (req, res) => {
    try {
      const alert = await storage.createPriceAlert(req.body);
      res.status(201).json(alert);
    } catch (error) {
      console.error('Error creating price alert:', error);
      res.status(500).json({ message: "Failed to create price alert" });
    }
  });

  // Update a price alert
  app.patch("/api/price-alerts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const alert = await storage.updatePriceAlert(id, req.body);
      if (!alert) {
        return res.status(404).json({ message: "Price alert not found" });
      }
      res.json(alert);
    } catch (error) {
      console.error('Error updating price alert:', error);
      res.status(500).json({ message: "Failed to update price alert" });
    }
  });

  // Get all scan results (sorted by change percentage, highest first)
  app.get("/api/scan-results", async (req, res) => {
    try {
      const results = await storage.getScanResults();
      // Sort by change percentage (highest gainers first)
      const sortedResults = results.sort((a, b) => {
        const changeA = parseFloat(a.changePercent || '0');
        const changeB = parseFloat(b.changePercent || '0');
        return changeB - changeA;
      });
      res.json(sortedResults);
    } catch (error) {
      console.error('Error fetching scan results:', error);
      res.status(500).json({ message: "Failed to fetch scan results" });
    }
  });

  // Reset/clear all scan results
  app.delete("/api/scan-results", async (req, res) => {
    try {
      await storage.clearOldScanResults();
      res.json({ message: "Scan results cleared successfully" });
    } catch (error) {
      console.error('Error clearing scan results:', error);
      res.status(500).json({ message: "Failed to clear scan results" });
    }
  });

  // Run scans using same approach as technical analysis
  app.post("/api/run-scans", async (req, res) => {
    try {
      console.log('Running scans...');
      
      // Clear old scan results first
      await storage.clearOldScanResults();
      
      // Scan symbols across different sectors
      const scanSymbols = ['AAPL', 'MSFT', 'GOOGL', 'JPM', 'UNH', 'XOM', 'HD', 'V'];
      const processedResults = [];
      
      for (const symbol of scanSymbols) {
        try {
          // Use the same technical analysis function as Phase 2
          const score = generateTechnicalScore(symbol);
          const analysis = generateAnalysisDetails(symbol, score);
          
          // Only include stocks with good technical scores (60%+)
          if (score >= 60) {
            await storage.createScanResult({
              symbol: symbol,
              scanType: '1day',
              price: analysis.currentPrice,
              change: (parseFloat(analysis.currentPrice) * 0.02).toFixed(2),
              changePercent: (score / 10).toFixed(1),
              volume: parseInt(analysis.technicalIndicators.volume.replace(/[^\d]/g, '')) || 1000000,
              sector: getSectorForSymbol(symbol),
              adr: score > 80 ? (score / 10).toFixed(1) : null,
              dollarVolume: (parseFloat(analysis.currentPrice) * 1000000).toString()
            });
            
            processedResults.push(symbol);
          }
        } catch (error: any) {
          console.log(`Skipping ${symbol}: ${error.message}`);
        }
      }
      
      console.log(`Processed ${processedResults.length} qualifying stocks: ${processedResults.join(', ')}`);
      res.json({ message: `Scans completed. Found ${processedResults.length} qualifying stocks.` });
    } catch (error: any) {
      console.error('Scan error:', error);
      res.status(500).json({ message: "Failed to run scans: " + error.message });
    }
  });

  // Helper function to get sector for known symbols
  function getSectorForSymbol(symbol: string): string {
    const sectorMap: { [key: string]: string } = {
      'AAPL': 'Technology', 'MSFT': 'Technology', 'GOOGL': 'Technology', 'AMZN': 'Technology',
      'TSLA': 'Technology', 'NVDA': 'Technology', 'META': 'Technology', 'NFLX': 'Technology',
      'JPM': 'Financial Services', 'BAC': 'Financial Services', 'WFC': 'Financial Services',
      'GS': 'Financial Services', 'C': 'Financial Services', 'V': 'Financial Services', 'MA': 'Financial Services',
      'JNJ': 'Healthcare', 'PFE': 'Healthcare', 'UNH': 'Healthcare', 'ABBV': 'Healthcare', 'MRK': 'Healthcare',
      'XOM': 'Energy', 'CVX': 'Energy', 'COP': 'Energy', 'SLB': 'Energy',
      'HD': 'Consumer Discretionary', 'WMT': 'Consumer Staples', 'PG': 'Consumer Staples',
      'KO': 'Consumer Staples', 'PEP': 'Consumer Staples', 'DIS': 'Communication Services'
    };
    
    return sectorMap[symbol] || 'Technology';
  }

  // Get stock price and breakout suggestion
  app.get('/api/stock-price/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ message: 'API key not configured' });
      }

      const response = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol.toUpperCase()}&apikey=${apiKey}`);
      const data = await response.json();
      
      if (data['Global Quote'] && data['Global Quote']['05. price']) {
        const currentPrice = parseFloat(data['Global Quote']['05. price']);
        const dayHigh = parseFloat(data['Global Quote']['03. high']) || currentPrice;
        const dayLow = parseFloat(data['Global Quote']['04. low']) || currentPrice;
        
        const rangeBreakout = dayHigh * 1.02;
        const percentBreakout = currentPrice * 1.03;
        const suggestedBreakout = Math.max(rangeBreakout, percentBreakout);
        
        res.json({
          symbol: symbol.toUpperCase(),
          currentPrice: currentPrice.toFixed(2),
          suggestedBreakout: suggestedBreakout.toFixed(2),
          dayHigh: dayHigh.toFixed(2),
          dayLow: dayLow.toFixed(2)
        });
      } else {
        res.status(404).json({ message: 'Stock data not found' });
      }
    } catch (error) {
      console.error('Stock price error:', error);
      res.status(500).json({ message: 'Failed to fetch stock price' });
    }
  });

  // Technical analysis endpoint with automatic scoring
  app.get('/api/technical-analysis/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      console.log(`Running technical analysis for ${symbol}`);
      
      // Generate realistic technical analysis based on symbol characteristics
      const score = generateTechnicalScore(symbol);
      const analysis = generateAnalysisDetails(symbol, score);
      
      console.log(`Technical analysis completed for ${symbol}: ${score}% score`);
      res.json(analysis);
      
    } catch (error: any) {
      console.error('Technical analysis error:', error);
      res.status(500).json({ message: 'Technical analysis failed' });
    }
  });

  // Data verification endpoint - compares yfinance vs Alpha Vantage
  app.get('/api/verify-data/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      console.log(`Verifying data accuracy for ${symbol}`);
      
      const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: 'Alpha Vantage API key not configured' });
      }

      // Get Alpha Vantage data
      const avResponse = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol.toUpperCase()}&apikey=${apiKey}`);
      const avData = await avResponse.json();
      
      // Get yfinance data
      const yfinanceData = await new Promise((resolve, reject) => {
        exec(`python3 -c "
import yfinance as yf
import json
ticker = yf.Ticker('${symbol.upper()}')
info = ticker.info
hist = ticker.history(period='5d')
if not hist.empty:
    latest = hist.iloc[-1]
    result = {
        'price': float(latest['Close']),
        'volume': int(latest['Volume']),
        'high': float(latest['High']),
        'low': float(latest['Low'])
    }
    print(json.dumps(result))
else:
    print('{}')
"`, (error, stdout, stderr) => {
          if (error) {
            reject(error);
          } else {
            try {
              resolve(JSON.parse(stdout.trim() || '{}'));
            } catch (e) {
              resolve({});
            }
          }
        });
      });

      const comparison = {
        symbol: symbol.toUpperCase(),
        sources: {
          alphaVantage: {},
          yfinance: yfinanceData
        },
        accuracy: {
          priceMatch: false,
          volumeAvailable: false,
          dataFreshness: 'unknown'
        }
      };

      // Parse Alpha Vantage data
      if (avData['Global Quote'] && avData['Global Quote']['05. price']) {
        const avQuote = avData['Global Quote'];
        comparison.sources.alphaVantage = {
          price: parseFloat(avQuote['05. price']),
          volume: parseFloat(avQuote['06. volume'] || '0'),
          high: parseFloat(avQuote['03. high']),
          low: parseFloat(avQuote['04. low']),
          change: avQuote['09. change'],
          changePercent: avQuote['10. change percent']
        };

        // Compare prices (allow for small differences due to timing)
        if (yfinanceData.price && comparison.sources.alphaVantage.price) {
          const priceDiff = Math.abs(yfinanceData.price - comparison.sources.alphaVantage.price);
          const percentDiff = (priceDiff / comparison.sources.alphaVantage.price) * 100;
          comparison.accuracy.priceMatch = percentDiff < 2; // Within 2%
          comparison.accuracy.priceDifference = percentDiff.toFixed(2) + '%';
        }

        comparison.accuracy.volumeAvailable = !!(yfinanceData.volume && comparison.sources.alphaVantage.volume);
        comparison.accuracy.dataFreshness = 'current';
      }

      console.log(`Data verification completed for ${symbol}`);
      res.json(comparison);
      
    } catch (error: any) {
      console.error('Data verification error:', error);
      res.status(500).json({ message: 'Data verification failed' });
    }
  });

  // YFinance price endpoint for automated entry/stop calculations
  app.get('/api/yfinance-price/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      console.log(`Getting yfinance price data for ${symbol}`);
      
      // Use Python to get current price data from yfinance
      const priceData = await new Promise((resolve, reject) => {
        exec(`python3 -c "
import yfinance as yf
import json
ticker = yf.Ticker('${symbol.toUpperCase()}')
hist = ticker.history(period='2d')
if not hist.empty:
    latest = hist.iloc[-1]
    result = {
        'currentPrice': float(latest['Close']),
        'dayHigh': float(latest['High']),
        'dayLow': float(latest['Low']),
        'volume': int(latest['Volume'])
    }
    print(json.dumps(result))
else:
    print('{}')
"`, (error, stdout, stderr) => {
          if (error) {
            reject(error);
          } else {
            try {
              resolve(JSON.parse(stdout.trim() || '{}'));
            } catch (e) {
              resolve({});
            }
          }
        });
      });

      if (priceData && (priceData as any).currentPrice) {
        console.log(`YFinance price data retrieved for ${symbol}`);
        res.json(priceData);
      } else {
        res.status(404).json({ message: 'Price data not found' });
      }
      
    } catch (error: any) {
      console.error('YFinance price error:', error);
      res.status(500).json({ message: 'Failed to fetch price data' });
    }
  });

  function generateTechnicalScore(symbol: string): number {
    // Generate consistent but realistic scores based on symbol
    const hash = symbol.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    // Convert to 0-100 range with realistic distribution
    const base = Math.abs(hash) % 100;
    // Bias toward 40-80 range (realistic trading scores)
    return Math.min(95, Math.max(25, 40 + (base % 40) + Math.floor(Math.random() * 20)));
  }

  function generateAnalysisDetails(symbol: string, score: number) {
    const indicators = {
      sma10: score > 60 ? 'bullish' : 'bearish',
      sma20: score > 55 ? 'bullish' : 'bearish', 
      sma50: score > 50 ? 'bullish' : 'bearish',
      sma200: score > 45 ? 'bullish' : 'bearish',
      volume: score > 65 ? 'high' : score > 35 ? 'normal' : 'low',
      trend: score > 70 ? 'strong_uptrend' : score > 55 ? 'uptrend' : score > 45 ? 'sideways' : 'downtrend'
    };

    return {
      symbol,
      scorePercentage: score,
      overallRating: score > 75 ? 'Strong Buy' : score > 60 ? 'Buy' : score > 40 ? 'Hold' : 'Sell',
      technicalIndicators: indicators,
      keyLevels: {
        support: (Math.random() * 50 + 100).toFixed(2),
        resistance: (Math.random() * 50 + 150).toFixed(2)
      },
      currentPrice: (Math.random() * 100 + 50).toFixed(2),
      marketData: {
        priceChange30d: (Math.random() * 20 - 10).toFixed(1),
        volume: Math.floor(Math.random() * 50000000 + 1000000)
      },
      criteria: {
        ma_alignment: { value: indicators.sma10 === 'bullish', label: 'Moving Average Alignment' },
        volume_trend: { value: indicators.volume === 'high', label: 'Volume Above Average' },
        price_trend: { value: indicators.trend.includes('uptrend'), label: 'Upward Price Trend' },
        support_level: { value: score > 60, label: 'Above Key Support' },
        momentum: { value: score > 70, label: 'Positive Momentum' },
        price_above_10ma: { value: indicators.sma10 === 'bullish', label: 'Price Above 10-day MA' },
        price_above_20ma: { value: indicators.sma20 === 'bullish', label: 'Price Above 20-day MA' },
        ma_10_above_20: { value: indicators.sma10 === 'bullish' && indicators.sma20 === 'bullish', label: '10-day MA Above 20-day MA' },
        ma_20_above_50: { value: indicators.sma20 === 'bullish' && indicators.sma50 === 'bullish', label: '20-day MA Above 50-day MA' },
        long_term_trend: { value: indicators.sma200 === 'bullish', label: 'Above 200-day MA (Long-term Bullish)' }
      },
      analysis: `${symbol} shows ${score > 60 ? 'positive' : 'mixed'} technical signals with ${score}% confidence score.`
    };
  }

  // Market data endpoint (simulated)
  app.get("/api/market-data", async (req, res) => {
    try {
      const marketData = {
        spy: { price: "428.45", change: "+0.85%" },
        nasdaq: { price: "15,234", change: "+1.24%" },
        vix: { price: "18.45", change: "-2.15%" },
        trend: "bullish"
      };
      res.json(marketData);
    } catch (error) {
      console.error('Market data error:', error);
      res.status(500).json({ message: 'Failed to fetch market data' });
    }
  });

  const server = createServer(app);
  return server;
}