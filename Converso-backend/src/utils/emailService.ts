/**
 * Email Service
 * Handles sending emails for team member invitations and notifications
 * Uses nodemailer with SMTP configuration (should match Supabase SMTP settings)
 */

import * as nodemailer from 'nodemailer';
import { logger } from './logger';

interface InvitationEmailParams {
  toEmail: string;
  toName: string;
  adminName: string;
  workspaceName: string;
  resetLink: string;
}

/**
 * Send invitation email to new team member
 */
export async function sendInvitationEmail(params: InvitationEmailParams): Promise<void> {
  const { toEmail, toName, adminName, workspaceName, resetLink } = params;

  const subject = `Welcome to ${workspaceName} - Set Your Password`;
  
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to SynQ</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
        <h1 style="color: #2563eb; margin-top: 0;">Welcome to SynQ!</h1>
        
        <p>Hi ${toName},</p>
        
        <p><strong>${adminName}</strong> has added you to the <strong>${workspaceName}</strong> workspace on SynQ.</p>
        
        <p>To get started, please set your password by clicking the button below:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" 
             style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            Set Your Password
          </a>
        </div>
        
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #2563eb;">${resetLink}</p>
        
        <p>Once you've set your password, you'll be able to log in and access the platform.</p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <p style="color: #6b7280; font-size: 14px;">
          If you didn't expect this invitation, please ignore this email.
        </p>
      </div>
    </body>
    </html>
  `;

  const textBody = `
Welcome to SynQ!

Hi ${toName},

${adminName} has added you to the ${workspaceName} workspace on SynQ.

To get started, please set your password by visiting this link:
${resetLink}

Once you've set your password, you'll be able to log in and access the platform.

If you didn't expect this invitation, please ignore this email.
  `;

  try {
    // Get SMTP configuration from environment variables
    // These should match the SMTP settings configured in Supabase Dashboard
    // Supabase Dashboard > Project Settings > Authentication > SMTP Settings
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = parseInt(process.env.SMTP_PORT || '465', 10);
    const smtpUser = process.env.SMTP_USER || process.env.SMTP_USERNAME;
    const smtpPassword = process.env.SMTP_PASSWORD;
    const smtpFromEmail = process.env.SMTP_FROM_EMAIL || smtpUser || 'info@leadnex.co';
    const smtpFromName = process.env.SMTP_FROM_NAME || 'SynQ';
    const smtpSecure = process.env.SMTP_SECURE === 'true' || smtpPort === 465 || process.env.SMTP_SECURE === undefined;

    // Check if SMTP is configured
    if (!smtpHost || !smtpUser || !smtpPassword) {
      const errorMsg = 'SMTP not configured. Email will not be sent. Please set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD environment variables.';
      logger.warn(errorMsg, {
        smtpHost: smtpHost || 'MISSING',
        smtpUser: smtpUser || 'MISSING',
        smtpPassword: smtpPassword ? 'SET' : 'MISSING',
      });
      
      // Log email details for development
      console.error('\n❌ INVITATION EMAIL NOT SENT - SMTP NOT CONFIGURED');
      console.error('To:', toEmail);
      console.error('Subject:', subject);
      console.error('Admin:', adminName);
      console.error('Workspace:', workspaceName);
      console.error('Reset Link:', resetLink);
      console.error('===========================================================\n');
      return;
    }

    // Create nodemailer transporter with SMTP configuration
    // Gmail SMTP with app passwords works best with explicit host/port configuration
    const transporterConfig: any = {
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure, // true for 465 (SSL), false for 587 (TLS)
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
      // Add TLS options for better compatibility
      tls: {
        rejectUnauthorized: false, // Allow self-signed certificates (adjust for production)
      },
    };

    // For Gmail, ensure proper configuration
    if (smtpHost.includes('gmail.com')) {
      // Gmail works with both 465 (SSL) and 587 (TLS)
      // Port 465 requires secure: true, port 587 requires secure: false
      transporterConfig.secure = smtpPort === 465;
    }

    const transporter = nodemailer.createTransport(transporterConfig);

    // Send email
    const mailOptions = {
      from: `"${smtpFromName}" <${smtpFromEmail}>`,
      to: toEmail,
      subject: subject,
      text: textBody,
      html: htmlBody,
    };

    // Verify SMTP connection before sending (optional, can be skipped if it causes issues)
    try {
      await transporter.verify();
      logger.info('SMTP connection verified successfully');
    } catch (verifyError: any) {
      logger.warn('SMTP verification failed, but will attempt to send email anyway:', {
        error: verifyError.message,
      });
    }

    const info = await transporter.sendMail(mailOptions);
    
    logger.info('✅ Invitation email sent successfully', {
      to: toEmail,
      subject,
      adminName,
      workspaceName,
      messageId: info.messageId,
      response: info.response,
    });
    
    console.log('\n✅ INVITATION EMAIL SENT SUCCESSFULLY');
    console.log('To:', toEmail);
    console.log('Message ID:', info.messageId);
    console.log('Response:', info.response);
    console.log('===========================================================\n');

  } catch (error: any) {
    const errorDetails = {
      error: error.message,
      to: toEmail,
      code: error.code,
      command: error.command,
      response: error.response,
      stack: error.stack,
    };
    
    logger.error('❌ Error sending invitation email:', errorDetails);
    
    console.error('\n❌ ERROR SENDING INVITATION EMAIL');
    console.error('To:', toEmail);
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    if (error.response) {
      console.error('SMTP Response:', error.response);
    }
    console.error('===========================================================\n');
    
    // Don't throw - email sending failure shouldn't prevent user creation
    // Log the error for monitoring
  }
}













