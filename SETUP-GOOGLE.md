# Free setup: Google sign-in + Supabase

You own the Google and Supabase accounts. Do not give this app—or a chat—your Google password, database password, Google client secret, or Supabase secret/service-role key.

## Step 1 — Create a free Supabase project

1. Open https://supabase.com/dashboard and sign up/sign in.
2. Create a new project named **ApplyLedger** in a **Free** organization. Store its database password in your password manager.
3. Choose a nearby region and wait for the project to finish provisioning.
4. In the project's connection/API settings, copy the **Project URL** (`https://….supabase.co`) and **publishable key** (`sb_publishable_…`). A legacy `anon` key also works. These two values are public client settings.

You can share those two public values in this task and I can configure the files for you. No paid plan or custom domain is needed.

Supabase currently lists a $0 Free plan with 50,000 monthly active users and 500 MB of database storage; free projects can pause after a week of inactivity. Keep the project on Free and monitor its usage. [Current pricing](https://supabase.com/pricing)

## Step 2 — Install the database rules

1. Open your project's **SQL Editor** and create a query.
2. Copy the contents of `supabase/schema.sql` into it and run it **once in this new project**.
3. It creates the tracking API, role rules, requests and notifications. It also sets the initial owner to **sainathreddy8901@gmail.com** in a private table.

Do not run the test SQL files in the real project. They are for disposable test databases only. The schema is an initial migration, not a script to rerun each time you sign in.

## Step 3 — Create Google's sign-in client

1. Open https://console.cloud.google.com and create/select a project named **ApplyLedger**. You do not need to enable Gmail APIs.
2. Open **Google Auth Platform** (or **APIs & Services → OAuth consent screen**, depending on the console layout).
3. Set the app name to **ApplyLedger**, supply your support/contact email, and choose **External** for personal Gmail accounts. Google Workspace Internal restricts sign-in to that organization.
4. Request only the normal `openid`, `email`, and `profile` identity scopes. Do not request Gmail/mail scopes.
5. While the Google app is in Testing, add your owner email and test users to its test-user list. To allow other Google accounts beyond those testers, finish the required Google publishing steps and switch the OAuth app out of Testing. Any branding checks Google requests must be completed in your project.
6. Create an OAuth client of type **Web application**. Name it **ApplyLedger Supabase**.
7. For **Authorized redirect URIs**, add the callback URL shown in Supabase's Google provider settings. It has this form:

   `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`

8. Copy the **Client ID** and **Client secret** directly into **Supabase → Authentication → Sign In / Providers → Google**, enable Google, and save. Keep the secret in Supabase; it never belongs in the extension.
9. Disable unused email/password, anonymous, and other identity providers in Supabase. This app requires Google sign-in.

[Official Supabase Google setup](https://supabase.com/docs/guides/auth/social-login/auth-google)

## Step 4 — Allow the extension callback

In **Supabase → Authentication → URL Configuration**, add this exact redirect URL:

`https://pjjfckfabbedilooloogflnboceekhog.chromiumapp.org/google`

For an extension-only workspace, you can also set the Site URL to that callback. The supplied manifest includes a public key to keep this unpacked extension ID stable on each device. Do not remove or change the manifest's `key` field. The extension's sign-in page displays its callback for verification.

If you later host the optional admin page on a website, also allow its exact HTTPS URL, for example `https://your-existing-site.example/admin.html`. For a local preview, explicitly allow `http://127.0.0.1:8787/admin.html` and open that exact URL. Avoid wildcard redirect entries.

## Step 5 — Add the public settings and install

Set the two values in `config.js`:

```javascript
export const CONFIG = Object.freeze({
  supabaseUrl: 'https://YOUR-PROJECT-REF.supabase.co',
  publishableKey: 'sb_publishable_YOUR_KEY'
});
```

No owner role, administrator password, Google secret or service-role key belongs in this file.

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select the folder containing the configured `manifest.json`.
4. Open ApplyLedger → **Open dashboard** → **Sign in with Google**. Approve access to your Supabase project when Chrome asks.
5. Sign in as **sainathreddy8901@gmail.com**. Your role should be **owner**.
6. Under **Account & workspace**, open the admin dashboard and optionally enable owner notifications.
7. Share the same configured extension folder/zip with team members. They sign in with their own Google accounts and automatically join as members.

## Step 6 — Verify owner controls

1. Have another person sign in as a member, add a job and sync it. You should see their stats and a signup notice.
2. Have them submit an admin-access request. It should appear in your owner inbox.
3. Select **Approve** or **Reject**. Approve grants team-stat access; reject keeps them a member.
4. Use **Grant admin / Revoke admin** beside a member for direct role management.
5. Confirm a delegated admin can read team stats but cannot grant roles, decide requests or read your owner inbox.

Chrome notifications require your extension to be signed in, notification permission enabled, and Chrome running. Notices remain in the dashboard when the browser is closed. This version does not send email notifications.

## Optional admin website

The simplest free setup is to open the admin page inside the extension. It is also a static website if you already have hosting. Publish only `admin.html`, `admin.js`, `auth.js`, `config.js`, `style.css`, and `icon128.png`. Configure that exact redirect URL in Supabase. There is no Node/SQLite backend to host in this edition.

For local preview with Node.js 24:

```powershell
node server/server.js
```

Open `http://127.0.0.1:8787/admin.html`. Google sign-in still requires a configured Supabase project and allowed redirect; simply starting this preview does not activate authentication.
