# RE3L — customer-owned email infrastructure

**Bring your email. Bring your database. Bring your AI. Own your data.**

RE3L is the service. Offgrid RC is a customer and pilot, not the service's mailbox or shared infrastructure.

## Two deployment roles

- **Public service portal**: the Vercel adapter defaults to service mode. It collects only domain, mailbox, customer deployment address and AI choice in browser memory. It generates credential-free setup downloads and links to the customer's portal. It does not call customer providers, store customer setup records, proxy customer credentials or expose mailbox APIs. `RE3L_MODE=service` makes the role explicit.
- **Customer workspace**: deploy `re3l/` in the customer's own hosting account with `RE3L_MODE=customer`, their separate PostgreSQL database, provider credentials and distinct owner/assistant secrets. Each deployment serves one customer mailbox. Live checks, messages and send approvals run there. `/setup` remains available for setup guidance.

A customer workspace is a separate deployment and database, not a row in a shared RE3L mailbox database. There is no central credential vault.

## Customer setup

1. Prepare the setup pack in the public portal. Downloads contain placeholders, not credentials.
2. Verify the customer's own email domain in their Resend account. Preserve existing DNS and email routing.
3. Provision their separate PostgreSQL database and apply all three `sql/` migrations.
4. Deploy the `re3l` directory in their hosting account. Enter credentials only in their deployment's secret manager.
5. Register signed email events after the endpoint is configured; leave existing live pilot routing intact until acceptance tests pass.
6. Check connections and test the complete approved-send, delivery, reply and persistent-thread loop.

See `docs/SELF-HOSTING.md` and `docs/API.md` for the supported development workflow.

## Current limits

The setup flow prepares a manual configuration handoff; it does not provision accounts or verify a connection just by generating a download. Resend and PostgreSQL are the current supported email/storage providers. The MCP adapter is experimental; native ChatGPT OAuth, revocation and installation are not implemented. A ChatGPT choice in setup does not establish a connection.

Do not advertise this as a production-ready public email service. Full external-inbox acceptance, backups/recovery, abuse protection, privacy review and independent customer-isolation deployment tests remain release gates. See `docs/PRODUCTION-GATE.md`.

The current repository also contains Offgrid RC website assets. Deploy only `re3l/` from `re3l-foundation`; do not merge this work into the website branch or alter the existing website project.
