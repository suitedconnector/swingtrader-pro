from flask import Flask, jsonify
import os

app = Flask(__name__)
LOG_FILE = "../sniper.log"

@app.route('/api/alerts')
def get_alerts():
    if not os.path.exists(LOG_FILE):
        return jsonify({"error": "Log file not found"}), 404
    
    with open(LOG_FILE, 'r') as f:
        lines = f.readlines()[-20:] # Get last 20 lines
    
    return jsonify({"logs": [line.strip() for line in lines]})

if __name__ == '__main__':
    app.run(port=5001)
