/** Customer-owned deployment settings. Configuration contains references, never secrets. */
export interface DeploymentConfig {
  version: 1;
  domain: string;
  mailbox: string;
  provider: "resend";
  databaseUrlEnv: "DATABASE_URL";
  providerKeyEnv: "RESEND_API_KEY";
  webhookSecretEnv: "RESEND_WEBHOOK_SECRET";
}
export function validateConfig(input: unknown): DeploymentConfig {
  if (typeof input !== "object" || input === null || Array.isArray(input)) throw Error("Configuration object required");
  const c = input as Record<string,unknown>;
  const domain = String(c.domain || "").toLowerCase().trim();
  const mailbox = String(c.mailbox || "").toLowerCase().trim();
  if (!/^(?=.{1,253}$)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(domain)) throw Error("Invalid domain");
  if (!/^[^\s@]+@[^\s@]+$/.test(mailbox) || mailbox.split("@")[1] !== domain) throw Error("Mailbox must belong to your domain");
  if (c.version !== 1 || c.provider !== "resend") throw Error("Unsupported RE3L configuration");
  return {version:1,domain,mailbox,provider:"resend",databaseUrlEnv:"DATABASE_URL",providerKeyEnv:"RESEND_API_KEY",webhookSecretEnv:"RESEND_WEBHOOK_SECRET"};
}
