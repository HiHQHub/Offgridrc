# RE3L Mail — community framework (foundation)

**Bring your domain. Bring your email. Bring your AI. Own your data.**

This directory is a standalone *foundation*, staged on an isolated development branch. It is not yet a working production mailbox, ChatGPT integration, or deployed portal. Existing Offgrid RC assets remain untouched.

## Ownership and trust boundaries

- The customer controls the domain, Resend (or other provider) account, application deployment, database/storage and chosen AI.
- RE3L core runs in customer-owned infrastructure; no central RE3L mailbox database is required.
- The AI communicates with the customer's deployment through authenticated tools; incoming email is untrusted content.
- RE3L Managed, if offered, automates configuration and maintenance without transferring account or data ownership.
- Provider free tiers are subject to provider limits; running a domain and AI may have separate costs.

## Initial scope

- Provider-neutral `EmailProvider` contract
- Resend outbound adapter, with explicit authorization using customer credentials
- Customer deployment configuration validation
- No secrets, live message content, or API keys committed to GitHub

## Status / limitations

- The real inbound email loop lives in a separate Floot RE3L Mail pilot, not the Offgrid RC website repository.
- Resend inbound support, storage, threading, MCP integration, deployment and portal must be built/audited next.
- Never expose a public sending endpoint before authentication, abuse controls and authorization are implemented.
- Do not repoint production Resend webhooks until replacement handling is tested.
- Customer-owned storage does not eliminate GDPR processor responsibilities when RE3L operates managed automation.

## Next steps

1. Inspect the existing Floot application when its daily build access becomes available.
2. Extract functional inbound/outbound workflow, tests and verified data structures.
3. Implement authenticated email tool endpoints, webhook signature verification, idempotency, message persistence and safe AI send approvals.
4. Build a self-hosted single-view control portal (not an inbox).
5. Move this directory into its own RE3L repository; do not merge into the Offgrid RC website.
