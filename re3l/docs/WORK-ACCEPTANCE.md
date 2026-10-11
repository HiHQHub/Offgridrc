# RE3L Mail — Work acceptance test (only after GitHub CI passes)

**Do not cut over production Offgrid RC DNS, webhooks, API credentials, or messages.**

**2026-10-11 audit clarification:** The existing `re3l-mail-staging` Vercel deployment is a public setup/service portal, not proof of a functioning customer mailbox. `re3l/api/index.ts` defaults to service mode and deliberately rejects mail operations outside customer mode. Customer mail testing requires a separate customer-owned workspace, database and secrets. A Vercel `READY` state confirms deployment only, not send/receive readiness. See `docs/PRODUCTION-GATE.md` for the authoritative current release blockers.

## Gate before launching Work

- Confirm build/test CI green for the exact commit under test (do not infer this from a READY deployment).
- Separate RE3L repository ready.
- Customer-owned staging database and Resend staging domain/credentials prepared.
- No secret copied to chat, Git, or centrally owned RE3L store.
- Human owner has explicitly authorized deployment and provisioning.

## Test in Work's cloud browser against a staging instance

1. Create a fresh customer-owned test domain/subdomain and Resend account.
2. Configure SPF/DKIM/MX/DMARC through permitted customer-owned DNS credentials, without modifying the pilot domain.
3. Provision separate PostgreSQL in customer's account; run migrations; confirm backups.
4. Deploy staging API using customer's own hosting, secrets and storage.
5. Verify connection/status screen reports ownership and failures honestly.
6. Send a test message after user approval; inspect delivery status and sender authentication.
7. Reply from a second external mailbox; verify signature, ingest, search, read and threading.
8. Replay the exact webhook twice; ensure only one message is persisted.
9. Simulate provider 429, 500 and timeouts; ensure retry is safe and no duplicate send.
10. Verify expired/invalid tokens cannot read, draft, approve or send.
11. Verify incoming email cannot instruct the assistant to send messages without trusted human approval.
12. Test data export, backup/restore, credential revocation and provider disconnection.
13. Test setup from a fresh browser session and mobile screen.
14. Confirm no RE3L-operated central mailbox data store receives or retains customer content.
15. Independently test a second customer's instance and verify isolation.

## Fail-closed release blockers

- The owner bearer token must never be provided to an AI. The current standalone API also supports a distinct assistant token for read/draft only; verify negative authorization tests against the deployed customer workspace.
- Current code separates assistant and owner bearer credentials and denies AI approve/send; however, static development tokens are **not** production OAuth or revocable per-user authorization. Verify the separation at runtime before any AI connection.
- Code includes send idempotency safeguards, but ambiguous provider outcomes still require **live reconciliation tests**. Never automatically resend without verifying provider state.
- Email content is processed by RE3L code; customer ownership does not remove privacy/regulatory responsibilities.
- Portable multi-provider setup and complete customer portal are not yet built.

**Outcome:** produce a pass/fail evidence report, precise reproducible defects and launch/no-launch recommendation. Never report production ready based on screenshots or a successful isolated send alone.
