import nodemailer from 'nodemailer';

interface PriceAlertEmailParams {
  to: string;
  symbol: string;
  currentPrice: number;
  targetPrice: number;
  alertType: 'breakout' | 'breakdown';
  changePercent: number;
}

// Gmail SMTP configuration
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: 'tfrei320@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD // You'll need to generate this
  }
});

export async function sendGmailAlert(params: PriceAlertEmailParams): Promise<boolean> {
  if (!process.env.GMAIL_APP_PASSWORD) {
    console.log('Gmail app password not configured');
    return false;
  }

  try {
    const { to, symbol, currentPrice, targetPrice, alertType, changePercent } = params;
    
    const subject = `🚨 ${symbol} ${alertType.toUpperCase()} Alert - $${currentPrice}`;
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1f2937; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">📈 Trezian Trading Alert</h1>
        </div>
        
        <div style="padding: 30px; background: #f9fafb;">
          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid ${alertType === 'breakout' ? '#10b981' : '#ef4444'};">
            <h2 style="color: #1f2937; margin-top: 0;">${symbol} ${alertType === 'breakout' ? 'BREAKOUT' : 'BREAKDOWN'}</h2>
            
            <div style="font-size: 18px; margin: 15px 0;">
              <strong>Current Price:</strong> <span style="color: ${changePercent > 0 ? '#10b981' : '#ef4444'}; font-weight: bold;">$${currentPrice}</span>
            </div>
            
            <div style="font-size: 16px; margin: 10px 0;">
              <strong>Target:</strong> $${targetPrice}
            </div>
            
            <div style="font-size: 16px; margin: 10px 0;">
              <strong>Change:</strong> <span style="color: ${changePercent > 0 ? '#10b981' : '#ef4444'};">${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%</span>
            </div>
            
            <div style="margin: 20px 0; padding: 15px; background: ${alertType === 'breakout' ? '#ecfdf5' : '#fef2f2'}; border-radius: 6px;">
              <p style="margin: 0; color: #374151;">
                ${alertType === 'breakout' 
                  ? `${symbol} has broken above your target price of $${targetPrice}. Consider reviewing your trading plan.`
                  : `${symbol} has fallen below your target price of $${targetPrice}. Review your stop loss strategy.`
                }
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 25px;">
              <p style="color: #6b7280; font-size: 14px;">
                📱 <strong>Mobile Alert Tip:</strong> Forward this email to your carrier's SMS gateway for instant text alerts.
              </p>
            </div>
          </div>
        </div>
        
        <div style="background: #1f2937; color: #9ca3af; padding: 15px; text-align: center; font-size: 12px;">
          <p style="margin: 0;">Trezian Trading Dashboard - Automated Alert</p>
          <p style="margin: 0;">Time: ${new Date().toLocaleString()}</p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: '"Trezian Trading Alerts" <tfrei320@gmail.com>',
      to: to,
      subject: subject,
      html: htmlContent
    });

    console.log(`Gmail alert sent to ${to} for ${symbol} ${alertType}`);
    return true;
    
  } catch (error) {
    console.error('Gmail sending error:', error);
    return false;
  }
}

export async function sendGmailTest(email: string): Promise<boolean> {
  return await sendGmailAlert({
    to: email,
    symbol: 'IBM',
    currentPrice: 263.23,
    targetPrice: 263.00,
    alertType: 'breakout',
    changePercent: 2.1
  });
}