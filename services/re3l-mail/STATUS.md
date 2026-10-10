# Handoff — 10 October 2026, 04:22 UTC

The real email loop is verified, using the current development backend and Resend bridge. The complete user-facing pilot is NOT finished.

Floot's free account reached 100 build actions/day. Actions reset 10 October 2026 at 16:00 UTC / 17:00 Europe/London. No upgrade was activated. Further code edits, reads, cleanup and publication were refused. Do not repeatedly retry before the reset.

## Resume in this order

1. Batch the remaining edits in ONE Floot apply_patch rather than many edit_file calls.
2. Apply the corrected `floot/endpoints/re3l-owner_POST.ts` from this branch. The live file's enum was expanded to retry/search before the limit hit, but its branches/map were not. This leaves one known TypeScript issue; the previously tested operations still have their existing runtime branches.
3. Remove temporary authenticated `endpoints/re3l-smoke_POST.ts` and its schema. It uses a private one-time diagnostic token and allows ONLY the authorised pilot tests/setup. Do not copy it into GitHub or a published build. Revoke test key ID `8a6f5fc8-8a4c-4faf-9dd6-33c022bc48ce` in re3l_keys. Diagnostic access is not a general user feature.
4. Finish the owner UI: real server-side search, explicit reply mode, review/send drafts made by ChatGPT, safe retry button. Add connection revocation controls. Preserve React escaping of email bodies.
5. Validate the OAuth code-exchange/refresh flow and expiry/replay/audience failures against live Postgres. Unit checks pass, but that flow has not yet been exercised through an installed ChatGPT app.
6. Typecheck the COMPLETE app, inspect a screenshot and verify authenticated owner controls.
7. Publish the separate Floot app ONCE under an available subdomain. `re3l-mail-offgridrc` is proposed, NOT deployed. Update static OAuth metadata and issuer/resource URLs if the chosen URL differs, before the final build.
8. Update existing Resend webhook `baa145a1-b6a3-4c01-b59d-39b5d1afe08c` to the PUBLISHED `/_api/re3l-webhook` URL. Signing secret is already AES-GCM encrypted in re3l_settings; no need to ask for/paste it.
9. Verify unauthenticated MCP challenge at production, including actual WWW-Authenticate (Floot CDN remapping), JSON metadata content type, tool discovery and OAuth.
10. Have owner connect the ChatGPT app through its native consent UI. This user-account action cannot be replaced by claiming a headless protocol test proves installation. Test one read/draft/send using the INSTALLED connection; sending uses the exact-draft owner approval safeguards.
11. Mark pilot complete only after those tests. Postal deployment, new infrastructure and commercial product work remain deferred.

## Verified

- Actual sending to Hotmail, incoming replies, RE3L reply, both delivery statuses.
- RFC header correlation and retrieval through a scoped MCP JSON-RPC tool call.
- Signed webhook received and stored an actual external reply automatically.
- Cross-tenant read denial, read-only write denial, invalid approval denial against live DB.
- Ten local security tests pass.
- Website returned HTTP 200 with Vercel server header and original title; no root website files changed.
- Sending DNS/DKIM verified; DMARC monitoring policy installed.

## Other limitations

- Detailed Vercel project audit blocked by the connector's team scope; no CLI is available. Do not request reauthentication unless website deployment work actually becomes necessary.
- Current application still depends on Resend; self-hosted Postal transport is selected, not implemented.
- Free Floot background tasks are not entitled. Standalone Node worker is supplied but not live-tested. Do not buy Pro solely to enable retries.
- `floot/` contains deployment adapters and a corrected owner endpoint, not a complete Floot authentication/UI project export. Existing Floot auth/pages are intentionally reused.
- Incoming attachment metadata retained; binary persistence/download/scanning and robust HTML-only handling remain gaps.
- Mail retention/deletion automation and commercial tenant/domain onboarding are not implemented.

No paid service was activated. Existing hosting/compute and work-session credits are metered; do not claim zero cost.
