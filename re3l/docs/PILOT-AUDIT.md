# RE3L pilot audit — 2026-10-11

## Verified from project inspection

Project: Floot "RE3L Mail — Offgrid RC Pilot" (separate from the Offgrid RC public site).

- Resend: `offgridrc.com` is verified, with sending and receiving enabled.
- Inbound Resend webhook exists, enabled, targeting Floot `/_api/re3l-webhook`.
- Service layer in `helpers/re3lCore.tsx` implements message operations, persistence, draft/approval/send, reply/forward, inbox synchronization, webhook verification, rate-limiting and event deduplication.
- `helpers/re3lProtocol.tsx` defines the AI/MCP tool descriptions and method mapping.
- `helpers/re3lOAuth.tsx` implements an OAuth path intended for a ChatGPT connection.
- Floot database schema contains RE3L-specific mailbox, message, tenant, event, audit, key and OAuth tables.
- UI offers pilot messaging and manual review for outbound drafts.
- Corrected missing `search` action mapping in owner endpoint in Floot. Type check clean; existing Jasmine spec suite passed (theme test only). These tests **do not** verify the live email loop.
- Current service is restricted to the Offgrid RC pilot address and allow-listed outbound recipients.

## Architectural gaps before release

1. Customer-owned hosting/database: pilot uses Floot-managed database, not a selectable customer-controlled database.
2. Multi-customer isolation has not been independently tested under actual multiple account ownership.
3. No verified general-purpose setup wizard for customer-owned Resend, DNS, Supabase and deployment.
4. Live ChatGPT OAuth/MCP connection and full end-to-end send-receive-reply workflow have not been tested in this audit.
5. Webhook replay, latency, retries and recovery need integration tests under simulated failure.
6. The pilot code hardcodes its address, Resend domain identifier, provider credentials and recipient allowlist. Replace these with per-customer configuration and secret vaulting before onboarding users.
7. Current frontend is an email pilot console, not the proposed connection-management control portal.
8. A smoke-test route has a privileged test token and fixed scenario data; eliminate or strongly isolate it in production.
9. Distinguish centrally processed data from customer-held data and document residual privacy/GDPR duties.
10. Source implementation currently lives in Floot; this GitHub directory is an independent foundation, **not** a verified full copy of the running application.

## Safe migration plan

1. Preserve all existing pilot routing, keys and message history. Do not repoint webhooks yet.
2. Export or mirror *source code only* from Floot into a clean dedicated RE3L repository. Never export or commit live messages or secrets.
3. Extract pure protocol/types/provider code into testable modules; add comprehensive unit tests and test fixtures.
4. Introduce an external customer-controlled Postgres connection and isolated storage; deploy one test instance under customer ownership.
5. Make credentials and domain mailbox configuration tenant-specific. Add migrations, backup/restore and exit/export mechanisms.
6. Implement authenticated customer portal focused on connected services and permissions.
7. Validate setup on a second domain/account with separate keys and database.
8. Once the independent deployment passes full end-to-end and security tests, perform an approved, reversible pilot cutover.

## Live safety

No edits to the Offgrid RC website, live DNS, Resend webhook or production outbound recipient policy were made during this audit.
