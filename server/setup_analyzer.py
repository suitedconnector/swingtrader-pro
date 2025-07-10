#!/usr/bin/env python3
"""
Setup Analysis Engine
Replaces TC2000 functionality for identifying swing trading setups
"""

import yfinance as yf
import pandas as pd
import numpy as np
import sys
from datetime import datetime, timedelta
import json

def convert_numpy_types(obj):
    """Convert numpy types to Python native types for JSON serialization"""
    if isinstance(obj, (np.integer, np.int64, np.int32)):
        return int(obj)
    elif isinstance(obj, (np.floating, np.float64, np.float32)):
        return float(obj)
    elif isinstance(obj, (np.bool_, np.bool)):
        return bool(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, dict):
        return {key: convert_numpy_types(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_numpy_types(item) for item in obj]
    else:
        return obj

def calculate_adr(hist_data, period=20):
    """Calculate Average Daily Range (ADR) percentage"""
    if len(hist_data) < period:
        return 0
    
    daily_ranges = ((hist_data['High'] - hist_data['Low']) / hist_data['Close']) * 100
    return daily_ranges.tail(period).mean()

def analyze_moving_averages(hist_data):
    """Analyze moving average alignment and trends"""
    if len(hist_data) < 200:
        return None
    
    # Calculate SMAs
    sma_10 = hist_data['Close'].rolling(window=10).mean()
    sma_20 = hist_data['Close'].rolling(window=20).mean()
    sma_50 = hist_data['Close'].rolling(window=50).mean()
    sma_200 = hist_data['Close'].rolling(window=200).mean()
    
    current_price = hist_data['Close'].iloc[-1]
    current_sma_10 = sma_10.iloc[-1]
    current_sma_20 = sma_20.iloc[-1]
    current_sma_50 = sma_50.iloc[-1]
    current_sma_200 = sma_200.iloc[-1]
    
    # Check alignment (10 > 20 > 50 > 200)
    perfect_alignment = (current_sma_10 > current_sma_20 > current_sma_50 > current_sma_200)
    
    # Check if moving averages are inclining
    sma_10_inclining = sma_10.iloc[-1] > sma_10.iloc[-5]
    sma_20_inclining = sma_20.iloc[-1] > sma_20.iloc[-5]
    sma_50_inclining = sma_50.iloc[-1] > sma_50.iloc[-10]
    sma_200_inclining = sma_200.iloc[-1] > sma_200.iloc[-20]
    
    return {
        'current_price': current_price,
        'sma_10': current_sma_10,
        'sma_20': current_sma_20,
        'sma_50': current_sma_50,
        'sma_200': current_sma_200,
        'perfect_alignment': perfect_alignment,
        'price_above_10': current_price > current_sma_10,
        'price_above_20': current_price > current_sma_20,
        'price_above_50': current_price > current_sma_50,
        'price_above_200': current_price > current_sma_200,
        'sma_10_inclining': sma_10_inclining,
        'sma_20_inclining': sma_20_inclining,
        'sma_50_inclining': sma_50_inclining,
        'sma_200_inclining': sma_200_inclining
    }

def analyze_range_structure(hist_data, lookback_days=20):
    """Analyze if stock is building an orderly range with higher lows"""
    if len(hist_data) < lookback_days:
        return None
    
    recent_data = hist_data.tail(lookback_days)
    
    # Find swing highs and lows
    highs = recent_data['High']
    lows = recent_data['Low']
    
    # Check for higher lows pattern
    recent_lows = lows.tail(10)
    higher_lows = True
    for i in range(1, len(recent_lows)):
        if recent_lows.iloc[i] < recent_lows.iloc[i-1]:
            higher_lows = False
            break
    
    # Check for tightening range (lower highs or flat tops)
    recent_highs = highs.tail(10)
    range_tightening = recent_highs.iloc[-1] <= recent_highs.iloc[0]
    
    # Calculate range metrics
    range_high = recent_data['High'].max()
    range_low = recent_data['Low'].min()
    range_size = ((range_high - range_low) / range_low) * 100
    
    return {
        'higher_lows': higher_lows,
        'range_tightening': range_tightening,
        'range_high': range_high,
        'range_low': range_low,
        'range_size_percent': range_size,
        'current_position_in_range': ((hist_data['Close'].iloc[-1] - range_low) / (range_high - range_low)) * 100
    }

def analyze_volume_pattern(hist_data, lookback_days=20):
    """Analyze volume patterns during consolidation"""
    if len(hist_data) < lookback_days:
        return None
    
    recent_data = hist_data.tail(lookback_days)
    avg_volume = hist_data['Volume'].tail(50).mean()
    
    # Check if volume is drying up during consolidation
    recent_avg_volume = recent_data['Volume'].mean()
    volume_drying_up = recent_avg_volume < (avg_volume * 0.8)
    
    # Count thin volume days (below 50% of average)
    thin_volume_days = len(recent_data[recent_data['Volume'] < (avg_volume * 0.5)])
    
    return {
        'avg_volume_50d': avg_volume,
        'recent_avg_volume': recent_avg_volume,
        'volume_drying_up': volume_drying_up,
        'thin_volume_days': thin_volume_days,
        'volume_ratio': recent_avg_volume / avg_volume if avg_volume > 0 else 0
    }

def identify_breakout_levels(hist_data, lookback_days=20):
    """Identify potential breakout levels"""
    if len(hist_data) < lookback_days:
        return None
    
    recent_data = hist_data.tail(lookback_days)
    
    # Key breakout levels
    previous_day_high = hist_data['High'].iloc[-2]
    range_high = recent_data['High'].max()
    resistance_level = recent_data['High'].nlargest(3).mean()  # Average of top 3 highs
    
    current_price = hist_data['Close'].iloc[-1]
    
    # Distance to breakout levels
    distance_to_prev_high = ((previous_day_high - current_price) / current_price) * 100
    distance_to_range_high = ((range_high - current_price) / current_price) * 100
    
    return {
        'previous_day_high': previous_day_high,
        'range_high': range_high,
        'resistance_level': resistance_level,
        'distance_to_prev_high_percent': distance_to_prev_high,
        'distance_to_range_high_percent': distance_to_range_high,
        'near_breakout': abs(distance_to_prev_high) < 2 or abs(distance_to_range_high) < 2
    }

def calculate_setup_score(symbol, ma_analysis, range_analysis, volume_analysis, breakout_analysis, adr):
    """Calculate overall setup quality score"""
    score = 0
    max_score = 100
    
    # Moving Average Score (30 points)
    if ma_analysis:
        if ma_analysis['perfect_alignment']:
            score += 15
        elif ma_analysis['price_above_20'] and ma_analysis['price_above_50']:
            score += 10
        elif ma_analysis['price_above_20']:
            score += 5
        
        inclining_count = sum([ma_analysis['sma_10_inclining'], ma_analysis['sma_20_inclining'], 
                              ma_analysis['sma_50_inclining'], ma_analysis['sma_200_inclining']])
        score += inclining_count * 3  # 3 points per inclining MA
    
    # Range Structure Score (25 points)
    if range_analysis:
        if range_analysis['higher_lows']:
            score += 10
        if range_analysis['range_tightening']:
            score += 8
        if 3 <= range_analysis['range_size_percent'] <= 15:  # Ideal range size
            score += 7
    
    # Volume Pattern Score (20 points)
    if volume_analysis:
        if volume_analysis['volume_drying_up']:
            score += 10
        if volume_analysis['thin_volume_days'] >= 5:
            score += 5
        if 0.6 <= volume_analysis['volume_ratio'] <= 0.9:  # Ideal volume reduction
            score += 5
    
    # Breakout Proximity Score (15 points)
    if breakout_analysis:
        if breakout_analysis['near_breakout']:
            score += 15
        elif breakout_analysis['distance_to_prev_high_percent'] < 5:
            score += 8
    
    # ADR Score (10 points)
    if adr >= 5:
        score += 10
    elif adr >= 3:
        score += 5
    
    return min(score, max_score)

def analyze_setup(symbol):
    """Complete setup analysis for a stock symbol"""
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period='1y')
        
        if hist.empty or len(hist) < 50:
            return None
        
        # Get stock info
        info = ticker.info
        sector = info.get('sector', 'Unknown')
        
        # Perform all analyses
        adr = calculate_adr(hist)
        ma_analysis = analyze_moving_averages(hist)
        range_analysis = analyze_range_structure(hist)
        volume_analysis = analyze_volume_pattern(hist)
        breakout_analysis = identify_breakout_levels(hist)
        
        # Calculate setup score
        setup_score = calculate_setup_score(symbol, ma_analysis, range_analysis, 
                                          volume_analysis, breakout_analysis, adr)
        
        # Determine setup quality
        if setup_score >= 80:
            setup_quality = 'Excellent'
        elif setup_score >= 65:
            setup_quality = 'Good'
        elif setup_score >= 50:
            setup_quality = 'Fair'
        else:
            setup_quality = 'Poor'
        
        return {
            'symbol': symbol,
            'sector': sector,
            'setup_score': setup_score,
            'setup_quality': setup_quality,
            'adr_percent': round(adr, 2),
            'moving_averages': ma_analysis,
            'range_structure': range_analysis,
            'volume_pattern': volume_analysis,
            'breakout_levels': breakout_analysis,
            'analysis_date': datetime.now().isoformat()
        }
        
    except Exception as e:
        print(f"Error analyzing setup for {symbol}: {e}", file=sys.stderr)
        return None

def main():
    if len(sys.argv) < 2:
        print("Usage: python setup_analyzer.py <symbol>")
        sys.exit(1)
    
    symbol = sys.argv[1].upper()
    result = analyze_setup(symbol)
    
    if result:
        # Convert numpy types before JSON serialization
        result = convert_numpy_types(result)
        print(json.dumps(result, indent=2))
    else:
        print(json.dumps({"error": f"Could not analyze setup for {symbol}"}))

if __name__ == "__main__":
    main()