import { getEnv } from '../../config/env.ts';

export interface EmailDeliveryResult {
  success: boolean;
  error?: string;
}

export interface IEmailService {
  sendParticipantCredentials(
    to: string,
    name: string,
    tempPassword: string,
    eventTitle: string
  ): Promise<EmailDeliveryResult>;
}

export class EmailService implements IEmailService {
  private shouldFailNext = false;

  // Test helper seam for simulating provider failures
  setSimulateFailure(fail: boolean) {
    this.shouldFailNext = fail;
  }

  async sendParticipantCredentials(
    to: string,
    name: string,
    _tempPassword: string, // Plaintext password held only in memory, NEVER logged
    _eventTitle: string
  ): Promise<EmailDeliveryResult> {
    if (this.shouldFailNext) {
      return {
        success: false,
        error: 'Simulated email provider network failure',
      };
    }

    try {
      const env = getEnv();
      if (!env.EMAIL_PROVIDER_API_KEY) {
        return {
          success: false,
          error: 'Email provider not configured',
        };
      }

      // Simulated external provider call (e.g. Resend, Sendgrid, SES)
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Unknown email transmission error',
      };
    }
  }
}

export const emailService = new EmailService();
