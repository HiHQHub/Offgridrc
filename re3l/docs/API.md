# Customer-owned RE3L API — initial read-only implementation

The current standalone server is a **development MVP**, not a hardened public production service.

- `GET /health` — liveness only, no email contents
- `POST /webhooks/resend` — verify Svix-compatible Resend signature and retrieve inbound content from customer's Resend account
- `GET /api/status` — bearer authenticated configuration status
- `GET /api/messages?limit=30&q=term` — bearer authenticated list/search of messages in customer database
- `GET /api/messages/{uuid}` — bearer authenticated message read

All API routes other than liveness and verified webhook require an `Authorization: Bearer <RE3L_OWNER_TOKEN>` header. Use a randomly generated token, store it in customer-controlled secrets, never send it in URLs.

This interface is intentionally read-only: outbound messages must use an owner-approved draft/send flow, which is **not yet available in this standalone service**. Do not expose it as a ChatGPT connector until an OAuth authorization layer, separate approval path, and security review are completed.

For a local deployment, run `npm install`, apply `sql/001_initial.sql` to the customer's Postgres database, then set required environment secrets before `npm start`. A working always-on webhook requires a secure public HTTPS endpoint and a customer-controlled deployment. Do not replace the active pilot webhook until this service is tested.

Known limitations: no outgoing message threading yet, no attachment persistence, no durable asynchronous worker, and no automated setup portal.
