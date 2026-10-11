# RE3L Mail — Work acceptance test (only after GitHub CI passes)

**Do not cut over production Offgrid RC DNS, webhooks, API credentials, or messages.**

## Gate before launching Work

- Build/test CI green.
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

- Current GitHub standalone API uses a single bearer owner token. It is **not acceptable to give this token to an AI**.
- Same bearer token can create, approve and send drafts, so an AI-facing integration is **unsafe until a separate human authorization session, limited AI scopes and OAuth are implemented and verified**.
- Draft send errors are ambiguous and require provider reconciliation; do not permit automatic retries until verified.
- Email content is processed by RE3L code; customer ownership does not remove privacy/regulatory responsibilities.
- Portable multi-provider setup and complete customer portal are not yet built.

**Outcome:** produce a pass/fail evidence report, precise reproducible defects and launch/no-launch recommendation. Never report production ready based on screenshots or a successful isolated send alone.
