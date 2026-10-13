# Customer-owned RE3L API — release candidate, not production-certified

The current standalone server is a **development MVP**, not a hardened public production service.

- `GET /health` — liveness only, no email contents
- `POST /webhooks/resend` — verify Svix-compatible Resend signature and retrieve inbound content from customer's Resend account
- `GET /api/status` — bearer authenticated configuration status
- `GET /api/messages?limit=30&q=term` — bearer authenticated list/search of messages in customer database
- `GET /api/messages/{uuid}` — bearer authenticated message read

All protected routes require a bearer credential. Use the separate `RE3L_ASSISTANT_TOKEN` for AI read/search/thread/draft operations; never give AI the `RE3L_OWNER_TOKEN`. Both configured tokens must be distinct and at least 32 characters. Store credentials in customer-controlled secrets, never in URLs.

Only the owner can approve and send. The portal displays recipient, subject and full body before confirmation. Approval is bound to an immutable draft, expires after ten minutes, and is atomically consumed before sending. Public OAuth/ChatGPT interoperability remains unverified.

- `POST /api/drafts` — draft creation with `to`, `subject`, `text`, and optional `reply_to_id` (a stored message UUID). Reply recipients must match the conversation; the parent needs a reconciled RFC Message-ID.
- `POST /api/drafts/{uuid}/approve` — bearer authenticated issue of a short-lived approval token.
- `POST /api/drafts/{uuid}/send` — bearer authenticated send of the approved draft with `approval_token`.
- `GET /` — connections dashboard and owner-only approval queue. Credentials stay in browser memory.

For a local deployment, run `npm ci`, apply `sql/001_initial.sql`, `sql/002_drafts.sql`, then `sql/003_message_id_index.sql` to the customer's Postgres database, and set required environment secrets before `npm start`. Compose runs these only on a fresh volume; existing volumes need explicit migration. Do not replace the active pilot webhook until this service passes its release gates.

Replies use In-Reply-To/References for correlation, and outbound RFC Message-IDs are retrieved after accepted sends. If provider metadata retrieval fails, external-thread correctness remains uncertain and needs reconciliation. Subjects alone are never used to join conversations. Signed webhook processing and event deduplication are transactional; transient failures return 503 for provider retries. Sending has a bounded timeout and a stable idempotency key. Ambiguous outcomes are never automatically resent.

Known limitations: no production OAuth/MCP integration, no attachment persistence, no durable asynchronous worker, no automatic outcome reconciliation, and no automated setup portal. See `PRODUCTION-GATE.md`.

## Isolated assistant access (foundation)

Set a different high-entropy `RE3L_ASSISTANT_TOKEN` in the customer's own deployment. That token permits listing, reading, searching and creating drafts **only**. It cannot access approve/send routes. The owner token permits both and **must not** be passed to AI tools.

This is a capability boundary for API testing, **not** production-ready OAuth. Assistants need a verified user-specific authorization flow with revocation, narrow scopes, CSRF protections, confirmation policies and audited consent before public launch. The owner portal can approve/send, but its manually entered bearer credential is not a complete account authentication system.

## MCP staging endpoint

`POST /mcp` accepts JSON-RPC 2.0 requests for `initialize`, `tools/list`, `tools/call` and `ping`. An assistant bearer credential can list/search/read messages and create drafts, but **cannot approve or send**. The owner has a separate approval queue in the industrial control portal. This is an **experimental MCP adapter**, not a production ChatGPT app: OAuth discovery/authorization and client interoperability must be validated before connecting ChatGPT.

`get_thread` takes `{ "id": "<thread UUID>" }`. `create_draft` takes `{ "to": "test@example.net", "subject": "Re: test", "text": "Draft reply", "reply_to_id": "<stored message UUID>" }` for a reply. These operations never approve or send email.
