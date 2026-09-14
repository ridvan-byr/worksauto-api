# Reliability and production readiness remediation

This plan follows the September 14 review. Changes are validated against each
repository's actual CI workflow, not only the untracked workspace workflow.

## Delivery order

1. Prevent test messages from reaching third parties. Use `05523741500` and
   `ridvanemrebayar@gmail.com` in E2E fixtures. CI and automated tests must never
   contact notification transports or publish jobs to production queues.
2. Separate access/refresh credentials, revoke stale permissions, deliver OTP
   through the guarded provider, and protect public vehicle/media endpoints.
3. Correct payment concurrency, advance allocation, invoice validation,
   idempotency, notification retry semantics and provider failure reporting.
4. Make production Docker targets explicit; align proxy paths, health checks,
   secrets and database isolation. Preserve development startup separately.
5. Validate migrations, unit tests, integration tests and standalone browser
   tests in CI. Commit and push the verified changes with English messages.

## Additional product work identified by the review

- Model customer approval, quality control, delivery and refunds explicitly.
- Build availability from workshop hours and real resources.
- Implement provider-specific e-invoice submission and reconciliation before
  exposing a provider as available for live invoicing.
- Introduce a durable transactional outbox for external side effects.
- Extend the new runtime-role RLS integration suite to every domain and nested write path.
- Add off-site database/media backups and automated restore verification.
- Split oversized screens and paginate list/report endpoints.

These items need their own acceptance scenarios; an unavailable external
integration must fail explicitly rather than claim a simulated success.

## Verification record

Validated locally on September 15, 2026:

- API: lint, TypeScript, both architecture verifiers, production build; 195 unit tests.
- API integration: all 8 migrations applied to a newly created empty database;
  15 tests passed with the NOSUPERUSER/NOBYPASSRLS runtime role, including direct
  SQL isolation, transaction isolation, denied cross-tenant writes, workflow and
  competing payment requests. Redis and PostgreSQL were isolated CI services.
- Web: lint, TypeScript, 100 unit tests, 6 Chromium E2E tests.
- Admin: lint, TypeScript, 17 unit tests, 3 Chromium E2E tests.
- Both frontends: standalone production builds verified using `next build --webpack`.
  Default Turbopack builds could not bind their internal worker ports in this local
  environment, including outside the sandbox. CI retains its default build command.
- Production and development Compose configurations parse successfully.
- Browser fixtures deny unmocked API requests and WebSocket connections; notification
  transport tests assert zero network calls and zero queue publication in CI/Vitest.
  No live messaging, payment, or e-invoice provider calls were made for verification.

## Delivered changes and boundaries

Access/refresh token separation and active identity/session checks cover REST,
media and new WebSocket connections. Existing WebSockets close when the access token
expires; immediate revocation of an already connected socket remains future work.
Private media no longer becomes public merely because a photo row exists. Public
booking cannot transfer a registered vehicle to a different customer.

Payments and invoice creation/cancellation serialize on the same customer lock.
Invoice totals and snapshots use server-calculated cents. Advance offsets use a
separate payment method and are excluded from cash totals. PayTR uses real token
requests, verified callbacks, persisted attempts and a unique provider transaction
constraint; overlapping payments settled elsewhere require reconciliation.
Unimplemented e-invoice integrations now report unavailable instead of fabricating
success, balances or PDF links. Internal invoices remain drafts.

Redis idempotency now binds keys to user/request identity and awaits response
caching. It is still a bounded cache, not a durable exactly-once ledger; expiry,
crash recovery and transactional outbox work remain explicitly outstanding.

The deployment bundle is versioned in `deploy/` because the parent workspace is
not a Git repository. Read [deployment notes](../deploy/README.md) before upgrading
an existing database; migration history reconciliation is not automated. These
branches are not a production rollout. Remaining product work above is not claimed
as implemented by this change.

