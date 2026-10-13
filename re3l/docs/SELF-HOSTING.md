# Your customer-owned RE3L workspace

The public RE3L portal prepares a setup pack. Credentials and mailbox data belong only in your own deployment.

1. Use your own email domain and Resend account. Apply the exact sending/receiving DNS records Resend supplies; preserve existing email routing.
2. Create a separate PostgreSQL database in your account. Apply `sql/001_initial.sql`, `sql/002_drafts.sql` and `sql/003_message_id_index.sql` in order. Arrange and test backups before using real mail.
3. Deploy the `re3l/` directory from `re3l-foundation` in your own hosting account, separate from any existing website. Run `npm ci` and `npm run check`. Docker/Compose remain supported; Compose initializes SQL only on a fresh volume.
4. Set `RE3L_MODE=customer`, `RE3L_DOMAIN`, `RE3L_MAILBOX` and `RE3L_PUBLIC_BASE_URL`. Store `DATABASE_URL`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `RE3L_OWNER_TOKEN` and `RE3L_ASSISTANT_TOKEN` in your secret manager. Owner and assistant tokens must be distinct high-entropy secrets of at least 32 characters. Never give AI the owner token.
5. Register the signed Resend webhook at your own `/webhooks/resend` endpoint after configuration. Account-wide event metadata can include other mailbox recipients and subjects. RE3L verifies the signature and filters incoming recipients before fetching bodies. Leave existing live webhooks intact during acceptance testing.
6. Open your own portal to verify provider, domain and PostgreSQL access. Test draft → exact owner approval → send → external delivery → reply → durable storage → read/search/thread → owner-approved reply.
7. Development MCP clients use your `/mcp` endpoint and assistant credential. Native ChatGPT OAuth installation is not implemented. Do not claim a working ChatGPT connection from a configured token.

## Ownership and limits

One customer mailbox per deployment; separate databases and secrets for unrelated customers. No central RE3L mailbox store or shared customer credential vault. The public service deployment refuses mailbox APIs even if it has a database configured.

The setup pack is a manual handoff, not automatic provisioning. This is a development foundation, not a production-certified service. Public OAuth, revocation, durable recovery/reconciliation, attachments, abuse controls and full external acceptance still need verification before launch. Provider quotas and customer-borne costs remain applicable.
