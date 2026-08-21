export interface MagicLinkMessage {
    recipient: string;
    actionUrl: string;
    expiresInMinutes: number;
}
export interface EmailSender {
    sendMagicLink(message: MagicLinkMessage): Promise<void>;
}
export declare class DevelopmentEmailSender implements EmailSender {
    sendMagicLink(): Promise<void>;
}
export declare class RemoteEmailSender implements EmailSender {
    private readonly url;
    private readonly token?;
    constructor(url: string, token?: string | undefined);
    sendMagicLink(message: MagicLinkMessage): Promise<void>;
}
