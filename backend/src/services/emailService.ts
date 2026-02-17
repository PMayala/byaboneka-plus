/**
 * ============================================
 * Brevo (Sendinblue) Email Service for Byaboneka+
 * ============================================
 * 
 * Handles all transactional emails:
 * - Email verification
 * - Password reset
 * - Claim notifications (new claim, verified, rejected)
 * - Match notifications
 * - Expiry warnings
 * - Handover confirmations
 * - Welcome emails
 * 
 * Uses Brevo SMTP relay via nodemailer for reliability.
 * Brevo free tier: 300 emails/day — sufficient for MVP.
 * 
 * Setup:
 * 1. Sign up at https://www.brevo.com
 * 2. Go to SMTP & API → SMTP Settings
 * 3. Copy your SMTP credentials to .env
 */

import nodemailer from 'nodemailer';
import { query } from '../config/database';

// ============================================
// CONFIGURATION
// ============================================

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
  frontendUrl: string;
  enabled: boolean;
}

function getEmailConfig(): EmailConfig {
  const host = process.env.BREVO_SMTP_HOST || process.env.SMTP_HOST || 'smtp-relay.brevo.com';
  const port = parseInt(process.env.BREVO_SMTP_PORT || process.env.SMTP_PORT || '587');
  const user = process.env.BREVO_SMTP_USER || process.env.SMTP_USER || '';
  const pass = process.env.BREVO_SMTP_KEY || process.env.SMTP_PASS || '';
  const from = process.env.EMAIL_FROM || 'Byaboneka+ <noreply@byaboneka.rw>';
  const frontendUrl = process.env.FRONTEND_URL || process.env.CORS_ORIGIN?.split(',')[0] || 'http://localhost:3000';
  
  // Email is enabled only when credentials are provided
  const enabled = !!(user && pass);
  
  if (!enabled) {
    console.warn('⚠️  Email service disabled — BREVO_SMTP_USER and BREVO_SMTP_KEY not set');
  }

  return { host, port, secure: port === 465, auth: { user, pass }, from, frontendUrl, enabled };
}

// ============================================
// TRANSPORTER (lazy-initialized singleton)
// ============================================

let _transporter: nodemailer.Transporter | null = null;
let _config: EmailConfig | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!_config) {
    _config = getEmailConfig();
  }
  
  if (!_config.enabled) return null;
  
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: _config.host,
      port: _config.port,
      secure: _config.secure,
      auth: _config.auth,
      // Connection pool for better throughput
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      // Timeouts
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 30000,
    });

    // Verify connection on startup
    _transporter.verify()
      .then(() => console.log('✅ Brevo SMTP connection verified'))
      .catch((err: Error) => console.error('❌ Brevo SMTP verification failed:', err.message));
  }
  
  return _transporter;
}

// ============================================
// CORE SEND FUNCTION
// ============================================

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const transporter = getTransporter();
  const config = _config || getEmailConfig();
  
  if (!transporter) {
    console.log(`📧 [EMAIL NOT SENT - No SMTP configured] To: ${options.to} | Subject: ${options.subject}`);
    return false;
  }
  
  try {
    const info = await transporter.sendMail({
      from: config.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || stripHtml(options.html),
      replyTo: options.replyTo || config.from,
    });
    
    console.log(`📧 Email sent: ${options.to} | ${options.subject} | MessageID: ${info.messageId}`);
    return true;
  } catch (error: any) {
    console.error(`❌ Email send failed: ${options.to} | ${options.subject} | Error: ${error.message}`);
    return false;
  }
}

// ============================================
// HTML EMAIL TEMPLATE (shared layout)
// ============================================

function emailLayout(title: string, bodyContent: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f3f4f6;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background-color:#1E3A5F;padding:32px 40px;text-align:center;">
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto;">
                <tr>
                  <td style="background-color:rgba(255,255,255,0.15);border-radius:12px;padding:8px 16px;">
                    <span style="color:#ffffff;font-size:24px;font-weight:bold;letter-spacing:1px;">B+</span>
                  </td>
                  <td style="padding-left:12px;">
                    <span style="color:#ffffff;font-size:22px;font-weight:bold;">Byaboneka+</span>
                  </td>
                </tr>
              </table>
              <p style="color:rgba(255,255,255,0.7);font-size:13px;margin:8px 0 0 0;">
                Trust-Aware Lost &amp; Found for Rwanda
              </p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              ${bodyContent}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;padding:24px 40px;border-top:1px solid #e5e7eb;">
              <p style="color:#9ca3af;font-size:12px;margin:0;text-align:center;">
                © ${new Date().getFullYear()} Byaboneka+ — ALU Mission Capstone Project<br/>
                This is an automated message. Please do not reply directly.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buttonHtml(text: string, url: string, color: string = '#1E3A5F'): string {
  return `
  <table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px auto;">
    <tr>
      <td style="background-color:${color};border-radius:8px;">
        <a href="${url}" target="_blank" 
           style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;">
          ${text}
        </a>
      </td>
    </tr>
  </table>`;
}

function infoBox(content: string, bgColor: string = '#EBF5FF', borderColor: string = '#3B82F6'): string {
  return `
  <div style="background-color:${bgColor};border-left:4px solid ${borderColor};padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0;">
    ${content}
  </div>`;
}

// ============================================
// EMAIL TYPES
// ============================================

/**
 * Send welcome email after registration
 */
export async function sendWelcomeEmail(email: string, name: string): Promise<boolean> {
  const config = _config || getEmailConfig();
  const firstName = name.split(' ')[0];
  
  const html = emailLayout('Welcome to Byaboneka+', `
    <h1 style="color:#1a1a1a;font-size:24px;margin:0 0 16px 0;">
      Muraho ${firstName}! 👋
    </h1>
    <p style="color:#4b5563;font-size:15px;line-height:1.7;margin:0 0 16px 0;">
      Welcome to <strong>Byaboneka+</strong> — Rwanda's trust-aware lost and found platform. 
      You're now part of a community that helps reunite people with their belongings securely.
    </p>
    <p style="color:#4b5563;font-size:15px;line-height:1.7;margin:0 0 16px 0;">
      Here's what you can do:
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;margin:0 0 24px 0;">
      <tr>
        <td style="padding:8px 0;">🔍 <strong>Report a lost item</strong> — Describe what you lost and set verification questions</td>
      </tr>
      <tr>
        <td style="padding:8px 0;">📦 <strong>Report a found item</strong> — Help someone recover their belongings</td>
      </tr>
      <tr>
        <td style="padding:8px 0;">🤝 <strong>Secure handover</strong> — Use OTP codes for safe item return</td>
      </tr>
      <tr>
        <td style="padding:8px 0;">⭐ <strong>Build trust</strong> — Your trust score grows as you help others</td>
      </tr>
    </table>
    ${buttonHtml('Get Started', `${config.frontendUrl}/dashboard`)}
    <p style="color:#9ca3af;font-size:13px;text-align:center;margin:0;">
      We recommend verifying your email to unlock all features.
    </p>
  `);
  
  return sendEmail({ to: email, subject: 'Muraho! Welcome to Byaboneka+ 🎉', html });
}

/**
 * Send email verification token
 */
export async function sendVerificationEmail(
  email: string, 
  name: string, 
  token: string
): Promise<boolean> {
  const config = _config || getEmailConfig();
  const verifyUrl = `${config.frontendUrl}/verify-email?token=${token}`;
  
  const html = emailLayout('Verify Your Email', `
    <h1 style="color:#1a1a1a;font-size:24px;margin:0 0 16px 0;">
      Verify your email address
    </h1>
    <p style="color:#4b5563;font-size:15px;line-height:1.7;margin:0 0 16px 0;">
      Hi ${name.split(' ')[0]}, please verify your email to unlock all Byaboneka+ features 
      including secure handovers and claim verifications.
    </p>
    ${buttonHtml('Verify Email', verifyUrl, '#2E7D32')}
    ${infoBox(`
      <p style="color:#1e40af;font-size:13px;margin:0;">
        <strong>Can't click the button?</strong> Copy and paste this link into your browser:<br/>
        <span style="word-break:break-all;color:#3B82F6;">${verifyUrl}</span>
      </p>
    `)}
    <p style="color:#9ca3af;font-size:13px;margin:16px 0 0 0;">
      This link expires in 24 hours. If you didn't create a Byaboneka+ account, you can safely ignore this email.
    </p>
  `);
  
  return sendEmail({ to: email, subject: 'Verify your Byaboneka+ email ✉️', html });
}

/**
 * Send password reset link
 */
export async function sendPasswordResetEmail(
  email: string, 
  name: string, 
  resetToken: string
): Promise<boolean> {
  const config = _config || getEmailConfig();
  const resetUrl = `${config.frontendUrl}/reset-password?token=${resetToken}`;
  
  const html = emailLayout('Reset Your Password', `
    <h1 style="color:#1a1a1a;font-size:24px;margin:0 0 16px 0;">
      Password reset request
    </h1>
    <p style="color:#4b5563;font-size:15px;line-height:1.7;margin:0 0 16px 0;">
      Hi ${name.split(' ')[0]}, we received a request to reset your Byaboneka+ password. 
      Click the button below to choose a new password.
    </p>
    ${buttonHtml('Reset Password', resetUrl, '#DC2626')}
    ${infoBox(`
      <p style="color:#92400e;font-size:13px;margin:0;">
        ⏰ This link expires in <strong>1 hour</strong>. If you didn't request this reset, 
        your account is safe — no action needed.
      </p>
    `, '#FEF3C7', '#F59E0B')}
    <p style="color:#9ca3af;font-size:13px;margin:16px 0 0 0;">
      For security, this link can only be used once.
    </p>
  `);
  
  return sendEmail({ to: email, subject: 'Reset your Byaboneka+ password 🔑', html });
}

/**
 * Notify item owner that someone has claimed their lost item
 */
export async function sendClaimNotificationEmail(
  ownerEmail: string,
  ownerName: string,
  itemTitle: string,
  claimId: number
): Promise<boolean> {
  const config = _config || getEmailConfig();
  const claimUrl = `${config.frontendUrl}/claims/${claimId}`;
  
  const html = emailLayout('New Claim on Your Item', `
    <h1 style="color:#1a1a1a;font-size:24px;margin:0 0 16px 0;">
      Someone found your item! 🎉
    </h1>
    <p style="color:#4b5563;font-size:15px;line-height:1.7;margin:0 0 16px 0;">
      Hi ${ownerName.split(' ')[0]}, great news — someone has submitted a claim 
      for your lost item: <strong>"${itemTitle}"</strong>.
    </p>
    <p style="color:#4b5563;font-size:15px;line-height:1.7;margin:0 0 16px 0;">
      The claimant will need to answer your verification questions before the 
      claim is approved. You'll be notified of the result.
    </p>
    ${buttonHtml('View Claim', claimUrl)}
  `);
  
  return sendEmail({ to: ownerEmail, subject: `Claim submitted for "${itemTitle}" 📋`, html });
}

/**
 * Notify claimant that their claim was verified/rejected
 */
export async function sendClaimResultEmail(
  claimantEmail: string,
  claimantName: string,
  itemTitle: string,
  claimId: number,
  verified: boolean,
  score?: number
): Promise<boolean> {
  const config = _config || getEmailConfig();
  const claimUrl = `${config.frontendUrl}/claims/${claimId}`;
  
  const statusText = verified ? 'Verified ✅' : 'Not Verified ❌';
  const statusColor = verified ? '#2E7D32' : '#DC2626';
  const message = verified 
    ? `Your ownership claim for <strong>"${itemTitle}"</strong> has been verified! 
       You can now coordinate the handover with the finder.`
    : `Unfortunately, your verification answers for <strong>"${itemTitle}"</strong> did not match. 
       You may have remaining attempts — check the claim page for details.`;
  
  const html = emailLayout(`Claim ${verified ? 'Verified' : 'Update'}`, `
    <h1 style="color:${statusColor};font-size:24px;margin:0 0 16px 0;">
      Claim ${statusText}
    </h1>
    <p style="color:#4b5563;font-size:15px;line-height:1.7;margin:0 0 16px 0;">
      Hi ${claimantName.split(' ')[0]}, ${message}
    </p>
    ${score !== undefined ? infoBox(`
      <p style="color:#1e40af;font-size:14px;margin:0;">
        <strong>Verification Score:</strong> ${Math.round(score * 100)}%
      </p>
    `) : ''}
    ${buttonHtml(verified ? 'Coordinate Handover' : 'View Claim Details', claimUrl, statusColor)}
  `);
  
  return sendEmail({ 
    to: claimantEmail, 
    subject: `Claim ${verified ? 'verified' : 'update'}: "${itemTitle}"`, 
    html 
  });
}

/**
 * Notify about a match between lost and found items
 */
export async function sendMatchNotificationEmail(
  email: string,
  name: string,
  lostItemTitle: string,
  foundItemTitle: string,
  matchScore: number,
  lostItemId: number
): Promise<boolean> {
  const config = _config || getEmailConfig();
  const matchUrl = `${config.frontendUrl}/lost-items/${lostItemId}`;
  
  const html = emailLayout('Potential Match Found', `
    <h1 style="color:#1a1a1a;font-size:24px;margin:0 0 16px 0;">
      We found a potential match! 🔍
    </h1>
    <p style="color:#4b5563;font-size:15px;line-height:1.7;margin:0 0 16px 0;">
      Hi ${name.split(' ')[0]}, our smart matching system found a potential match 
      for your lost item.
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;margin:16px 0;background-color:#f9fafb;border-radius:12px;padding:20px;">
      <tr>
        <td style="padding:8px 20px;">
          <p style="color:#6b7280;font-size:13px;margin:0;">Your lost item</p>
          <p style="color:#1a1a1a;font-size:16px;font-weight:600;margin:4px 0 0 0;">${lostItemTitle}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 20px;">
          <p style="color:#6b7280;font-size:13px;margin:0;">Potential match</p>
          <p style="color:#1a1a1a;font-size:16px;font-weight:600;margin:4px 0 0 0;">${foundItemTitle}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 20px;">
          <p style="color:#6b7280;font-size:13px;margin:0;">Match confidence</p>
          <p style="color:#2E7D32;font-size:18px;font-weight:700;margin:4px 0 0 0;">${matchScore}%</p>
        </td>
      </tr>
    </table>
    ${buttonHtml('View Match', matchUrl, '#2E7D32')}
  `);
  
  return sendEmail({ to: email, subject: `Match found for "${lostItemTitle}" 🎯`, html });
}

/**
 * Send item expiry warning (7 days before expiry)
 */
export async function sendExpiryWarningEmail(
  email: string,
  name: string,
  itemTitle: string,
  itemType: 'lost' | 'found',
  itemId: number,
  daysRemaining: number
): Promise<boolean> {
  const config = _config || getEmailConfig();
  const itemUrl = `${config.frontendUrl}/${itemType === 'lost' ? 'lost-items' : 'found-items'}/${itemId}`;
  
  const html = emailLayout('Item Expiry Warning', `
    <h1 style="color:#D97706;font-size:24px;margin:0 0 16px 0;">
      ⏰ Your listing is expiring soon
    </h1>
    <p style="color:#4b5563;font-size:15px;line-height:1.7;margin:0 0 16px 0;">
      Hi ${name.split(' ')[0]}, your ${itemType} item <strong>"${itemTitle}"</strong> 
      will expire in <strong>${daysRemaining} days</strong>.
    </p>
    <p style="color:#4b5563;font-size:15px;line-height:1.7;margin:0 0 16px 0;">
      If the item is still ${itemType === 'lost' ? 'missing' : 'unclaimed'}, 
      you can update the listing to extend it.
    </p>
    ${buttonHtml('Update Listing', itemUrl, '#D97706')}
  `);
  
  return sendEmail({ to: email, subject: `"${itemTitle}" expires in ${daysRemaining} days ⏰`, html });
}

/**
 * Confirm successful handover
 */
export async function sendHandoverConfirmationEmail(
  ownerEmail: string,
  ownerName: string,
  finderEmail: string,
  finderName: string,
  itemTitle: string
): Promise<boolean> {
  const ownerHtml = emailLayout('Item Returned Successfully', `
    <h1 style="color:#2E7D32;font-size:24px;margin:0 0 16px 0;">
      Your item has been returned! 🎉
    </h1>
    <p style="color:#4b5563;font-size:15px;line-height:1.7;margin:0 0 16px 0;">
      Hi ${ownerName.split(' ')[0]}, great news — <strong>"${itemTitle}"</strong> has been 
      successfully handed over. The OTP verification was confirmed.
    </p>
    <p style="color:#4b5563;font-size:15px;line-height:1.7;">
      Thank you for using Byaboneka+. We hope you're reunited with your belongings safely!
    </p>
  `);

  const finderHtml = emailLayout('Handover Confirmed', `
    <h1 style="color:#2E7D32;font-size:24px;margin:0 0 16px 0;">
      Handover confirmed! Thank you 🙏
    </h1>
    <p style="color:#4b5563;font-size:15px;line-height:1.7;margin:0 0 16px 0;">
      Hi ${finderName.split(' ')[0]}, the handover of <strong>"${itemTitle}"</strong> has been 
      confirmed. Your trust score has been updated to reflect your good deed.
    </p>
    <p style="color:#4b5563;font-size:15px;line-height:1.7;">
      Thank you for helping someone recover their belongings. You make Rwanda's transport ecosystem better!
    </p>
  `);
  
  const [ownerSent, finderSent] = await Promise.all([
    sendEmail({ to: ownerEmail, subject: `"${itemTitle}" returned successfully! 🎉`, html: ownerHtml }),
    sendEmail({ to: finderEmail, subject: `Handover confirmed — thank you! 🙏`, html: finderHtml }),
  ]);
  
  return ownerSent && finderSent;
}

/**
 * Send dispute opened notification to both parties
 */
export async function sendDisputeOpenedEmail(
  recipientEmail: string,
  recipientName: string,
  itemTitle: string,
  claimId: number,
  isInitiator: boolean
): Promise<boolean> {
  const config = _config || getEmailConfig();
  const claimUrl = `${config.frontendUrl}/claims/${claimId}`;
  
  const message = isInitiator
    ? `Your dispute for <strong>"${itemTitle}"</strong> has been submitted and is now under review by our team.`
    : `A dispute has been opened on the claim for <strong>"${itemTitle}"</strong>. Our team will review both sides and reach a resolution.`;
  
  const html = emailLayout('Dispute Notification', `
    <h1 style="color:#DC2626;font-size:24px;margin:0 0 16px 0;">
      Dispute ${isInitiator ? 'Submitted' : 'Opened'}
    </h1>
    <p style="color:#4b5563;font-size:15px;line-height:1.7;margin:0 0 16px 0;">
      Hi ${recipientName.split(' ')[0]}, ${message}
    </p>
    ${infoBox(`
      <p style="color:#92400e;font-size:13px;margin:0;">
        Disputes are typically resolved within 48 hours. You may be asked to provide additional evidence.
      </p>
    `, '#FEF3C7', '#F59E0B')}
    ${buttonHtml('View Claim', claimUrl)}
  `);
  
  return sendEmail({ to: recipientEmail, subject: `Dispute on "${itemTitle}"`, html });
}

/**
 * Send contact form message to the admin/owner
 */
export async function sendContactFormEmail(
  senderName: string,
  senderEmail: string,
  message: string
): Promise<boolean> {
  const adminEmail = process.env.CONTACT_FORM_EMAIL || 'mayalaplamedi.rw@gmail.com';
  
  const html = emailLayout('New Contact Message', `
    <h1 style="color:#1a1a1a;font-size:24px;margin:0 0 16px 0;">
      New message from Byaboneka+ 📬
    </h1>
    <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;margin:16px 0;background-color:#f9fafb;border-radius:12px;overflow:hidden;">
      <tr>
        <td style="padding:16px 20px;border-bottom:1px solid #e5e7eb;">
          <p style="color:#6b7280;font-size:12px;margin:0 0 4px 0;text-transform:uppercase;letter-spacing:0.5px;">From</p>
          <p style="color:#1a1a1a;font-size:15px;font-weight:600;margin:0;">${senderName}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 20px;border-bottom:1px solid #e5e7eb;">
          <p style="color:#6b7280;font-size:12px;margin:0 0 4px 0;text-transform:uppercase;letter-spacing:0.5px;">Email</p>
          <p style="color:#1a1a1a;font-size:15px;margin:0;">
            <a href="mailto:${senderEmail}" style="color:#3B82F6;text-decoration:none;">${senderEmail}</a>
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 20px;">
          <p style="color:#6b7280;font-size:12px;margin:0 0 8px 0;text-transform:uppercase;letter-spacing:0.5px;">Message</p>
          <p style="color:#1a1a1a;font-size:15px;line-height:1.7;margin:0;white-space:pre-wrap;">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
        </td>
      </tr>
    </table>
    <p style="color:#9ca3af;font-size:13px;margin:16px 0 0 0;">
      You can reply directly to this email to respond to ${senderName}.
    </p>
  `);
  
  return sendEmail({
    to: adminEmail,
    subject: `[Byaboneka+] Contact from ${senderName}`,
    html,
    replyTo: senderEmail,
  });
}

// ============================================
// UTILITY: Strip HTML for plain-text fallback
// ============================================

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gs, '')
    .replace(/<script[^>]*>.*?<\/script>/gs, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

// ============================================
// HEALTH CHECK
// ============================================

export async function checkEmailHealth(): Promise<{ configured: boolean; connected: boolean }> {
  const config = _config || getEmailConfig();
  
  if (!config.enabled) {
    return { configured: false, connected: false };
  }
  
  try {
    const transporter = getTransporter();
    if (transporter) {
      await transporter.verify();
      return { configured: true, connected: true };
    }
    return { configured: true, connected: false };
  } catch {
    return { configured: true, connected: false };
  }
}

// ============================================
// BATCH: Send expiry warnings (called by cron)
// ============================================

export async function sendPendingExpiryWarnings(): Promise<number> {
  let sent = 0;
  
  // Lost items expiring in ~7 days
  const expiringLost = await query(`
    SELECT li.id, li.title, u.email, u.name
    FROM lost_items li
    JOIN users u ON li.user_id = u.id
    WHERE li.status = 'ACTIVE'
    AND li.expiry_warning_sent = false
    AND li.updated_at < NOW() - INTERVAL '23 days'
  `);
  
  for (const item of expiringLost.rows) {
    const success = await sendExpiryWarningEmail(
      item.email, item.name, item.title, 'lost', item.id, 7
    );
    if (success) {
      await query('UPDATE lost_items SET expiry_warning_sent = true WHERE id = $1', [item.id]);
      sent++;
    }
  }
  
  // Found items expiring in ~7 days
  const expiringFound = await query(`
    SELECT fi.id, fi.title, u.email, u.name
    FROM found_items fi
    JOIN users u ON fi.finder_id = u.id
    WHERE fi.status = 'UNCLAIMED'
    AND fi.expiry_warning_sent = false
    AND fi.updated_at < NOW() - INTERVAL '23 days'
  `);
  
  for (const item of expiringFound.rows) {
    const success = await sendExpiryWarningEmail(
      item.email, item.name, item.title, 'found', item.id, 7
    );
    if (success) {
      await query('UPDATE found_items SET expiry_warning_sent = true WHERE id = $1', [item.id]);
      sent++;
    }
  }
  
  return sent;
}
