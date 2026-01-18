import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../database/entities/user.entity';
import { EmailVerificationRegistry } from '../database/entities/email-verification-registry.entity';
import { EmailService } from '../email/email.service';
import * as nodemailer from 'nodemailer';
import * as crypto from 'crypto';

@Injectable()
export class EmailVerificationService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(EmailVerificationRegistry)
    private emailVerificationRegistryRepository: Repository<EmailVerificationRegistry>,
    private emailService: EmailService,
  ) { }

  async sendVerificationCode(email: string, user_type: 'tutor' | 'tutee' | 'admin'): Promise<{ message: string }> {
    console.log('=== EMAIL VERIFICATION REQUEST DEBUG ===');
    console.log('Sending verification code to:', email);
    console.log('User type:', user_type);
    console.log('Email type:', typeof email);
    console.log('Email length:', email.length);

    // Validate email parameter
    if (!email || typeof email !== 'string') {
      console.log('❌ Invalid email parameter:', email);
      throw new BadRequestException('Email is required and must be a valid string');
    }

    // Validate user_type parameter
    if (!user_type || !['tutor', 'tutee', 'admin'].includes(user_type)) {
      console.log('❌ Invalid user_type parameter:', user_type);
      throw new BadRequestException('User type is required and must be tutor, tutee, or admin');
    }

    // Trim and validate email
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      console.log('❌ Empty email after trimming');
      throw new BadRequestException('Email cannot be empty');
    }

    // Check if a verification entry already exists for this email and user type
    let verificationEntry = await this.emailVerificationRegistryRepository.findOne({
      where: { email: trimmedEmail, user_type: user_type },
    });

    // If user is already verified (in the registry), don't send another code
    if (verificationEntry && verificationEntry.is_verified) {
      console.log('⚠️ Email is already verified in registry, not sending new code');
      return { message: 'Email is already verified' };
    }

    const verificationCode = this.generateVerificationCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    if (verificationEntry) {
      // Update existing entry
      verificationEntry.verification_code = verificationCode;
      verificationEntry.verification_expires = expiresAt;
      verificationEntry.is_verified = false; // Reset to false if resending code
      await this.emailVerificationRegistryRepository.save(verificationEntry);
      console.log('✅ Updated existing verification entry with new code');
    } else {
      // Create new entry
      verificationEntry = this.emailVerificationRegistryRepository.create({
        email: trimmedEmail,
        user_type: user_type,
        verification_code: verificationCode,
        verification_expires: expiresAt,
        is_verified: false,
      });
      await this.emailVerificationRegistryRepository.save(verificationEntry);
      console.log('✅ Created new verification entry');
    }

    console.log('Verification code:', verificationCode);
    console.log('Expires at:', expiresAt);

    // Check if the user already exists in the main User table to get their name for the email
    const existingUser = await this.userRepository.findOne({
      where: { email: trimmedEmail },
      select: ['name'],
    });

    // Send verification email
    await this.sendVerificationEmail(existingUser?.name || 'User', trimmedEmail, verificationCode);

    console.log('=== EMAIL VERIFICATION SENT SUCCESSFULLY ===');
    return { message: 'Verification code sent to your email' };
  }

  async getEmailVerificationStatus(email: string, user_type: 'tutor' | 'tutee' | 'admin'): Promise<{ is_verified: number; user_id?: number; verification_expires?: Date }> {
    console.log('=== EMAIL STATUS CHECK DEBUG ===');
    console.log('Checking verification status for:', email);
    console.log('Email type:', typeof email);
    console.log('Email length:', email.length);

    // Validate email parameter
    if (!email || typeof email !== 'string') {
      console.log('❌ Invalid email parameter:', email);
      throw new BadRequestException('Email is required and must be a valid string');
    }

    // Validate user_type parameter
    if (!user_type || !['tutor', 'tutee', 'admin'].includes(user_type)) {
      console.log('❌ Invalid user_type parameter:', user_type);
      throw new BadRequestException('User type is required and must be tutor, tutee, or admin');
    }

    // Trim and validate email
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      console.log('❌ Empty email after trimming');
      throw new BadRequestException('Email cannot be empty');
    }

    const verificationEntry = await this.emailVerificationRegistryRepository.findOne({
      where: { email: trimmedEmail, user_type: user_type },
    });

    if (!verificationEntry) {
      console.log('❌ No verification entry found for email/user_type:', trimmedEmail, user_type);
      return { is_verified: 0 };
    }

    const result: { is_verified: number; user_id?: number; verification_expires?: Date } = {
      is_verified: verificationEntry.is_verified ? 1 : 0,
    };

    // Include verification_expires if there's an active code (not verified and code exists and not expired)
    if (!verificationEntry.is_verified && verificationEntry.verification_code && verificationEntry.verification_expires) {
      const now = new Date();
      const expiresAt = new Date(verificationEntry.verification_expires);

      // Only return expiration if code hasn't expired yet
      if (expiresAt > now) {
        result.verification_expires = verificationEntry.verification_expires;
      }
    }

    return result;
  }

  async verifyEmailCode(email: string, code: string, user_type: 'tutor' | 'tutee' | 'admin'): Promise<{ message: string; user_id?: number }> {
    console.log('=== EMAIL VERIFICATION DEBUG ===');
    console.log('Verifying email:', email);
    console.log('Code:', code);
    console.log('User type:', user_type);
    console.log('Email type:', typeof email);
    console.log('Code type:', typeof code);

    // Validate parameters
    if (!email || typeof email !== 'string') {
      console.log('❌ Invalid email parameter:', email);
      throw new BadRequestException('Email is required and must be a valid string');
    }

    if (!code || typeof code !== 'string') {
      console.log('❌ Invalid code parameter:', code);
      throw new BadRequestException('Verification code is required and must be a string');
    }

    if (!user_type || !['tutor', 'tutee', 'admin'].includes(user_type)) {
      console.log('❌ Invalid user_type parameter:', user_type);
      throw new BadRequestException('User type is required and must be tutor, tutee, or admin');
    }

    const trimmedEmail = email.trim();
    const trimmedCode = code.trim();

    if (!trimmedEmail) {
      console.log('❌ Empty email after trimming');
      throw new BadRequestException('Email cannot be empty');
    }

    if (!trimmedCode) {
      console.log('❌ Empty code after trimming');
      throw new BadRequestException('Verification code cannot be empty');
    }

    // Find the verification entry by email and user_type
    const entry = await this.emailVerificationRegistryRepository.findOne({
      where: { email: trimmedEmail, user_type: user_type },
    });

    if (!entry) {
      console.log('❌ No verification entry found for email/user_type:', trimmedEmail, user_type);
      throw new NotFoundException('No verification request found for this email and user type.');
    }

    console.log('✅ Verification entry found:', { registry_id: entry.registry_id, email: entry.email, user_type: entry.user_type, is_verified: entry.is_verified });

    // Check if already verified
    if (entry.is_verified) {
      console.log('⚠️ Email is already verified in registry');
      return { message: 'Email is already verified', user_id: undefined }; // user_id is not relevant here yet
    }

    // Check if verification code exists
    if (!entry.verification_code) {
      console.log('❌ No verification code found in entry');
      throw new BadRequestException('No verification code found. Please request a new one.');
    }

    // Check if verification code is expired
    if (entry.verification_expires && new Date() > entry.verification_expires) {
      console.log('❌ Verification code has expired');
      throw new BadRequestException('Verification code has expired. Please request a new one.');
    }

    // Verify the code
    if (entry.verification_code !== trimmedCode) {
      console.log('❌ Verification code does not match');
      console.log('Expected:', entry.verification_code);
      console.log('Received:', trimmedCode);
      throw new BadRequestException('Invalid verification code');
    }

    // Mark email as verified in the registry
    entry.is_verified = true;
    entry.verification_code = null;
    entry.verification_expires = null;
    await this.emailVerificationRegistryRepository.save(entry);

    console.log('✅ Email verified successfully in registry');

    // Find if a user already exists with this email for the user_type
    const user = await this.userRepository.findOne({
      where: { email: trimmedEmail, user_type: user_type },
    });

    // If a user exists, and is pending verification, update their status
    if (user && user.status === 'pending_verification') {
      user.status = 'active';
      await this.userRepository.save(user);
      console.log('✅ Updated existing user status to active');
      return { message: 'Email verified successfully', user_id: user.user_id };
    }

    // If no user exists, or user is already active/inactive, just return success for verification
    return {
      message: 'Email verified successfully',
      user_id: undefined, // user_id is only returned if an existing user was updated
    };
  }

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
  }

  private async sendVerificationEmail(name: string, email: string, verificationCode: string): Promise<void> {
    try {
      console.log('=== SENDING VERIFICATION EMAIL ===');
      console.log('To:', email);
      console.log('Name:', name);
      console.log('Code:', verificationCode);

      // Check for required environment variables first
      const gmailUser = process.env.GMAIL_USER || 'johnemmanuel.devera@bisu.edu.ph';
      const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

      if (!gmailAppPassword) {
        console.log('❌ GMAIL_APP_PASSWORD is not set!');
        throw new Error('Email service not configured');
      }

      // Create transporter with explicit SMTP configuration (matching other services)
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: gmailUser,
          pass: gmailAppPassword,
        },
        tls: {
          // Do not fail on invalid certificates
          rejectUnauthorized: false,
        },
        connectionTimeout: 10000, // 10 seconds timeout
        greetingTimeout: 10000,
        socketTimeout: 10000,
      });

      const mailOptions = {
        from: `"TUTORFRIENDS" <${gmailUser}>`,
        to: email,
        subject: 'TutorFriends - Email Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
            <!-- Header with Logo -->
            <div style="text-align: center; margin-bottom: 30px; padding: 20px 0; border-bottom: 2px solid #e5e7eb;">
              <div style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 15px 30px; border-radius: 12px; margin-bottom: 15px;">
                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold; letter-spacing: 1px;">TutorFriends</h1>
              </div>
              <h2 style="color: #374151; margin: 10px 0; font-size: 20px; font-weight: 600;">Email Verification</h2>
            </div>
            
            <!-- Main Content -->
            <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding: 30px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
              <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0; line-height: 1.6;">
                Hello <strong>${name || 'User'}</strong>!
              </p>
              
              <p style="color: #374151; font-size: 16px; margin: 0 0 25px 0; line-height: 1.6;">
                Thank you for registering with TutorLink! To complete your account setup, please verify your email address using the verification code below:
              </p>
              
              <!-- Verification Code Box -->
              <div style="background-color: #ffffff; padding: 25px; border-radius: 12px; text-align: center; margin: 25px 0; border: 2px solid #4f46e5; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0; font-weight: 500;">Your verification code:</p>
                <h3 style="color: #4f46e5; font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace; text-shadow: 0 2px 4px rgba(79, 70, 229, 0.1);">
                  ${verificationCode}
                </h3>
              </div>
              
              <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
                <p style="color: #92400e; font-size: 14px; margin: 0; font-weight: 500;">
                  ⏰ <strong>Important:</strong> This code will expire in 15 minutes for security reasons.
                </p>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; margin: 20px 0 0 0; line-height: 1.5;">
                If you didn't request this verification code, please ignore this email. Your account will remain secure.
              </p>
            </div>
            
            <!-- Footer -->
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0 0 5px 0;">
                © 2024 TutorLink. All rights reserved.
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                Connecting students with expert tutors for academic success.
              </p>
            </div>
          </div>
        `
      };

      console.log('Mail options:', {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject
      });

      const result = await transporter.sendMail(mailOptions);
      console.log('✅ Verification email sent successfully');
      console.log('Message ID:', result.messageId);

    } catch (error) {
      console.log('❌ Failed to send verification email:', error);
      throw new Error(`Failed to send verification email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
