import json
import os
import time
import requests
import tempfile
import fcntl
import pandas_market_calendars as mcal
from datetime import datetime, timedelta

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_FILE = os.path.join(PROJECT_ROOT, "data", "cache", "historical_daily.json")
LOCK_FILE = os.path.join(PROJECT_ROOT, "data", "cache", "cache.lock")
MIN_INTERVAL = 15 # Seconds

def get_last_market_session():
    nyse = mcal.get_calendar('NYSE')
    schedule = nyse.schedule(start_date=datetime.now()-timedelta(days=30), end_date=datetime.now())
    # The last session is the last entry in the schedule
    last_session = schedule.iloc[-1].market_close.to_pydatetime().date()
    # If today is before close, maybe use previous day? For simplicity, using last close date.
    # Adjust for current time if needed
    if last_session > datetime.now().date():
        # Get previous session
        schedule = nyse.schedule(start_date=datetime.now()-timedelta(days=30), end_date=datetime.now())
        last_session = schedule.iloc[-1].market_close.to_pydatetime().date()
    return last_session.strftime('%Y-%m-%d')

def load_cache():
    if not os.path.exists(CACHE_FILE): return {}
    try:
        with open(CACHE_FILE, 'r') as f:
            return json.load(f)
    except: return {}

def save_cache(data):
    fd, temp_path = tempfile.mkstemp(dir=os.path.dirname(CACHE_FILE))
    with os.fdopen(fd, 'w') as f:
        json.dump(data, f)
    os.replace(temp_path, CACHE_FILE)
    os.chmod(CACHE_FILE, 0o644)

def safe_api_request(url):
    retries = 3
    for attempt in range(retries):
        response = requests.get(url, timeout=15)
        if response.status_code == 429:
            wait = int(response.headers.get("Retry-After", 15))
            time.sleep(wait)
            continue
        return response
    return None

def refresh_ticker(symbol, api_key):
    time.sleep(MIN_INTERVAL)
    url = f"https://api.polygon.io/v2/aggs/ticker/{symbol.upper()}/range/1/day/2026-08-01/2026-11-03?adjusted=true&sort=asc&apiKey={api_key}"
    response = safe_api_request(url)
    if response and response.status_code == 200:
        return response.json().get("results", [])
    return None

def sync_cache(tickers, api_key):
    # Ensure dir exists and is accessible
    os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
    
    with open(LOCK_FILE, 'a+') as f:
        try:
            fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print("Refresh already in progress")
            return

        cache = load_cache()
        last_session = get_last_market_session()
        
        for symbol in tickers:
            entry = cache.get(symbol, {})
            if entry.get("last_updated") == last_session:
                continue
            
            data = refresh_ticker(symbol, api_key)
            if data:
                cache[symbol] = {"last_updated": last_session, "data": data}
                save_cache(cache)
                print(f"Updated {symbol}")
        
        fcntl.flock(f, fcntl.LOCK_UN)
