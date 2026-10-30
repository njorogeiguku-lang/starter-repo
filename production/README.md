# FlowForge AI — production deployment

This folder is the hosted version of FlowForge. It adds individual email accounts, encrypted HttpOnly sessions, Supabase Postgres storage, workspace-scoped row security, and append-only application audit records. The browser never receives the OpenAI key or a Supabase service-role key. The local demo remains in the parent folder.

## Provider setup required before first deployment

### 1. Supabase project

Create a Supabase project in the region appropriate for your users and contractual requirements. This app is not validated for HIPAA, GDPR, or other regulated data.

1. In **SQL Editor**, run both migrations in order: `supabase/migrations/202610300001_initial_production.sql`, then `supabase/migrations/202610300002_billing_trial.sql`.
2. In **Authentication → URL Configuration**, set the site URL to the Render service URL after the first deploy. Add `https://YOUR-SERVICE.onrender.com/auth/callback` and `https://YOUR-SERVICE.onrender.com/auth/reset` to allowed redirect URLs. For local development, add the matching `http://127.0.0.1:4174/...` URLs.
3. Enable email confirmation and configure a production SMTP provider. In **Authentication → Email Templates**, set the confirmation link to send its one-time token hash back to this server: update the **Confirm signup** template link to `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email`. Update the **Reset password** template link to `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery`. These routes verify the one-time code server-side and then set the encrypted HttpOnly session. The redirect target is supplied by FlowForge for each flow (`/auth/callback` for confirmation and `/auth/reset` for recovery).
4. Copy the project URL, the public/publishable (anon) key, and the service-role key. The service-role key must be entered only in Render's private environment settings; never use it in browser code or commit it.

### 2. GitHub and Render

Create a Paystack account for the Kenyan business, complete verification and payment activation, and create three monthly plans (Solo, Studio, Agency) in the currency you will settle. The current prices in `PRODUCT_PLAN.md` are hypotheses; the billing page displays the exact prices set in Paystack. After the first deploy, set Paystack's webhook URL to `https://YOUR-SERVICE.onrender.com/api/billing/webhook`.

Push this production app and the root `render.yaml` to a private GitHub repository. Do not commit `.env.local` or any provider credentials. The Render Blueprint points its service root at `production/` and selects the paid `starter` instance so the service does not use the free sleep behavior. Review the current price and approve billing in your Render account before deploying.

In Render, create a Blueprint from the repository. Enter these environment values when prompted:

- `SUPABASE_URL`: project URL from Supabase.
- `SUPABASE_ANON_KEY`: project public/anon key.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only key used for billing records and verified webhook updates.
- `OPENAI_API_KEY`: set only in Render's secret settings. AI requests are sent from this server; API usage may incur separate charges.
- `PAYSTACK_SECRET_KEY`: Paystack live secret key, entered only into Render's secret settings.
- `PAYSTACK_PLAN_CODE_SOLO`, `PAYSTACK_PLAN_CODE_STUDIO`, `PAYSTACK_PLAN_CODE_AGENCY`: monthly plan codes for the three tiers.
- `BILLING_REQUIRED`: enabled in the Blueprint; users must complete checkout before using the hosted workspace.
- `FLOWFORGE_SESSION_SECRET`: Render generates this value from the Blueprint.
- `NODE_ENV`, `HOST`, and `OPENAI_MODEL` are provided by `render.yaml`.

Render exposes `RENDER_EXTERNAL_URL` for verification and email links. After the service URL exists, add it to Supabase's allowed auth redirect URLs and site URL, then redeploy. Do not publish until the health check passes and all authentication flows work.

The configured model is `gpt-6-astra` by default. It can be changed using Render's `OPENAI_MODEL` environment setting. The model name is not secret; the API key is.

### 3. Trial billing behavior

The billing page offers two ways to pay. Card checkout uses a refundable KES 3 verification, then schedules monthly card renewal after a 30-day trial. Paystack hosts card entry; FlowForge never receives or stores card numbers or CVV. A separate Pay with Bank option sends customers to Paystack Checkout to pay directly from their bank using Kenya's PesaLink channel. A verified bank payment activates 30 days of access and does not auto-renew; customers pay again manually to continue. FlowForge never handles bank login credentials. Enable **Bank transfer** in Paystack Dashboard → Settings → Preferences to expose Pay with Bank. The bank payment amount is the configured monthly KES plan price. Paystack's processing fee for the refunded card verification is not returned to the merchant. A failed recurring debit is not retried automatically by Paystack; signed Paystack webhooks update card subscription status.

Use KES for the configured plans if you want local settlement options such as M-Pesa. International cardholders may be charged a converted amount by their bank, but FlowForge does not set the exchange rate. Direct bank transfers are currently a one-time payment method and cannot be used for the automatic card renewal.

Apply the Supabase migrations in order, including `202610300003_bank_payments.sql`, then configure all Paystack plan codes, enable the Pay with Bank channel, and set production secrets before the public service starts. Test card trial, refund, scheduled first debit, cancellation, bank transfer confirmation, 30-day bank entitlement, webhook, and account gating using test credentials before switching to live credentials. Do not run real customer charges until these flows have been checked.

## Local checks

The production server can be started on a local-only port without Supabase to preview the UI and template generator:

```powershell
$env:PORT = '4174'
node server.mjs
```

Open <http://127.0.0.1:4174>. To exercise accounts and cloud persistence locally, set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and a random `FLOWFORGE_SESSION_SECRET` in the process environment. Do not put real secrets in this repository. A public bind fails closed unless all three are configured.

## What this production foundation does not provide yet

- Team invitations, workspace switching, granular UI role controls, and enterprise OAuth/SAML SSO.
- Subscription card updates and plan changes beyond starting and cancelling a Paystack monthly subscription.
- A customer-facing privacy policy, terms, data-retention controls, or organization-specific DPA.
- Independent penetration testing, compliance audit, or a HIPAA-validated deployment.
- Conflict-resolution UI for simultaneous team edits.
- Trial reminder emails and support automation for refund or subscription setup exceptions.

Each account receives an isolated workspace. Documents are stored in Supabase. Supabase documents AES-256 encryption at rest and TLS-protected connections; its APIs currently accept TLS 1.2 and TLS 1.3, so this setup must not be described as TLS-1.3-only. The session cookie is encrypted with AES-256-GCM using `FLOWFORGE_SESSION_SECRET` and marked HttpOnly, Secure in production, and SameSite=Strict. The app writes audit entries when workspace data is saved; that is not a full compliance audit trail.

OpenAI requests set `store: false`, but this setting alone is not Zero Data Retention. OpenAI's standard abuse-monitoring retention may retain content for up to 30 days; Zero Data Retention requires the organization/project to be approved and configured for it. Do not process regulated or confidential client data until the provider agreements, retention controls, backups, access controls, privacy terms, and independent security review are confirmed. Supabase-managed encryption is provider-side encryption, not application-level encryption of document fields.
