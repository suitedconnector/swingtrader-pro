const { exec } = require('child_process');

function runYfinanceAnalysis(symbol) {
  return new Promise((resolve, reject) => {
    const pythonPath = '/home/runner/workspace/.pythonlibs/bin/python3';
    const scriptPath = './server/technical_analysis.py';
    const command = `${pythonPath} ${scriptPath} ${symbol.toUpperCase()}`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`yfinance script error: ${error.message}`);
        reject(new Error('Technical analysis failed'));
        return;
      }
      
      if (stderr) {
        console.error(`yfinance stderr: ${stderr}`);
      }
      
      try {
        const result = JSON.parse(stdout.trim());
        
        if (result.error) {
          console.log(`Analysis error for ${symbol}:`, result.error);
          reject(new Error(result.error));
          return;
        }
        
        console.log(`yfinance analysis completed for ${symbol}: ${result.scorePercentage}% score`);
        resolve(result);
      } catch (parseError) {
        console.error('Failed to parse yfinance output:', parseError);
        console.error('Raw output:', stdout);
        reject(new Error('Failed to parse analysis results'));
      }
    });
  });
}

module.exports = { runYfinanceAnalysis };