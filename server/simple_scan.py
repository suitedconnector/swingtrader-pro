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

def get_momentum_symbols():
    """Return a hardcoded list of momentum tickers to scan."""
    return ['PLTR', 'NVDA', 'MSTR', 'RGTI', 'QBTS', 'PRCH', 'ROOT', 'LMND', 'TSLA', 'AMD', 'ARM', 'COIN', 'CRWD', 'SMCI', 'AVGO']

def main():
    # Scan the selected momentum tickers for swing trading opportunities
    symbols = get_momentum_symbols()
    print(f"Scanning {len(symbols)} stocks from the momentum list...", file=sys.stderr)
    
    qualifying = []
    processed = 0
    
    for symbol in symbols:
        processed += 1
        print(f"Scanning {symbol}...", file=sys.stderr)
        result = scan_stock(symbol)
        if result:
            qualifying.append(result)
            print(f"✓ {symbol}: {result['change_percent']:.1f}%", file=sys.stderr)
        else:
            print(f"✗ {symbol}: Filtered out", file=sys.stderr)
    
    # Sort qualifying results by change_percent in descending order
    qualifying.sort(key=lambda x: x.get('change_percent', 0), reverse=True)

    # Output results as JSON
    print(json.dumps(qualifying))

if __name__ == "__main__":
    main()
