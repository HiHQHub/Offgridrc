/** Provider-neutral email model. Never put access tokens in message data. */
export type EmailAddress = string;
export interface Address { email: EmailAddress; name?: string }
export interface OutboundMessage {
  from: Address;
  to: Address[];
  cc?: Address[];
  bcc?: Address[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: Address[];
  /** SMTP Message-ID header for replies, when supported by the adapter. */
  inReplyTo?: string;
}
export interface SentMessage { providerId: string }
export interface EmailProvider {
  readonly name: string;
  send(message: OutboundMessage, idempotencyKey?: string): Promise<SentMessage>;
}
export class ProviderError extends Error {
  constructor(message: string, readonly status?: number) { super(message); this.name = "ProviderError"; }
}
export function validateOutbound(message: OutboundMessage): void {
  if (!message.from.email || !message.to.length || message.to.some(a => !a.email)) throw new Error("A sender and recipient are required");
  if (!message.subject.trim()) throw new Error("Subject is required");
  if (!message.text?.trim() && !message.html?.trim()) throw new Error("Message body is required");
  if(message.inReplyTo&&!/^<[^<>\s]{1,998}>$/.test(message.inReplyTo))throw Error("Invalid reply header");
}
