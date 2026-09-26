# Verification

Run the Node tests from the ApplyLedger directory:

```
node --test tests/auth.test.mjs tests/worker.test.mjs
```

The worker test creates a temporary sibling folder containing test public config and mocks authentication HTTP responses. It never contacts Google or Supabase. It removes only that generated folder on completion.

For database authorization tests, use a fresh **disposable PostgreSQL 16 database** with a superuser connection. Do not use a real Supabase project or real user data. Run, in order:

```
psql -v ON_ERROR_STOP=1 -f tests/auth-stubs.sql
psql -v ON_ERROR_STOP=1 -f supabase/schema.sql
psql -v ON_ERROR_STOP=1 -f tests/authorization.sql
```

Add your local host, port, database and superuser parameters to each command. `auth-stubs.sql` creates stand-ins for Supabase's auth schema and API roles; it is not a production migration. The main schema and authorization tests were executed successfully against PostgreSQL 16.2 during development.

Coverage includes first-member signup, malicious role metadata, owner-only bootstrap, direct-table denial, unauthenticated access, signup/request notices, approve/reject decisions, grants/revocations, delegated admin limits, captured-field integrity, history preservation and cross-account sync denial.

Remaining live acceptance tests: Google consent/redirect and token renewal on the actual project, Chrome site permissions and notifications, and real job-site submissions. Browser layout checks used disposable fixtures and did not perform a live Google login.
