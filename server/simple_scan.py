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
        
        result = {
            'symbol': symbol,
            'price': float(latest['Close']),
            'volume': int(latest['Volume']),
            'change_percent': float(change_pct),
            'sector': sector
        }
        
        # Only return if meets Morgan's 3% momentum criteria
        if change_pct > 3:
            return result
        else:
            return None
            
    except Exception as e:
        print(f"Error scanning {symbol}: {e}", file=sys.stderr)
        return None

def main():
    # Scan 30 major stocks across all sectors for better coverage
    symbols = [
        # Technology Leaders
        'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA', 'CRM', 'ADBE', 'ORCL',
        # Financial Services
        'JPM', 'BAC', 'WFC', 'C', 'GS', 'V', 'MA', 'AXP', 'BRK-B', 'USB',
        # Healthcare & Consumer
        'UNH', 'JNJ', 'PFE', 'HD', 'MCD', 'NKE', 'COST', 'WMT', 'PG', 'KO'
    ]
    
    qualifying = []
    
    for symbol in symbols:
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