# RE3L customer-owned staging installation

This runs on infrastructure controlled by the customer. It is a **staging candidate**, not a production-certified release.

## Prerequisites
- Docker with Compose plugin
- Customer-owned Resend account/domain with sending and receiving activated
- Public HTTPS reverse proxy for Resend webhooks (only after authorization and end-to-end verification)
- Secure secret manager for credentials and backups

## Start (local-only)

1. Create `re3l/.env` locally (never commit) with `RE3L_DB_PASSWORD`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `RE3L_OWNER_TOKEN`, `RE3L_ASSISTANT_TOKEN`, `RE3L_DOMAIN`, and `RE3L_MAILBOX`.
2. Set `RE3L_OWNER_TOKEN` to a random 32+ byte token; do not expose it to an AI assistant. Use a separate token for read/draft access.
3. Run `docker compose up -d --build` in `re3l/`.
4. Visit `http://localhost:3000` and enter the owner token to check live connection status.
5. The PostgreSQL container and named volume belong to whoever runs this deployment. Back up the volume before modifying migrations.
6. Use a **separate staging domain** and provider account; do not change Offgrid RC DNS or its existing Resend webhook.
7. For external staging, provide HTTPS and reverse-proxy security controls. Never expose the database publicly.
8. Only configure webhook delivery after testing signature validation and retry/replay behavior.
9. Use owner UI to approve exact draft contents, including recipient, before sending a test message.

## Current restrictions

- The UI uses manually-entered owner credentials, not a complete user authentication system.
- No OAuth MCP client registration yet in this standalone package.
- The AI token is only suitable for integration development, not public release.
- Reply-header threading is implemented but needs the real external-inbox acceptance loop. Attachments are not persisted.
- The SQL init scripts run only on initial database creation; subsequent upgrades require a migration mechanism.
- Delivery failures must be reconciled manually before a retry to avoid duplicate sends.
- A customer-owned deployment still processes personal data; appropriate GDPR terms and documentation remain necessary.
