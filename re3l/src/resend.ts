import { ProviderError, validateOutbound, type EmailProvider, type OutboundMessage, type SentMessage, type Address } from "./types.ts";

/** Outbound adapter only. Inbound delivery is a separate authenticated webhook pipeline. */
export class ResendProvider implements EmailProvider {
  readonly name = "resend";
  constructor(private readonly apiKey: string, private readonly fetchFn: typeof fetch = fetch) {
    if (!apiKey.trim()) throw new Error("Missing customer-owned Resend API key");
  }
  async send(message: OutboundMessage, idempotencyKey?: string): Promise<SentMessage> {
    validateOutbound(message);
    const display = (a: Address): string => a.name ? `${a.name} <${a.email}>` : a.email;
    const headers: Record<string,string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json"
    };
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    const payload = {
      from: display(message.from),
      to: message.to.map(display),
      ...(message.cc?.length ? { cc: message.cc.map(display) } : {}),
      ...(message.bcc?.length ? { bcc: message.bcc.map(display) } : {}),
      ...(message.replyTo?.length ? { reply_to: message.replyTo.map(display) } : {}),
      subject: message.subject,
      ...(message.text !== undefined ? { text: message.text } : {}),
      ...(message.html !== undefined ? { html: message.html } : {})
    };
    let response: Response;
    try {
      response = await this.fetchFn("https://api.resend.com/emails", { method:"POST", headers, body: JSON.stringify(payload) });
    } catch {
      throw new ProviderError("Email provider request failed");
    }
    if (!response.ok) throw new ProviderError(`Resend delivery request failed (HTTP ${response.status})`, response.status);
    const data = await response.json() as { id?: unknown };
    if (typeof data.id !== "string" || !data.id) throw new ProviderError("Email provider returned no message ID");
    return { providerId: data.id };
  }
}
