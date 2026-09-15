# Deployment bundle

Copy the two Compose files and caddy/ from this directory to the parent directory
containing the worksauto-api, worksauto-web and worksauto-admin checkouts. Run
Compose from that parent directory. Development uses the additional dev override.

Required environment values: POSTGRES_PASSWORD, MINIO_ROOT_PASSWORD, JWT_SECRET,
and RUNTIME_DATABASE_PASSWORD (at least 24 characters). Use URL-safe generated
database passwords, or URL-encode credentials in connection URLs. Set SITE_ADDRESS
to the production hostname for Caddy automatic HTTPS and APP_BASE_URL to its HTTPS
origin. Infrastructure ports are bound to loopback. Source mounts exist only in
the development override. Notifications default to disabled; deliberately configure
providers and NOTIFICATION_DELIVERY_MODE=live for production delivery.

## Existing database rollout

Back up and rehearse restoration before migration. This release repairs a historical
migration gap and changes the historical RLS migration (dynamic database name and
no embedded role password). A database previously provisioned through `db push`,
or one with the later migrations already recorded, needs a schema/migration history
comparison and an explicitly reviewed baseline reconciliation. Do not blindly run
this release against an existing production database. The automated tests validate
the complete migration chain on an isolated database; they do not certify the state
of an existing deployment. Migration credentials belong in MIGRATION_DATABASE_URL;
the running application uses worksauto_app with NOSUPERUSER and NOBYPASSRLS.

Access token validation changed: existing sessions must sign in again. External
e-invoice submissions without implemented providers now fail explicitly; internal
invoices are drafts. PayTR duplicate/overlapping successful attempts require manual
reconciliation when an invoice was settled separately.
