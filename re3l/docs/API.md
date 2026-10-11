# Customer-owned RE3L API — initial read-only implementation

The current standalone server is a **development MVP**, not a hardened public production service.

- `GET /health` — liveness only, no email contents
- `POST /webhooks/resend` — verify Svix-compatible Resend signature and retrieve inbound content from customer's Resend account
- `GET /api/status` — bearer authenticated configuration status
- `GET /api/messages?limit=30&q=term` — bearer authenticated list/search of messages in customer database
- `GET /api/messages/{uuid}` — bearer authenticated message read

All API routes other than liveness and verified webhook require an `Authorization: Bearer <RE3L_OWNER_TOKEN>` header. Use a randomly generated token, store it in customer-controlled secrets, never send it in URLs.

Draft creation and sending are now present in the code, but remain **unverified for production use**. The same owner bearer token can approve a draft; this does not yet provide a separate trusted, interactive user-consent screen. Never give this owner token directly to an AI agent. Do not expose it as a ChatGPT connector until an OAuth authorization layer, separate approval path, and security review are completed.

- `POST /api/drafts` — bearer authenticated draft creation with `to`, `subject`, `text`.
- `POST /api/drafts/{uuid}/approve` — bearer authenticated issue of a short-lived approval token.
- `POST /api/drafts/{uuid}/send` — bearer authenticated send of the approved draft with `approval_token`.
- `GET /` — static customer-ownership overview; not yet a signed-in management portal.

For a local deployment, run `npm install`, apply `sql/001_initial.sql` to the customer's Postgres database, then set required environment secrets before `npm start`. A working always-on webhook requires a secure public HTTPS endpoint and a customer-controlled deployment. Do not replace the active pilot webhook until this service is tested.

Known limitations: no separate owner consent UI, no production OAuth/MCP integration, no outgoing message threading yet, no attachment persistence, no durable asynchronous worker, and no automated setup portal.

## Isolated assistant access (foundation)

Set a different high-entropy `RE3L_ASSISTANT_TOKEN` in the customer's own deployment. That token permits listing, reading, searching and creating drafts **only**. It cannot access approve/send routes. The owner token permits both and **must not** be passed to AI tools.

This is a capability boundary for API testing, **not** production-ready OAuth. Assistants must use a proper user-specific OAuth flow with revocation, narrow scopes, CSRF protections, confirmation policies and audited consent before launch. The static portal is informational and cannot approve a message interactively yet.

## MCP staging endpoint

`POST /mcp` accepts JSON-RPC 2.0 requests for `initialize`, `tools/list`, `tools/call` and `ping`. An assistant bearer credential can list/search/read messages and create drafts, but **cannot approve or send**. The owner has a separate approval queue in the industrial control portal. This is an **experimental MCP adapter**, not a production ChatGPT app: OAuth discovery/authorization and client interoperability must be validated before connecting ChatGPT.
