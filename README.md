# ApplyLedger — Google sign-in edition

Chrome application tracking with Google accounts, a free Supabase backend, and owner-controlled administrator access.

## Your access model

| Account | Access |
| --- | --- |
| Owner: `sainathreddy8901@gmail.com` | Personal tracking, all team stats, signup notifications, approve/reject admin requests, grant/revoke administrators |
| Approved administrator | Personal tracking and all team stats; cannot grant roles or review the owner's inbox |
| Member | Personal tracking and an option to request admin access |

Anyone with a Google account can join as a member. Joining creates a notification for the owner. Admin requests require your explicit approval. The owner role is assigned only to the configured Google identity and is then bound to its immutable account ID. The first person to sign up does **not** become admin.

**Status:** Supabase and Google OAuth are configured. A live Google sign-in successfully opened the owner dashboard. Google public publishing and extension-specific acceptance tests remain. See SETUP-STATUS.md.

## Start here

Follow **SETUP-GOOGLE.md**. There is no paid runtime dependency. Supabase Free hosts authentication and the database. The admin page is included inside the extension, so you do not need a separate website host.

After configuration, load the extension in Chrome, sign in with your owner account, and open **Account & workspace → Open admin dashboard**. Enable owner notifications if you want Chrome alerts.

## Features

- Local saving, Google profiles, server sync, and JSON exports.
- Saved, In progress, Needs confirmation, Submitted, Applied, Reviewing, Screening, Interview, Offer, Accepted, Rejected, Withdrawn.
- Immutable automatically captured details with append-only status history. Users can edit their own manually entered details.
- Daily/weekly/monthly/yearly/all-time stats, member filtering, role/company search, status filters, and application histories.
- Owner inbox for signups and admin requests, role grant/revoke controls, and access audit history.
- Optional Chrome notifications for the owner. They arrive while the owner's extension is signed in and Chrome is running, usually on the next one-minute check. In-app notices remain available later. No email notifications are configured.
- Sync after local changes and retries while Chrome is running. Unchanged job snapshots are not uploaded again on each check. The admin shows each user's most recent successful upload time.

## How tracking works

Use **Save this job to my journey** from the popup, or **Add application** in the dashboard. Page-saved details are locked; manually entered details can be edited. Update progress through **Journey** and add notes there.

Enable tracking individually on each application portal. Common English submit buttons create a Needs confirmation event. A matching success message can add Submitted. Detection is heuristic, so check uncertain captures. It does not support every iframe, shadow DOM, custom flow or cross-domain redirect.

Later employer status changes are entered manually in this release. It does not read Gmail, poll employer accounts, or promise automatic detection of every review/interview/rejection. Google sign-in requests identity, email and profile scopes only.

## Reporting definitions

- Jobs tracked: created in the selected calendar period.
- Applications sent: first Submitted or Applied event in the period. Other statuses do not count as an application sent.
- Accepted: jobs created in the period whose current stage is Accepted.
- Weeks start Monday; dates use the viewing browser's timezone.
- Each device uploads its own records. The same user on multiple devices appears as one member with the device records combined. There is no automatic download/merge into another device yet.

## Files

- `manifest.json`, `background.js`, `content.js`, `popup.*`, `dashboard.*`: Chrome extension.
- `auth.js`, `config.js`: Google/Supabase authentication and public project settings.
- `admin.html`, `admin.js`: owner/admin/member web interface; also runs inside the extension.
- `supabase/schema.sql`: database tables and protected API functions.
- `tests/`: client, worker and database authorization tests.
- `server/server.js`: optional localhost-only static admin preview. It has no application database or credentials.

## Security boundaries

The database checks the current stored role on every privileged request. Editing UI state or local storage cannot promote an account. A member cannot read team records or write another user's data. Only the owner can grant/revoke roles and decide admin requests, and the owner cannot be demoted through the app. Role changes are audited.

Google's OAuth authorization-code flow uses PKCE. Supabase verifies identities and issues sessions. The extension stores its Supabase session in extension storage restricted to trusted extension pages. The optional website uses per-tab session storage. No Google provider access token is retained. Signing out clears the local session even if remote logout fails.

Automatically captured fields and already-synced timeline events are checked by the database and cannot be rewritten through the app API. Local storage remains accessible to the computer owner; this app cannot prove that a user actually submitted a job or reported a truthful outcome.

Keep Supabase project ownership, Google project access and service-role/secret keys private. Anyone with direct database-owner privileges can alter database rules. A publishable/anon key is designed for client use and does not grant administrator access.

Google sign-in requires connectivity. Once signed in, local records can be created offline; sync retries later. Local records are not encrypted on disk by this app. Removing the extension removes its local storage; server-synced records remain but no restore wizard is included.

## Existing v1 data

The v2 extension uses a separate Google-account store (`dbV2`), leaving the old local PIN store untouched. The v1 local-PIN and shared-key backend routes are removed from the current package. Do not remove a v1 installation that contains real records before exporting them. There is no automatic migration that assigns old PIN profiles to Google identities; migrate those records only after confirming the matching accounts.

## Tests

With Node.js 24:

```powershell
node --test tests/auth.test.mjs tests/worker.test.mjs
```

Database tests were executed against PostgreSQL 16 with local stand-ins for Supabase Auth. They cover owner bootstrapping, forged role metadata, anonymous access, direct-table denial, member isolation, admin grant/revoke/approve/reject, owner-only inbox, captured fields and append-only history. See `tests/README.md` for reproduction.

The admin UI was exercised with test-only fixtures for owner approval and the member access-request screen. Live Supabase Google OAuth, Chrome permission prompts, desktop notification delivery, and real job-portal capture still need acceptance testing after configuration.
