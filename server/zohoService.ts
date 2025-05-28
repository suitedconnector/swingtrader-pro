import fetch from 'node-fetch';

const ZOHO_CLIENT_ID = '1000.Q69KZUXSC9QV9A9QDAOZ59ZJ2ENCHW';
const ZOHO_CLIENT_SECRET = 'c6bea20a04881fd255bd1dc797d08169a38dc1ea00';
const REDIRECT_URI = 'https://54abc171-cf5d-47af-9ec5-f1e591f22432-00-2ufeg7whmct9g.worf.replit.dev/api/zoho/callback';

interface PriceAlertEmailParams {
  to: string;
  symbol: string;
  currentPrice: number;
  targetPrice: number;
  alertType: 'breakout' | 'breakdown';
  changePercent: number;
}

// Store access token in memory (in production, use a database)
let accessToken: string | null = null;
let refreshToken: string | null = process.env.ZOHO_REFRESH_TOKEN || null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshToken) {
    console.log('No refresh token available');
    return null;
  }

  try {
    const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: ZOHO_CLIENT_ID,
        client_secret: ZOHO_CLIENT_SECRET,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json() as any;
    
    if (data.access_token) {
      accessToken = data.access_token;
      return accessToken;
    } else {
      console.error('Failed to refresh token:', data);
      return null;
    }
  } catch (error) {
    console.error('Token refresh error:', error);
    return null;
  }
}

export async function sendZohoAlert(params: PriceAlertEmailParams): Promise<boolean> {
  // Get access token
  if (!accessToken) {
    accessToken = await refreshAccessToken();
  }

  if (!accessToken) {
    console.log('No access token available for Zoho Mail');
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

    const emailData = {
      fromAddress: 'alerts@trezian.com',
      toAddress: to,
      subject: subject,
      content: htmlContent,
      mode: 'html'
    };

    const response = await fetch('https://mail.zoho.com/api/accounts/1234567890/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData),
    });

    if (response.ok) {
      console.log(`Zoho alert sent to ${to} for ${symbol} ${alertType}`);
      return true;
    } else {
      const errorData = await response.json();
      console.error('Zoho sending error:', response.status, errorData);
      
      // Try refreshing token if unauthorized
      if (response.status === 401) {
        accessToken = await refreshAccessToken();
        if (accessToken) {
          // Retry with new token
          return sendZohoAlert(params);
        }
      }
      return false;
    }
    
  } catch (error) {
    console.error('Zoho email error:', error);
    return false;
  }
}

export async function sendZohoTest(email: string): Promise<boolean> {
  return await sendZohoAlert({
    to: email,
    symbol: 'IBM',
    currentPrice: 263.23,
    targetPrice: 263.00,
    alertType: 'breakout',
    changePercent: 2.1
  });
}

export function getZohoAuthUrl(): string {
  const scopes = 'ZohoMail.messages.CREATE,ZohoMail.accounts.READ';
  const params = new URLSearchParams({
    client_id: ZOHO_CLIENT_ID,
    response_type: 'code',
    scope: scopes,
    redirect_uri: REDIRECT_URI,
    access_type: 'offline'
  });
  
  return `https://accounts.zoho.com/oauth/v2/auth?${params.toString()}`;
}