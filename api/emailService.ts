import Mailjet from 'node-mailjet';
import { DISCLAIMER_FULL } from '../shared/disclaimer';

const isEmailEnabled = !!(process.env.MAILJET_API_KEY && process.env.MAILJET_SECRET_KEY);

const mailjet = isEmailEnabled ? Mailjet.apiConnect(
  process.env.MAILJET_API_KEY!,
  process.env.MAILJET_SECRET_KEY!
) : null;

interface PriceAlertEmailParams {
  to: string;
  symbol: string;
  currentPrice: number;
  targetPrice: number;
  alertType: 'breakout' | 'breakdown';
  changePercent: number;
}

export async function sendPriceAlertEmail(params: PriceAlertEmailParams): Promise<boolean> {
  if (!isEmailEnabled || !mailjet) {
    console.log('Email service disabled - MAILJET_API_KEY or MAILJET_SECRET_KEY not configured');
    return false;
  }

  try {
    const { to, symbol, currentPrice, targetPrice, alertType, changePercent } = params;
    
    const subject = `SwingTrader 🚨 ${symbol} ${alertType.toUpperCase()} Alert - $${currentPrice}`;
    
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
          <p style="margin: 10px 0 0; font-weight: bold; color: #fbbf24;">Educational purposes only. Not financial advice.</p>
          <p style="margin: 6px 0 0;">${DISCLAIMER_FULL.join(' ')}</p>
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

EDUCATIONAL PURPOSES ONLY. NOT FINANCIAL ADVICE.
${DISCLAIMER_FULL.join(' ')}
    `;

    const request = mailjet.post('send', { version: 'v3.1' }).request({
      Messages: [
        {
          From: {
            Email: 'alerts@trezian.com',
            Name: 'Trezian Trading Alerts'
          },
          To: [
            {
              Email: to,
              Name: 'Trader'
            }
          ],
          Subject: subject,
          TextPart: textContent,
          HTMLPart: htmlContent
        }
      ]
    });

    await request;
    console.log(`Price alert email sent to ${to} for ${symbol} ${alertType}`);
    return true;
    
  } catch (error) {
    console.error('Mailjet email error:', error);
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

export async function sendVerificationCode(email: string, code: string): Promise<boolean> {
  if (!isEmailEnabled || !mailjet) {
    console.log('Email service disabled - MAILJET_API_KEY or MAILJET_SECRET_KEY not configured');
    return false;
  }

  try {
    const request = mailjet.post('send', { version: 'v3.1' }).request({
      Messages: [
        {
          From: { Email: 'alerts@trezian.com', Name: 'Trezian Trading' },
          To: [{ Email: email, Name: 'Trader' }],
          Subject: 'Your Login Verification Code',
          TextPart: `Your verification code is: ${code}. It expires in 10 minutes.`,
          HTMLPart: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
              <h2>Verification Code</h2>
              <p>Your login code is: <strong>${code}</strong></p>
              <p>This code expires in 10 minutes.</p>
            </div>
          `
        }
      ]
    });
    await request;
    return true;
  } catch (error) {
    console.error('Email verification error:', error);
    return false;
  }
}

export async function sendEmailChangeVerificationCode(email: string, code: string): Promise<boolean> {
  if (!isEmailEnabled || !mailjet) {
    console.log('Email service disabled - MAILJET_API_KEY or MAILJET_SECRET_KEY not configured');
    return false;
  }

  try {
    const request = mailjet.post('send', { version: 'v3.1' }).request({
      Messages: [
        {
          From: { Email: 'alerts@trezian.com', Name: 'Trezian Trading' },
          To: [{ Email: email, Name: 'Trader' }],
          Subject: 'Verify your SwingTrader Pro email address',
          TextPart: `Your email-change verification code is: ${code}. It expires in 10 minutes. If you did not request this change, you can ignore this email.`,
          HTMLPart: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
              <h2>Verify Your New Email Address</h2>
              <p>Enter this code in SwingTrader Pro to confirm your new email address:</p>
              <p style="font-size: 28px; font-weight: bold; letter-spacing: 5px;">${code}</p>
              <p>This code expires in 10 minutes.</p>
              <p>If you did not request this change, you can ignore this email.</p>
            </div>
          `
        }
      ]
    });

    await request;
    return true;
  } catch (error) {
    console.error('Email-change verification error:', error);
    return false;
  }
}
