import os
import json
import sys
import pandas as pd
import numpy as np
from api.cache_manager import load_cache
from api.technical_analysis import calculate_sma

def get_return(prices, periods):
    if len(prices) < periods + 1: return 0
    return ((prices.iloc[-1] - prices.iloc[-(periods+1)]) / prices.iloc[-(periods+1)]) * 100

def scan_all():
    cache = load_cache()
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tickers.json'), 'r') as f:
        tickers = json.load(f)
    
    results = []
    success = 0
    errors = 0
    
    for symbol in tickers:
        try:
            entry = cache.get(symbol)
            if not entry or not entry.get('data'):
                continue
            
            df = pd.DataFrame(entry['data'])
            df['c'] = df['c'].astype(float)
            df['v'] = df['v'].astype(float)
            
            price = df['c'].iloc[-1]
            vol = df['v'].iloc[-1]
            dollar_vol = price * vol
            
            # Filters
            if price < 10 or dollar_vol < 5000000:
                continue
                
            prices = df['c']
            vol_ma = df['v'].rolling(30).mean().iloc[-1]
            
            # Classifications
            classifications = []
            
            # 1. Established Momentum (>20% 30d)
            ret_30d = get_return(prices, 30)
            if ret_30d > 20:
                classifications.append("Established Momentum")
                
            # 2. Emerging Momentum (rate_5 > rate_15 > rate_10 > 0)
            if len(prices) >= 31:
                p = prices.iloc[-31:].values # Use last 31 prices
                
                # Period 1 (Latest 5): index 25 to 30
                # Period 2 (Middle 15): index 10 to 25
                # Period 3 (Earlier 10): index 0 to 10
                
                def get_rate(start, end, n):
                    if start <= 0 or end <= 0: return -1
                    return (end / start) ** (1 / n) - 1

                rate_5 = get_rate(p[25], p[30], 5)
                rate_15 = get_rate(p[10], p[25], 15)
                rate_10 = get_rate(p[0], p[10], 10)
                
                if rate_5 > rate_15 > rate_10 > 0:
                    classifications.append("Emerging Momentum")
                
            # 3. Breakout (within 2% of 30d high, volume ratio > 1)
            high_30d = prices.iloc[-30:].max()
            if price >= high_30d * 0.98 and vol > vol_ma:
                classifications.append("Breakout")
                
            # 4. Unusual Volume (vol ratio >= 1.5)
            if vol >= vol_ma * 1.5:
                classifications.append("Unusual Volume")
            
            if classifications:
                results.append({
                    "symbol": symbol,
                    "scanType": ",".join(classifications),
                    "price": str(round(price, 2)),
                    "change": "0.00",
                    "changePercent": str(round(ret_30d, 2)),
                    "volume": int(vol),
                    "dollarVolume": str(round(dollar_vol, 2))
                })
                success += 1
                
        except Exception as e:
            errors += 1
            print(f"Error processing {symbol}: {e}", file=sys.stderr)
            
    output = {
        "summary": {"success": success, "errors": errors},
        "duration": 0.5,
        "results": results
    }
    sys.stdout.write(json.dumps(output)); sys.stdout.flush()

if __name__ == "__main__":
    scan_all()
