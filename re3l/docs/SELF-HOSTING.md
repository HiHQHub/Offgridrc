# RE3L Core — customer-owned infrastructure

**Status: foundation only. Not deployable as a working email server yet.**

1. Register or use your own domain.
2. Create your own Resend account and verify your sending and receiving domain and relevant DNS records.
3. Provision a Postgres database **in your own account** with backups enabled. Production schema migrations are not yet available.
4. Deploy RE3L in **your own account**, configuring server-side `DATABASE_URL`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`. Never expose these variables to browsers or AI tools.
5. Configure Resend to forward authenticated event webhooks to your deployment (after endpoint implementation).
6. Connect the supported AI assistant to your authenticated API/MCP endpoint after OAuth setup.
7. Confirm read, draft, explicit send approval, send, receive and reply before relying on the account.

## Ownership contract

- RE3L does not require a central email store.
- Hosting, provider and database remain controlled by the customer.
- Never give deployment credentials to the RE3L marketing site.
- For managed setup, use scoped, revocable authorizations and show all actions before provisioning.
- Document provider quotas and any customer-borne costs.
- Backup/export must be tested before any migration or deletion.

## Technical status

The current GitHub code includes config validation, outbound provider adapter and Resend webhook signature validation. Persistence, the webhook HTTP handler, authorization, durable queues, full MCP integration, UI and deployment automation are outstanding; do **not** present this as a finished install.
