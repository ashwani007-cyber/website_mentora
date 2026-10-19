import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASSWORD = process.env.SMTP_PASSWORD || '';
const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_USER || 'noreply@theregistry.com';
const APP_NAME = process.env.APP_NAME || 'The Registry';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  
  if (!SMTP_USER || !SMTP_PASSWORD) {
    console.warn('[PasswordReset:Email] SMTP_USER or SMTP_PASSWORD not configured. Email sending will be simulated.');
    return null;
  }
  
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASSWORD
    }
  });
  
  return transporter;
}

/**
 * Send a password reset email containing the secure reset link.
 */
export async function sendResetEmail(toEmail, rawToken) {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${rawToken}`;
  
  const htmlBody = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #F59E0B; margin: 0; font-size: 28px; font-weight: 700;">${APP_NAME}</h1>
        <p style="color: #94A3B8; font-size: 14px; margin-top: 4px;">Executive Advisory Platform</p>
      </div>
      
      <div style="background: #0B111A; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px; color: #F1F5F9;">
        <h2 style="color: #FFFFFF; margin: 0 0 16px; font-size: 20px;">Password Reset Request</h2>
        
        <p style="color: #94A3B8; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
          Hello,<br><br>
          We received a request to reset the password for your account.
          If you requested this password reset, click the button below:
        </p>
        
        <div style="text-align: center; margin: 28px 0;">
          <a href="${resetUrl}" 
             style="display: inline-block; background: linear-gradient(135deg, #F59E0B, #D97706); 
                    color: #05080E; padding: 14px 36px; border-radius: 12px; 
                    text-decoration: none; font-weight: 700; font-size: 15px;
                    box-shadow: 0 4px 15px rgba(245,158,11,0.3);">
            Reset Password
          </a>
        </div>
        
        <p style="color: #64748B; font-size: 12px; line-height: 1.6; margin: 24px 0 0; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px;">
          This password-reset link is temporary and can only be used once.
          It will expire in 30 minutes.<br><br>
          If you did not request a password reset, you can safely ignore this email.
          Your current password will remain unchanged unless the reset link is successfully used.
        </p>
        
        <p style="color: #475569; font-size: 11px; margin: 16px 0 0; word-break: break-all;">
          If the button doesn't work, copy and paste this link:<br>
          <a href="${resetUrl}" style="color: #F59E0B;">${resetUrl}</a>
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 24px;">
        <p style="color: #475569; font-size: 12px;">
          Regards,<br>
          <strong style="color: #94A3B8;">${APP_NAME}</strong>
        </p>
      </div>
    </div>
  `;
  
  const textBody = `
${APP_NAME} — Password Reset Request

Hello,

We received a request to reset the password for your account.

If you requested this password reset, click the link below:
${resetUrl}

This password-reset link is temporary and can only be used once.
It will expire in 30 minutes.

If you did not request a password reset, you can safely ignore this email.
Your current password will remain unchanged unless the reset link is successfully used.

Regards,
${APP_NAME}
  `.trim();
  
  const mailOptions = {
    from: \`"\${APP_NAME}" <\${EMAIL_FROM}>\`,
    to: toEmail,
    subject: 'Password Reset Request',
    text: textBody,
    html: htmlBody
  };
  
  const transport = getTransporter();
  
  if (!transport) {
    // SMTP not configured — log the reset URL for development/testing
    console.log(\`\\n[PasswordReset:Email] ========================================\`);
    console.log(\`[PasswordReset:Email] SMTP not configured. Simulating email send.\`);
    console.log(\`[PasswordReset:Email] To: \${toEmail}\`);
    console.log(\`[PasswordReset:Email] Reset URL: \${resetUrl}\`);
    console.log(\`[PasswordReset:Email] ========================================\\n\`);
    return { simulated: true, resetUrl };
  }
  
  try {
    const info = await transport.sendMail(mailOptions);
    console.log(\`[PasswordReset:Email] Reset email sent to \${toEmail}: \${info.messageId}\`);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error(\`[PasswordReset:Email] Failed to send email to \${toEmail}:\`, err.message);
    throw new Error('Failed to send reset email. Please try again later.');
  }
}

export function getResetPageUrl() {
  return FRONTEND_URL;
}
