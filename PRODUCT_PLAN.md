# FlowForge AI — Agency onboarding blueprint

## Product identity

**Tagline:** From first brief to kickoff, without the busywork.

**Customer:** Boutique creative, branding, and marketing agencies that repeatedly turn discovery calls into proposals and delivery handoffs.

**Product promise:** Capture a new client brief once, then shape it into a proposal, project brief, and kickoff checklist, with visible onboarding progress.

This is a product hypothesis, not a revenue forecast. An agency operations survey identifies new client acquisition as a leading challenge and reports many agencies revising their proposal processes; it does not establish willingness to pay for FlowForge. [Kantata agency operations survey](https://www.kantata.com/resource/the-state-of-agency-operations-survey)

## Pricing hypothesis and $20k MRR arithmetic

Test these monthly prices with interviews and paid pilots before treating them as final:

| Tier | Hypothesis | Example limits |
| --- | ---: | --- |
| Solo | $49/month | 1 seat, 20 client packs/month |
| Studio | $99/month | 5 seats, shared templates, 100 packs/month |
| Agency | $249/month | 15 seats, approval steps, 300 packs/month |

An illustrative path is 20 Solo + 25 Studio + 5 Agency customers at 50 payers ($4,700 MRR); 35 + 50 + 15 at 100 ($10,400); and 80 + 100 + 20 at 200 ($18,800). At 205 customers—80 Solo, 100 Studio, 25 Agency—the arithmetic is **$20,045 MRR**. This is gross subscription revenue before churn, discounts, taxes, payment fees, refunds, and operating costs. It assumes those tier mixes can be sold; it does not predict that they will be.

## Four MVP capabilities

1. **Client intake:** Capture client, project, service, goal, scope, timing, and optional budget once.
2. **A coordinated client pack:** Draft a proposal, internal project brief, and kickoff checklist from that intake.
3. **An editable document library:** Save drafts locally, search and filter them, and export an HTML copy. Future hosted version should add version history, approval, and DOCX/PDF export.
4. **A real onboarding tracker:** Mark intake, proposal review, brief sharing, and kickoff readiness complete; preserve progress between visits.

The production folder adds email accounts and Supabase-backed workspaces. Paystack card billing is implemented for three configurable monthly plans. A 30-day trial uses card checkout with a refundable KES 3 verification charge and schedules the first monthly debit for 30 days later. Live payments remain disabled until the merchant account, plan codes, webhook, and secrets are configured and end-to-end sandbox verification passes. The pricing and revenue targets below remain hypotheses, not evidence of product-market fit.

## Coverage against the original brief

| Requirement | Current result |
| --- | --- |
| $20k MRR arithmetic | Scenario modeled in the pricing section; not achieved or validated. |
| Three-step onboarding, themes, and visible progress | Implemented in the local MVP. |
| Save at least five hours per week | Not claimed or measured; validate with pilots before using this promise. |
| AI-generated agency documents | Implemented behind the local server, subject to network access, API access, and API usage charges. The live generation smoke test could not complete in this execution environment. |
| 30-day card-backed trial | Paystack trial flow is implemented in the production version: KES 3 verification, refund request, 30-day scheduled subscription, cancellation, and signed billing webhooks. Live setup and the full payment lifecycle remain unverified pending provider onboarding. |
| TLS 1.3, AES-256 managed storage, OAuth/SAML, RBAC, durable audit logs | Production architecture requirements only; not implemented in this local single-user app. |
| GDPR/HIPAA compliance and zero data retention | Not established. Provider terms, organization settings, legal applicability, and independent controls require verification. `store: false` is requested for Responses API calls, but is not a zero-retention guarantee. |
| Acquisition of the first 50/100/200 customers | Three experiment phases are described below; no customers have been acquired through this prototype. |

## First five minutes

1. **Identify the work:** Enter the client, project, and agency service.
2. **Capture the scope:** Add the client goal, scope notes, target timeline, and optional budget.
3. **Review and move work forward:** Check the intake summary, create the three drafts, edit and save them, then advance the onboarding tracker as each handoff is completed.

Keep every generated section editable. Show which details came from the intake and leave uncertain commercial terms for human review.

## Proposed technical and security architecture

```text
Current local MVP
Browser UI ── same-origin ──> localhost Node server ──> OpenAI Responses API
     └─ localStorage                    └─ API key stays server-side

Production direction
Browser UI ── TLS ──> authenticated API ──> tenant-scoped database
                           ├─ AI provider adapter / secrets manager
                           ├─ billing webhook handler
                           └─ durable security and workflow audit events
```

The current app stores drafts in browser local storage and uses a localhost-only backend for optional AI requests. It has no authentication, cloud database, billing, durable audit log, or network TLS; the API key is kept in a server-side env file ignored by Git and is never served to the browser. A production implementation should use HTTPS with TLS 1.3 where supported, encrypt stored data using the hosting provider’s documented controls (target AES-256 at rest), keep provider credentials in managed server-side secret storage, and scope every read/write by tenant and role. Add retention and deletion controls, backups and recovery, rate limits, abuse monitoring, and independent security review before handling client-confidential material.

The server now supports a **small invite-only pilot gate** when configured to bind publicly: one shared invite code, temporary in-memory sessions, and an attempt limit. It fails closed if public binding is requested without a code. This is suitable only for an HTTPS-hosted test with synthetic or non-sensitive data; it is not user accounts, per-person invitations, tenant isolation, or a production identity system.

**Production foundation:** Plain HTML/CSS/JavaScript plus a dependency-free Node server, Supabase/PostgreSQL for tenant-scoped data, Supabase email/password authentication, Paystack for card subscriptions, and the OpenAI Responses API behind a server-side adapter. Supabase, Paystack, and Render still require merchant/account configuration; no live public deployment is configured here.

Request a provider’s documented retention and training terms and configure eligible zero-retention options where available; do not promise zero retention without verifying the selected service and contract. Add OAuth or SAML only when needed by customers, with role-based permissions and auditable access changes. Treat GDPR/HIPAA applicability, contractual obligations, and any compliance claim as matters requiring specialist review and evidence; software features alone do not establish compliance or certification. Do not market this prototype as secure for regulated or confidential production data.

## Go-to-market experiments

These are milestones to test, not forecasts.

- **First 50 paid teams:** Founder-led outreach to small agency owners and operations leads; offer guided setup and ask each pilot to process one real onboarding. Conduct interviews around proposal turnaround, revisions, and handoff omissions. Convert only where the workflow saves time customers can describe and measure.
- **From 50 to 100:** Publish useful, specific resources—proposal structure examples, client intake checklist, and kickoff templates. Build focused search pages for agency service types, and use pilot results (with explicit permission) as case studies. Track qualified visitor-to-pilot and pilot-to-paid conversion.
- **From 100 to 200:** Develop referrals with agency coaches and fractional operations consultants; add integrations only after repeated customer requests. Improve activation and retention before increasing acquisition spend. Review payback, churn, and support load by tier.

Measure time from brief to proposal, number of revision cycles, onboarding completion, weekly active agencies, paid conversion, gross retention, and support effort. Do not claim “saves 5+ hours a week” until customer measurement supports that statement.
