# RE3L production release gate — 2026-10-11

**Release status: BLOCKED. Do not advertise this foundation as production-ready.**

RE3L is the consumer product; Offgrid RC is its first pilot customer. `re3l/` is a customer-owned standalone deployment candidate. The existing Floot pilot is a different implementation. A working DNS API or green CI does not establish a working deployed mailbox.

## Critical hardening implemented

- Distinct owner/assistant credentials; AI cannot approve/send.
- Immutable draft review, short-lived approval and atomic single-use send claim.
- Transactional message processing and event deduplication, with rollback on failure.
- Retryable 503 response for signed webhook processing failures. Invalid signatures return 400.
- Raw UTF-8 webhook bytes preserved across network chunks.
- Reply-header correlation, thread retrieval, and reply drafts preserving external reply headers.
- Provider-generated outbound Message-ID reconciliation after sending. A failed metadata lookup never causes an automatic resend.
- Provider send timeout, stable idempotency key and privacy-safe generic error logging.
- Reproducible dependency lockfile and `npm ci` for CI/container builds.
- CI-only PostgreSQL fixtures covering persistence, replay, rollback, concurrent send claims, expired approvals and threads. No customer database or messages are used.

## Release gates still required

1. One separate customer-owned staging deployment, database, secrets and HTTPS endpoint. Vercel's current connector rejects the required team scope; no deployment has been verified. A newly authorized GitHub deployment token can be checked without exposing it.
2. Real authorized external-inbox loop: draft → owner confirmation → send → external delivery → reply → durable ingest → search/read/thread → owner-approved reply. Verify SPF/DKIM/DMARC, delivery events and webhook replay on that deployment.
3. A native ChatGPT connection with verified OAuth, per-user revocation and scoped authorization. Static bearer tokens are development credentials, not a production multi-user identity system.
4. Tested durable recovery/reconciliation for ambiguous sends, provider 429/500/timeouts and missing RFC Message-IDs. No automatic resend is allowed before reconciliation.
5. Backups and restore, credential rotation, retention/deletion/export and privacy review.
6. Public-service rate limiting/abuse protection, audit trails, suppression handling and attachment policies. These are not certified by current tests.
7. Independent second-customer isolation testing. This foundation uses one customer per deployment; do not pool unrelated customers in one database.

The historical `STAGING-TEST-REPORT.md` records the earlier baseline; its threading failure is addressed in code but not yet verified with an external inbox. Check the latest GitHub Actions run for the commit under test.

No Offgrid RC website, production DNS, live webhook, routing or stored customer messages were modified. No paid resource or upgrade was activated.
