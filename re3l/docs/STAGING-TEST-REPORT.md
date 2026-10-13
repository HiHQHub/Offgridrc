# Low-credit staging verification — 2026-10-11

Scope: `re3l-foundation`, application `re3l/`. Base commit: `5d8bc8d8172af2d3ad6a61e960c540150c7cbcae`.

Existing GitHub CI was rerun before additional testing: run `38117118932`, job `114405071926`, all steps successful. After the security fix, local typecheck and all 16 tests passed. HTTP tests run the actual server with synthetic credentials and an unreachable test database; they do not send email or use live data.

| Critical check | Result | Evidence / limit |
|---|---|---|
| Build and existing CI | PASS | Typecheck and tests passed on base commit; fixed code also passes locally. |
| AI draft interface | PASS (unit) | Existing MCP draft test; no real database persistence verified. |
| AI cannot approve/send | PASS (HTTP) | Actual server returns 403 for assistant credentials on both routes. |
| Authenticated MCP | PASS (HTTP/unit) | Missing/invalid tokens return 401; authenticated tool list exposes read/search/draft only. Live read/search pending. |
| Owner exact-email approval | BLOCKED (live) | Owner review UI and draft-specific approval exist; unit approval test passes. Full owner workflow not tested against PostgreSQL/provider. |
| Connection dashboard | PASS (source/HTTP only) | Connections/approval portal served; assistant denied connection status. Live status and browser UX not verified. |
| Customer-owned configuration | PASS (source/unit only) | Environment-based configuration and local-only Compose deployment. Actual account ownership/backups unverified. |
| Database connectivity/persistence | BLOCKED | No separate staging database connection is available. |
| Resend send, external delivery and reply | BLOCKED | No separate staging endpoint/domain/provider credentials are available. No email sent in this run. |
| Webhook authentication | PASS (unit/HTTP) | Signed fixture accepted, altered body rejected; actual server rejects unsigned request. |
| Webhook duplicate prevention | BLOCKED (database) | Unique provider/event keys exist in SQL; real webhook replay and persisted row counts untested. |
| Reply threading | FAIL (source) | Inbound ingestion always creates a fresh thread ID; no reply-header correlation. |
| Expired access tokens / native ChatGPT connection | BLOCKED / unsupported | Static bearer credentials have no access-token expiry or OAuth registration. Approval tokens have a database-enforced 10-minute expiry, not integration-tested. |

## Critical fix

Identical owner and assistant tokens previously classified as owner, granting the intended assistant credential approval/send access. Authentication now fails closed for shared tokens, and startup rejects shared or short assistant credentials. Regression and HTTP boundary tests added. No alternative implementation or broad refactor.

## Remaining blockers

For live staging, supply **one existing customer-owned HTTPS staging deployment of this branch**, a separate PostgreSQL database with both migrations applied, and staging Resend credentials/domain/webhook signing secret in its secret manager. Keep the owner credential outside the AI integration. Provide the staging URL and an explicitly authorized external test mailbox through the normal configuration/connection workflow, not raw secrets in chat.

The connected project inventory only identifies the existing Offgrid RC pilot, not a separate staging instance. Local staging environment variables are absent. No new deployment, paid resource, DNS modification, webhook change, live routing change, website edit, or customer-message access occurred. Existing live pilot history does not establish that this independent foundation works.

**Small private pilot readiness: NO — full email loop, durable persistence and replay prevention are unverified; threading is missing.**

Single next action: make the separate customer-owned staging deployment and its secure connection configuration available for the minimal acceptance loop. This run stops here; no automatic follow-on development cycle.
