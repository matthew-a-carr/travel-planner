# Free Tier Guardrails (No-Pay Strategy)

Last reviewed: **March 14, 2026**

Goal: keep this project running on free tiers and avoid accidental paid usage.

## Current answer: can we stay free?

- **Yes**, with constraints.
- Biggest hard risk is **Vercel Hobby commercial-use policy**.
- Operational risks are usage caps (Vercel/Neon) and scale caps (HCP Terraform managed resources).
- Google OAuth itself is not the cost driver here; Google Cloud billing risk comes from enabling paid cloud products.

## Quick login links

### Vercel

- Dashboard: <https://vercel.com/dashboard>

### HCP Terraform / Terraform Cloud

- Dashboard: <https://app.terraform.io>
- Billing: <https://portal.cloud.hashicorp.com>

### Neon

- Console: <https://console.neon.tech/>
- Pricing: <https://neon.tech/pricing>

### Google Cloud (OAuth project)

- Console home: <https://console.cloud.google.com/>
- OAuth credentials: <https://console.cloud.google.com/apis/credentials>
- OAuth consent screen: <https://console.cloud.google.com/apis/credentials/consent>

## Provider-by-provider limits and payment risk

### Vercel (Hobby)

- Hobby is **free** and described as **free forever**.
- Hobby is restricted to **personal, non-commercial use**.
- Free tier has included monthly usage caps. As of Jan 2026, examples include:
  - Function invocations: first **1,000,000**
  - Function duration: first **100 GB-hours**
  - Active CPU: **4 CPU-hours**
  - Speed Insights: **1 project** / **10,000 data points**
  - Web Analytics: **50,000 events**
- Hobby cannot buy extra usage; if limits are exceeded, features are limited until quota resets.
- Hobby has no billing cycle and exceeded features generally require waiting ~30 days for reset.

Cost risk:

- **No automatic overage billing on Hobby**.
- Main risk is service limits or policy enforcement rather than surprise invoices.
- If usage is considered commercial, you may need to move to Pro/Enterprise.

Guardrails:

- Keep project personal/non-commercial.
- Watch usage in Vercel dashboard weekly.
- Treat any Vercel warning emails as immediate action items.

### HCP Terraform (Free organization)

- Free organizations include core features (remote runs/state/VCS).
- Free organizations are limited to **500 managed resources**.
- Free plan concurrency is effectively **1 concurrent run**.
- State retention policy on free tier can prune older state versions (per HashiCorp limits doc).

Cost risk:

- No usage overage billing model like cloud metering here.
- If limits are exceeded, practical path is plan upgrade.

Guardrails:

- Keep preview resources aggressively cleaned up (already automated on PR close).
- Track managed resource count quarterly.
- Avoid adding non-essential Terraform-managed resources.

### Neon (Free plan)

- Free plan states **no credit card required** and **no time limits**.
- Key free-plan caps include:
  - up to **100 projects**
  - up to **0.5 GB storage per project**
  - up to **100 compute hours per project per month**
  - automatic scale-to-zero behavior for idle compute

Cost risk:

- With free plan/no paid upgrade, primary risk is hitting limits (performance/availability constraints), not silent overage invoices.
- Upgrading plan or adding paid usage later introduces normal billing.

Guardrails:

- Keep exactly 2 projects (`travel-planner-prod`, `travel-planner-preview`) unless justified.
- Continue PR-close destroy for preview branches/databases.
- Check monthly compute/storage usage in Neon before month end.

### Google (OAuth for sign-in)

- For Google Cloud generally, the free-trial period is **$300 for 90 days** for new customers.
- OAuth app operational constraints matter more than direct OAuth cost:
  - Apps in Testing mode are subject to a **100-user cap** and unverified-app warnings.
  - Testing-mode token behavior is stricter (refresh-token lifetime constraints); Google explicitly calls out 7-day behavior in relevant OAuth docs.
  - Production-readiness/verification rules apply depending on scopes and audience.

Cost risk:

- Main billing risk is enabling/using billable Google Cloud products (outside simple OAuth configuration).
- OAuth compliance risk (verification, app mode) can break sign-in behavior if misconfigured.

Guardrails:

- Keep OAuth scopes minimal (`openid`, `email`, `profile`) unless needed.
- Use separate GCP projects for test vs production OAuth clients.
- Keep consent screen/publishing status aligned with real usage.
- Do not keep production traffic on a Testing-mode OAuth app.
- Avoid enabling unrelated paid GCP services in the OAuth project.

## Re-evaluation triggers (when to consider tool changes)

Re-evaluate stack choices immediately if any of these happen:

1. Vercel confirms usage is commercial or asks to move off Hobby.
2. Vercel Hobby limits are hit repeatedly and impact uptime.
3. Neon free compute/storage caps are exceeded in normal monthly usage.
4. HCP Terraform approaches 500 managed resources or run queue becomes a bottleneck.
5. Google OAuth verification/compliance requirements become incompatible with desired rollout speed.

## Monthly free-tier checklist

1. Vercel usage and warnings reviewed.
2. Neon usage (compute/storage) reviewed.
3. HCP Terraform managed resource count and run queue health reviewed.
4. Google OAuth consent screen/publishing state unchanged and valid.
5. Confirm preview cleanup still deletes PR infra on PR close.

## Sources

- Vercel Hobby plan: <https://vercel.com/docs/plans/hobby>
- Vercel pricing FAQ: <https://vercel.com/pricing>
- Vercel Fair Use / commercial-use definition: <https://vercel.com/docs/limits/fair-use-guidelines>
- Vercel Terms (Hobby section): <https://vercel.com/legal/terms>
- HCP Terraform plans/features: <https://developer.hashicorp.com/terraform/cloud-docs/overview/migrate-teams-standard>
- HCP Terraform limits article: <https://support.hashicorp.com/hc/en-us/articles/4414055267603-HCP-Terraform-Limits>
- Neon pricing: <https://neon.tech/pricing>
- Google Cloud free program: <https://docs.cloud.google.com/free/docs/free-cloud-features>
- Google OAuth 2.0 behavior (testing token limits): <https://developers.google.com/identity/protocols/oauth2>
- Google OAuth app audience/testing guidance: <https://support.google.com/cloud/answer/10311615?hl=en>
- Google OAuth verification guidance: <https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification>
- Google Cloud Console help (when verification is not needed): <https://support.google.com/cloud/answer/13464323?hl=en>
