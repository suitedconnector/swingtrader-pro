#!/usr/bin/env python3
import yfinance as yf
import json
import sys

def scan_stock(symbol):
    """Scan a single stock for momentum"""
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period='30d')
        
        if hist.empty:
            return None
            
        latest = hist.iloc[-1]
        first = hist.iloc[0]
        change_pct = ((latest['Close'] - first['Close']) / first['Close']) * 100
        
        info = ticker.info
        sector = info.get('sector', 'Unknown')
        
        price = float(latest['Close'])
        volume = int(latest['Volume'])
        dollar_volume = price * volume
        
        result = {
            'symbol': symbol,
            'price': price,
            'volume': volume,
            'change_percent': float(change_pct),
            'sector': sector,
            'dollar_volume': dollar_volume
        }
        
        # Apply ALL of Morgan's swing trading criteria
        # 1. Price Movement > 5% gain (30-day momentum)
        if change_pct <= 5:
            return None
            
        # 2. Volume > 500,000 shares (liquidity requirement)
        if volume <= 500000:
            return None
            
        # 3. Dollar Volume > $5M (institutional interest)
        if dollar_volume <= 5000000:
            return None
            
        # 4. Exclude biotechnology stocks (high volatility sector)
        if 'biotech' in sector.lower() or 'biotechnology' in sector.lower():
            return None
            
        # 5. Price > $10 (avoid penny stocks)
        if price <= 10:
            return None
            
        return result
            
    except Exception as e:
        print(f"Error scanning {symbol}: {e}", file=sys.stderr)
        return None

def get_sp500_symbols():
    """Get S&P 500 symbols as a proxy for the market"""
    import pandas as pd
    import urllib.request
    try:
        # Get S&P 500 list from Wikipedia with proper User-Agent
        url = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})
        with urllib.request.urlopen(req, timeout=10) as response:
            html = response.read().decode('utf-8')
        tables = pd.read_html(html)
        sp500_table = tables[0]
        symbols = sp500_table['Symbol'].tolist()
        # Clean symbols (remove dots, handle special cases)
        cleaned_symbols = []
        for symbol in symbols:
            if '.' in symbol:
                symbol = symbol.replace('.', '-')
            cleaned_symbols.append(symbol)
        return cleaned_symbols
    except Exception as e:
        print(f"Could not fetch S&P 500 list: {e}", file=sys.stderr)
        # Fallback: mix of momentum stocks, growth stocks, and volatile sectors
        # These tend to have higher price movement for swing trading
        return [
            # High-momentum tech/growth
            'NVDA', 'AMD', 'TSLA', 'META', 'SMCI', 'ARM', 'PLTR', 'SNOW', 'DDOG', 'NET',
            'CRWD', 'COIN', 'MSTR', 'AVGO', 'ANET', 'PANW', 'MU', 'MRVL', 'NFLX', 'UBER',
            # Semiconductors (volatile)
            'ASML', 'KLAC', 'LRCX', 'AMAT', 'ON', 'TXN', 'INTC', 'QCOM', 'MPWR', 'SWKS',
            # Energy (volatile)
            'XOM', 'CVX', 'OXY', 'EOG', 'SLB', 'HAL', 'DVN', 'MPC', 'VLO', 'PSX',
            # Financials
            'JPM', 'GS', 'MS', 'SCHW', 'C', 'BAC', 'WFC', 'BLK', 'AXP', 'COF',
            # Consumer/Retail
            'AMZN', 'COST', 'TGT', 'HD', 'LOW', 'NKE', 'SBUX', 'CMG', 'LULU', 'DECK',
            # Healthcare (non-biotech)
            'UNH', 'LLY', 'ISRG', 'BSX', 'SYK', 'DHR', 'TMO', 'ABT', 'MDT', 'ZTS',
            # Industrial
            'CAT', 'DE', 'BA', 'GE', 'RTX', 'HON', 'UPS', 'FDX', 'LMT', 'NOC',
            # Large cap stable (reference)
            'AAPL', 'MSFT', 'GOOGL', 'V', 'MA', 'JNJ', 'PG', 'KO', 'MRK', 'WMT'
        ]

def main():
    # Scan the market for swing trading opportunities
    symbols = get_sp500_symbols()
    max_stocks = 50  # Scan 50 stocks for better coverage of strong gainers
    print(f"Scanning {min(len(symbols), max_stocks)} stocks from the market...", file=sys.stderr)
    
    qualifying = []
    processed = 0
    
    for symbol in symbols[:max_stocks]:
        processed += 1
        print(f"Scanning {symbol}...", file=sys.stderr)
        result = scan_stock(symbol)
        if result:
            qualifying.append(result)
            print(f"✓ {symbol}: {result['change_percent']:.1f}%", file=sys.stderr)
        else:
            print(f"✗ {symbol}: Filtered out", file=sys.stderr)
    
    # Output results as JSON
    print(json.dumps(qualifying))

if __name__ == "__main__":
    main()