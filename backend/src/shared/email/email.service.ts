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
  async sendParticipantCredentials(
    to: string,
    name: string,
    tempPassword: string, // Plaintext password held only in memory, NEVER logged
    eventTitle: string
  ): Promise<EmailDeliveryResult> {
    try {
      const env = getEnv();
      if (!env.EMAIL_PROVIDER_API_KEY || !env.EMAIL_PROVIDER_URL) {
        return {
          success: false,
          error: 'Email provider not configured',
        };
      }

      const response = await fetch(env.EMAIL_PROVIDER_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${env.EMAIL_PROVIDER_API_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to,
          subject: `Your ${eventTitle} participant account`,
          text: `Hello ${name},\n\nYour temporary password is: ${tempPassword}\n\nSign in at ${env.APP_URL}.`,
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        return { success: false, error: 'Email provider rejected the message' };
      }
      return { success: true };
    } catch {
      return {
        success: false,
        error: 'Email provider request failed',
      };
    }
  }
}

export const emailService = new EmailService();
