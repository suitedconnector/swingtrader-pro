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
    try:
        # Get S&P 500 list from Wikipedia (most comprehensive free source)
        tables = pd.read_html('https://en.wikipedia.org/wiki/List_of_S%26P_500_companies')
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
        # Fallback to major stocks if Wikipedia fails
        return [
            'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA', 'JPM', 'BAC', 'V',
            'MA', 'UNH', 'JNJ', 'HD', 'WMT', 'PG', 'KO', 'PFE', 'ABBV', 'MRK',
            'COST', 'TMO', 'ABT', 'CVX', 'XOM', 'LLY', 'AVGO', 'WFC', 'CRM', 'ORCL',
            'ADBE', 'NKE', 'DHR', 'VZ', 'NEE', 'TXN', 'BMY', 'PM', 'RTX', 'HON',
            'QCOM', 'UPS', 'LOW', 'AMD', 'SBUX', 'IBM', 'T', 'CAT', 'GS', 'INTU',
            'ISRG', 'CVS', 'MDT', 'GE', 'DE', 'MMM', 'AXP', 'BA', 'AMGN', 'BLK',
            'SYK', 'TJX', 'BKNG', 'ADP', 'MDLZ', 'GILD', 'ADI', 'CI', 'ZTS', 'MO',
            'CB', 'USB', 'DUK', 'SO', 'CL', 'LRCX', 'TGT', 'BDX', 'AON', 'EL',
            'SCHW', 'NSC', 'ITW', 'HUM', 'BSX', 'MMC', 'ETN', 'PLD', 'APD', 'EOG',
            'ICE', 'FIS', 'EMR', 'KLAC', 'CSX', 'FCX', 'SHW', 'PNC', 'GM', 'F'
        ]

def main():
    # Scan the entire S&P 500 market for comprehensive coverage
    symbols = get_sp500_symbols()
    print(f"Scanning {len(symbols)} stocks from the market...", file=sys.stderr)
    
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