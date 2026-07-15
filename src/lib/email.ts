import crypto from 'crypto';

const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || '';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// ── Token generation ──────────────────────────────────────

export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function getVerificationExpiry(): Date {
  return new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
}

// ── HTML email template ───────────────────────────────────

function buildVerificationEmail(name: string, verificationUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify Your Email — ScriptForge</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    .container { max-width: 480px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #ffffff; border-radius: 16px; padding: 40px 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .logo { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; }
    .logo-icon { width: 36px; height: 36px; background: #6366f1; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
    .logo-text { font-size: 18px; font-weight: 700; color: #18181b; }
    .heading { font-size: 22px; font-weight: 700; color: #18181b; margin: 0 0 8px; }
    .subtext { font-size: 15px; color: #71717a; line-height: 1.6; margin: 0 0 28px; }
    .btn { display: inline-block; background: #6366f1; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 15px; font-weight: 600; }
    .btn:hover { background: #4f46e5; }
    .expiry { font-size: 13px; color: #a1a1aa; margin-top: 20px; }
    .divider { height: 1px; background: #e4e4e7; margin: 28px 0; }
    .footer { font-size: 12px; color: #a1a1aa; line-height: 1.5; }
    .footer a { color: #6366f1; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">
        <div class="logo-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
            <line x1="7" y1="2" x2="7" y2="22"/>
            <line x1="17" y1="2" x2="17" y2="22"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <line x1="2" y1="7" x2="7" y2="7"/>
            <line x1="2" y1="17" x2="7" y2="17"/>
            <line x1="17" y1="7" x2="22" y2="7"/>
            <line x1="17" y1="17" x2="22" y2="17"/>
          </svg>
        </div>
        <span class="logo-text">ScriptForge</span>
      </div>

      <h1 class="heading">Welcome, ${name}!</h1>
      <p class="subtext">
        Thanks for signing up. To get started, please verify your email address by clicking the button below.
      </p>

      <div style="text-align: center;">
        <a href="${verificationUrl}" class="btn">Verify My Email</a>
      </div>

      <p class="expiry">
        This link expires in 15 minutes. If you didn't create an account, you can safely ignore this email.
      </p>

      <div class="divider"></div>

      <p class="footer">
        If the button above doesn't work, copy and paste this URL into your browser:<br/>
        <a href="${verificationUrl}">${verificationUrl}</a>
      </p>
    </div>

    <div style="text-align: center; margin-top: 24px;">
      <p class="footer">
        ScriptForge &mdash; AI-powered YouTube script generation<br/>
        Need help? Contact us at <a href="mailto:support@scriptforge.app">support@scriptforge.app</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ── Send via Brevo REST API ───────────────────────────────

export async function sendVerificationEmail(toEmail: string, name: string, token: string): Promise<void> {
  if (!BREVO_API_KEY) {
    throw new Error('BREVO_API_KEY is not configured in .env');
  }
  if (!EMAIL_FROM) {
    throw new Error('EMAIL_FROM is not configured in .env');
  }

  const verificationUrl = `${BASE_URL}/verify?token=${token}`;
  const htmlContent = buildVerificationEmail(name, verificationUrl);

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: { name: 'ScriptForge', email: EMAIL_FROM },
      to: [{ email: toEmail, name }],
      subject: 'Verify your email — ScriptForge',
      htmlContent,
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const detail = (errBody as Record<string, unknown>)?.message || `Brevo API returned status ${res.status}`;
    throw new Error(String(detail));
  }
}