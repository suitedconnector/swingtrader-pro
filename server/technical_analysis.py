#!/usr/bin/env python3
import yfinance as yf
import pandas as pd
import numpy as np
import json
import sys
from datetime import datetime, timedelta

def calculate_sma(prices, period):
    """Calculate Simple Moving Average"""
    return prices.rolling(window=period).mean()

def analyze_stock(symbol):
    """Perform comprehensive technical analysis on a stock"""
    try:
        # Get stock data
        stock = yf.Ticker(symbol)
        
        # Get 1 year of daily data for moving averages
        end_date = datetime.now()
        start_date = end_date - timedelta(days=365)
        
        hist = stock.history(start=start_date, end=end_date)
        
        if hist.empty or len(hist) < 50:
            return {"error": "Insufficient data for analysis"}
        
        # Current price
        current_price = float(hist['Close'].iloc[-1])
        
        # Calculate moving averages
        hist['SMA_10'] = calculate_sma(hist['Close'], 10)
        hist['SMA_20'] = calculate_sma(hist['Close'], 20)
        hist['SMA_50'] = calculate_sma(hist['Close'], 50)
        hist['SMA_200'] = calculate_sma(hist['Close'], 200)
        
        # Get latest values
        sma_10 = float(hist['SMA_10'].iloc[-1]) if not pd.isna(hist['SMA_10'].iloc[-1]) else None
        sma_20 = float(hist['SMA_20'].iloc[-1]) if not pd.isna(hist['SMA_20'].iloc[-1]) else None
        sma_50 = float(hist['SMA_50'].iloc[-1]) if not pd.isna(hist['SMA_50'].iloc[-1]) else None
        sma_200 = float(hist['SMA_200'].iloc[-1]) if not pd.isna(hist['SMA_200'].iloc[-1]) else None
        
        # Volume analysis
        volume = float(hist['Volume'].iloc[-1])
        avg_volume_20 = float(hist['Volume'].rolling(20).mean().iloc[-1])
        
        # Price change calculations
        price_30d_ago = float(hist['Close'].iloc[-min(30, len(hist))])
        price_change_30d = ((current_price - price_30d_ago) / price_30d_ago) * 100
        
        # Technical scoring criteria
        criteria = {}
        score = 0
        max_score = 0
        
        # Price above moving averages (higher weight for longer averages)
        if sma_10:
            criteria['above_10sma'] = {
                'value': current_price > sma_10,
                'description': f'Price above 10-day SMA (${sma_10:.2f})',
                'weight': 1
            }
            if current_price > sma_10:
                score += 1
            max_score += 1
        
        if sma_20:
            criteria['above_20sma'] = {
                'value': current_price > sma_20,
                'description': f'Price above 20-day SMA (${sma_20:.2f})',
                'weight': 1
            }
            if current_price > sma_20:
                score += 1
            max_score += 1
        
        if sma_50:
            criteria['above_50sma'] = {
                'value': current_price > sma_50,
                'description': f'Price above 50-day SMA (${sma_50:.2f})',
                'weight': 2
            }
            if current_price > sma_50:
                score += 2
            max_score += 2
        
        if sma_200:
            criteria['above_200sma'] = {
                'value': current_price > sma_200,
                'description': f'Price above 200-day SMA (${sma_200:.2f})',
                'weight': 3
            }
            if current_price > sma_200:
                score += 3
            max_score += 3
        
        # Moving average alignment (bullish when shorter > longer)
        if sma_10 and sma_20:
            criteria['sma_alignment_short'] = {
                'value': sma_10 > sma_20,
                'description': '10-day SMA above 20-day SMA',
                'weight': 1
            }
            if sma_10 > sma_20:
                score += 1
            max_score += 1
        
        if sma_50 and sma_200:
            criteria['sma_alignment_long'] = {
                'value': sma_50 > sma_200,
                'description': '50-day SMA above 200-day SMA (Golden Cross)',
                'weight': 2
            }
            if sma_50 > sma_200:
                score += 2
            max_score += 2
        
        # Volume strength
        criteria['volume_strength'] = {
            'value': volume > avg_volume_20 * 1.2,
            'description': f'Volume above 20-day average ({volume/1000000:.1f}M vs {avg_volume_20/1000000:.1f}M)',
            'weight': 1
        }
        if volume > avg_volume_20 * 1.2:
            score += 1
        max_score += 1
        
        # Price momentum (30-day performance)
        criteria['positive_momentum'] = {
            'value': price_change_30d > 5,
            'description': f'Positive 30-day momentum ({price_change_30d:.1f}%)',
            'weight': 1
        }
        if price_change_30d > 5:
            score += 1
        max_score += 1
        
        # Calculate score percentage
        score_percentage = (score / max_score * 100) if max_score > 0 else 0
        
        return {
            'symbol': symbol.upper(),
            'currentPrice': round(current_price, 2),
            'technicalScore': score,
            'maxScore': max_score,
            'scorePercentage': round(score_percentage, 1),
            'criteria': criteria,
            'marketData': {
                'sma10': round(sma_10, 2) if sma_10 else None,
                'sma20': round(sma_20, 2) if sma_20 else None,
                'sma50': round(sma_50, 2) if sma_50 else None,
                'sma200': round(sma_200, 2) if sma_200 else None,
                'volume': int(volume),
                'avgVolume20': int(avg_volume_20),
                'priceChange30d': round(price_change_30d, 1)
            }
        }
        
    except Exception as e:
        return {"error": f"Analysis failed: {str(e)}"}

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Usage: python technical_analysis.py <SYMBOL>"}))
        sys.exit(1)
    
    symbol = sys.argv[1]
    result = analyze_stock(symbol)
    print(json.dumps(result))