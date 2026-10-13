# Separate Vercel staging project

Use the customer's Vercel account, repository `HiHQHub/Offgridrc`, branch
`re3l-foundation`, Root Directory `re3l`, and the included `vercel.json`.
Do not change the existing Offgrid RC project or merge this branch into main.
Set this project's production branch to `re3l-foundation` before future builds.

The API function reuses the existing HTTP handler. Docker/local startup remains supported.
The portal can be deployed before credentials exist; protected operations and health
return HTTP 503 `setup_required` until all required settings are present. A successful
Vercel build does not establish working database or email connections.

Configure these server-side values securely in this project:
`DATABASE_URL`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `RE3L_OWNER_TOKEN`,
`RE3L_ASSISTANT_TOKEN`, `RE3L_DOMAIN`, and `RE3L_MAILBOX`.
Owner and assistant tokens must be distinct and at least 32 characters.
Keep the owner token outside the AI-facing interface.
Apply the three SQL migrations to a separate customer-owned staging database.
Do not reuse the production webhook or change live routing for staging testing.

After configuration, verify health, owner connection status, permission checks and
the acceptance loop. Database provisioning, webhook registration and native ChatGPT
OAuth installation remain separate gates; this deployment does not imply they passed.
