import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { parseBooleanFlag } from '@/utils/env.util';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly enabled: boolean;

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {
    this.enabled = parseBooleanFlag(
      this.configService.get<string | boolean>('MAIL_ENABLED'),
      true,
    );
  }

  async sendOtp(email: string, otp: string, expiresInMinutes: number = 5) {
    if (!this.enabled) {
      this.logger.warn(
        `MAIL_ENABLED=false. OTP email skipped for ${email}. OTP: ${otp}`,
      );
      return true;
    }

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Your 2FA OTP Code',
        template: './otp', // path to hbs file without extension
        context: {
          subject: 'Verification Code',
          otp,
          expiresIn: expiresInMinutes,
          currentYear: new Date().getFullYear(),
          appName: this.configService.get<string>('APP_NAME', 'Gym Management'),
        },
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send OTP to ${email}: ${message}`);
      return false;
    }
  }

  async sendVerificationEmail(email: string, url: string) {
    if (!this.enabled) {
      this.logger.warn(
        `MAIL_ENABLED=false. Verification email skipped for ${email}. URL: ${url}`,
      );
      return true;
    }

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Verify your email address',
        template: './verification',
        context: {
          url,
          currentYear: new Date().getFullYear(),
          appName: this.configService.get<string>('APP_NAME', 'Gym Management'),
        },
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to send verification email to ${email}: ${message}`,
      );
      return false;
    }
  }

  async sendPasswordReset(email: string, url: string) {
    if (!this.enabled) {
      this.logger.warn(
        `MAIL_ENABLED=false. Password reset email skipped for ${email}. URL: ${url}`,
      );
      return true;
    }

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Reset your password',
        template: './password-reset',
        context: {
          url,
          currentYear: new Date().getFullYear(),
          appName: this.configService.get<string>('APP_NAME', 'Gym Management'),
        },
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to send password reset email to ${email}: ${message}`,
      );
      return false;
    }
  }
}
