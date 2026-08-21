import { AppError } from '../../shared/errors.js';

export interface MagicLinkMessage {
  recipient: string;
  actionUrl: string;
  expiresInMinutes: number;
}

export interface EmailSender {
  sendMagicLink(message: MagicLinkMessage): Promise<void>;
}

export class DevelopmentEmailSender implements EmailSender {
  async sendMagicLink(): Promise<void> {
    // The development action URL is returned by the route; never log tokens in production.
  }
}

export class RemoteEmailSender implements EmailSender {
  constructor(private readonly url: string, private readonly token?: string) {}

  async sendMagicLink(message: MagicLinkMessage): Promise<void> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(this.token ? { authorization: `Bearer ${this.token}` } : {}) },
      body: JSON.stringify({ template: 'authivara-magic-link', ...message }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new AppError('Email delivery provider is unavailable', 503, 'EMAIL_PROVIDER_UNAVAILABLE');
  }
}
