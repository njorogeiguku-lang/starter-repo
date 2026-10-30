# FlowForge AI

A standalone agency workflow and document automation app, independent from Taxion.

## Two versions in this folder

- The **local demo** is served by the files at this folder's root. Start it with `npm start`, then open <http://127.0.0.1:4173>. It keeps drafts in the current browser and uses the local invite-only phone mode for same-Wi-Fi access.
- The **production deployment** is in `production/`. It adds individual email accounts, cloud-backed Supabase storage, encrypted server sessions, tenant-scoped database policies, and audit events. The root `render.yaml` deploys this version.

## Deploy the production version

Follow [production/README.md](production/README.md). Before launch, connect a private GitHub repository, configure Supabase Auth/Postgres and SMTP, configure Paystack monthly plans and webhooks, enter provider secrets in Render, review the paid always-on plan, and verify account creation, email confirmation, password reset, billing/refunds, cross-account isolation, and mobile layouts.

The production app is not deployed yet. It needs your GitHub, Supabase, and Render accounts and their project settings. Do not commit `.env.local` or paste API keys into chat.

## Production readiness boundary

This is a production-oriented foundation, not a compliance certification or a fully verified commercial service. Paystack subscriptions and the 30-day card-backed trial are implemented but require an approved merchant account, production plans, private secret configuration, and end-to-end sandbox verification before live use. Team invitations, enterprise SSO, formal privacy/legal documents, and independent security review are still required before handling sensitive client records. Each account gets its own workspace; team sharing is not implemented yet. OpenAI drafting uses `store: false`, which is not a zero-retention guarantee.

See [PRODUCT_PLAN.md](PRODUCT_PLAN.md) for the product and revenue plan.
