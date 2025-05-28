import { MailService } from '@sendgrid/mail';

const isEmailEnabled = !!process.env.SENDGRID_API_KEY;

const mailService = new MailService();
if (isEmailEnabled) {
  mailService.setApiKey(process.env.SENDGRID_API_KEY!);
}

interface PriceAlertEmailParams {
  to: string;
  symbol: string;
  currentPrice: number;
  targetPrice: number;
  alertType: 'breakout' | 'breakdown';
  changePercent: number;
}

export async function sendPriceAlertEmail(params: PriceAlertEmailParams): Promise<boolean> {
  if (!isEmailEnabled) {
    console.log('Email service disabled - SENDGRID_API_KEY not configured');
    return false;
  }

  try {
    const { to, symbol, currentPrice, targetPrice, alertType, changePercent } = params;
    
    const subject = `🚨 ${symbol} ${alertType.toUpperCase()} Alert - $${currentPrice}`;
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1f2937; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">📈 Trading Alert</h1>
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
                📱 <strong>Mobile Alert Tip:</strong> Forward this email to your carrier's SMS gateway:<br>
                • Verizon: yourphone@vtext.com<br>
                • AT&T: yourphone@txt.att.net<br>
                • T-Mobile: yourphone@tmomail.net
              </p>
            </div>
          </div>
        </div>
        
        <div style="background: #1f2937; color: #9ca3af; padding: 15px; text-align: center; font-size: 12px;">
          <p style="margin: 0;">Trading Dashboard - Automated Price Alert</p>
          <p style="margin: 0;">Time: ${new Date().toLocaleString()}</p>
        </div>
      </div>
    `;

    const textContent = `
${symbol} ${alertType.toUpperCase()} ALERT

Current Price: $${currentPrice}
Target: $${targetPrice}
Change: ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%

${alertType === 'breakout' 
  ? `${symbol} has broken above your target price of $${targetPrice}. Consider reviewing your trading plan.`
  : `${symbol} has fallen below your target price of $${targetPrice}. Review your stop loss strategy.`
}

Time: ${new Date().toLocaleString()}

Mobile Tip: Forward this email to your carrier's SMS gateway for text alerts.
    `;

    await mailService.send({
      to: to,
      from: 'alerts@yourtradingapp.com', // You'll need to verify this domain with SendGrid
      subject: subject,
      text: textContent,
      html: htmlContent,
    });

    console.log(`Price alert email sent to ${to} for ${symbol} ${alertType}`);
    return true;
    
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
}

// Test email function
export async function sendTestAlert(email: string): Promise<boolean> {
  return await sendPriceAlertEmail({
    to: email,
    symbol: 'IBM',
    currentPrice: 263.23,
    targetPrice: 263.00,
    alertType: 'breakout',
    changePercent: 2.1
  });
}