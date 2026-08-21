import { AppError } from '../../shared/errors.js';
export class DevelopmentEmailSender {
    async sendMagicLink() {
        // The development action URL is returned by the route; never log tokens in production.
    }
}
export class RemoteEmailSender {
    url;
    token;
    constructor(url, token) {
        this.url = url;
        this.token = token;
    }
    async sendMagicLink(message) {
        const response = await fetch(this.url, {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...(this.token ? { authorization: `Bearer ${this.token}` } : {}) },
            body: JSON.stringify({ template: 'authivara-magic-link', ...message }),
            signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok)
            throw new AppError('Email delivery provider is unavailable', 503, 'EMAIL_PROVIDER_UNAVAILABLE');
    }
}
