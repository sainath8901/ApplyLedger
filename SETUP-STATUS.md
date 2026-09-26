# Live setup status

Updated 2026-09-26.

## Completed

- Supabase project: ApplyLedger (`fogqqaozszxvoeeksbgt`), Free, us-east-2.
- Database schema installed; RLS enabled, including private owner settings.
- Owner: sainathreddy8901@gmail.com. First live Google login succeeded and the database returned the owner role.
- Project URL and publishable key saved in config.js. No Google client secret is stored in source files.
- Google Cloud project: ApplyLedger (`woven-acolyte-509815-n0`).
- Google OAuth client: ApplyLedger Supabase; client secret saved only in Supabase.
- Google provider enabled. Email/password and anonymous sign-in disabled.
- Google identity scopes: email, profile and openid. No Gmail scopes.
- Owner account added as a Google test user.
- Site URL and extension redirect: https://pjjfckfabbedilooloogflnboceekhog.chromiumapp.org/google
- Local admin redirect allowed: http://127.0.0.1:8787/admin.html
- Live unauthenticated reads of profiles and job-device records return permission denied.
- Live admin page successfully displays the owner account, dashboard and owner inbox.
- Public homepage: https://applyledger.sai8901.chatgpt.site
- Public privacy policy: https://applyledger.sai8901.chatgpt.site/privacy/
- Google branding links saved and OAuth audience verified as **In production**. Google accounts no longer require the test-user list.

## Remaining

- Install the configured v2 extension folder in Chrome, then test the extension-specific callback, job capture and Chrome notifications. The browser-based Google callback has been tested successfully.
- Verify a second real Google account's member signup and admin-request flow. Database-level role and permission tests already pass.

The admin page can run locally with `node server/server.js`. This local process must be running to use http://127.0.0.1:8787/admin.html. The extension's admin page does not require this server.

Do not rerun the initial schema against this live project; it is already installed. Use migrations for changes.
