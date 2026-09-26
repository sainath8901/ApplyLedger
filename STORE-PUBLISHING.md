# Chrome Web Store publishing

## Current state

The release package and GitHub Actions workflow are prepared. No store item has been created, no release has been submitted, and automation is not connected to a repository yet.

## First release

1. Register at https://chrome.google.com/webstore/devconsole and complete Google's registration fee, terms and two-step verification requirements yourself.
2. Upload `release/ApplyLedger-store.zip` as a new item. Suggested visibility: **Unlisted** for internal distribution. Anyone with the link can install it; membership remains open, and admin access requires owner approval.
3. Record the store-assigned extension ID. The store package intentionally omits the development key. Add `https://STORE_EXTENSION_ID.chromiumapp.org/google` to Supabase's allowed redirect URLs before publishing. Keep the development redirect for testing.
4. Add the listing text below, a genuine screenshot of the working extension, the existing icon, required promotional assets, and accurate data-use disclosures. Do not submit until Google sign-in and capture work in the store-identity test build.
5. Submit for review. Approval is controlled by Google.

## Listing draft

**Name:** ApplyLedger - Job Application Tracker

**Summary:** Track job application journeys, record status updates, and review personal and workspace application activity.

**Description:** ApplyLedger keeps your job search organized from saved opportunity to final decision. Sign in with Google, save jobs, add entries manually, and keep a timeline of status updates and notes. On sites where you enable tracking, the extension detects common application submission patterns. Detection varies by website; confirm your records after applying. Later employer status updates are entered manually. Automatically captured details are locked to preserve their history. Records save locally and sync to your workspace. Workspace owners and approved administrators can review team records and daily, weekly, monthly and yearly statistics. Only the workspace owner can grant administrator access. Google sign-in requests basic identity information and does not read Gmail.

Homepage: https://applyledger.sai8901.chatgpt.site

Privacy: https://applyledger.sai8901.chatgpt.site/privacy/

Support: sainathreddy8901@gmail.com

## Privacy and permission answers

Single purpose: record and review job application journeys for members and their internal workspace administrators.

- storage: retain the signed-in session, local job records and sync state.
- identity: complete Google sign-in with Chrome's authentication flow.
- activeTab: save the current job page when the user clicks the extension.
- scripting: inject the application detector on sites enabled by the user.
- alarms: retry synchronization and check owner notices periodically.
- optional notifications: notify the owner of signups and administrator requests after opt-in.
- optional HTTP/HTTPS hosts: users can enable capture across different application websites; the workspace backend also needs an explicitly requested origin permission.

Disclose account identifiers/name/email, authentication information, saved job URLs and job-page content, application activity and user-entered notes. Explain that capture is limited to enabled sites and that records are shared with workspace administrators. Select the corresponding categories shown by Google's current dashboard. No remote executable code, Gmail access, advertising or sales of data are implemented.

## Automatic releases

Place this folder's contents at the root of your chosen GitHub repository. The workflow is `.github/workflows/chrome-store.yml`.

Use a separate publishing OAuth client and token with the Chrome Web Store scope; do not reuse the end-user Google sign-in client. Enable the Chrome Web Store API and follow https://developer.chrome.com/docs/webstore/using-api for publisher authorization.

Repository secrets: `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`. Never commit their values or paste them into chat.

Repository variables: `CWS_PUBLISHER_ID`, `CWS_EXTENSION_ID`. After initial publication and successful verification, set `CWS_AUTOPUBLISH=true` to enable the workflow.

Each push to main runs tests, builds a package, uploads it, and submits it for review. Increase `manifest.json`'s version before each release; Google rejects reused versions. A release pending review may prevent another submission. The workflow fails visibly instead of cancelling an existing review.

Users must install the Web Store version to receive Chrome's automatic updates. Existing unpacked copies do not become store installations automatically, and local records do not automatically migrate if their extension ID changes. Export records before switching. Backend schema changes require separate reviewed migrations.
