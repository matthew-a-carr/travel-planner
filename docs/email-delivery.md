# Email Delivery and Templates

This document explains how transactional email is wired in Travel Planner and
how to extend it without breaking consistency.

## Current Integration

- Provider: [Resend](https://resend.com/)
- Sender identity: `Travel Planner <hello@mail.matthewcarr.dev>`
- Sending domain: `mail.matthewcarr.dev`
- Runtime routing:
  - `VERCEL_ENV=production` + valid `RESEND_API_KEY` -> `ResendEmailService`
  - all other environments (`development`, `preview`, `test`) ->
    `LoggingEmailService` (no outbound email)

Implementation entrypoints:

- Provider selection:
  `src/infrastructure/email/create-invite-email-service.ts`
- Provider implementations:
  - `src/infrastructure/email/resend-email-service.ts`
  - `src/infrastructure/email/logging-email-service.ts`
- Runtime DI container:
  `src/infrastructure/container/create-app-container.ts`

## DNS Setup (Vercel DNS + Resend Domain)

Resend domain configured: `mail.matthewcarr.dev` (region `eu-west-1`).

Required DNS records in Vercel zone `matthewcarr.dev`:

- `TXT` `resend._domainkey.mail` -> DKIM key from Resend
- `MX` `send.mail` -> `feedback-smtp.eu-west-1.amazonses.com.` priority `10`
- `TXT` `send.mail` -> `v=spf1 include:amazonses.com ~all`

Optional but configured:

- `TXT` `_dmarc` -> `v=DMARC1; p=none;`

Notes:

- Resend can remain in `pending` briefly after DNS is correct due provider-side
  verification lag.
- You can validate propagation directly:

```bash
dig TXT resend._domainkey.mail.matthewcarr.dev +short
dig MX send.mail.matthewcarr.dev +short
dig TXT send.mail.matthewcarr.dev +short
dig TXT _dmarc.matthewcarr.dev +short
```

## Environment Variables

- `RESEND_API_KEY` (required only for production sending)
- `EMAIL_FROM_ADDRESS` (default `hello@mail.matthewcarr.dev`)
- `EMAIL_FROM_NAME` (default `Travel Planner`)

Terraform-managed production variables:

- `RESEND_API_KEY_PRODUCTION` (GitHub secret consumed by infra workflow)
- runtime env mappings in `infra/stacks/prod/`

## Template System (Consistent Base Layout)

Current invite email:

- Renderer:
  `src/application/email/user-added-invite-template.ts`
- Use case trigger:
  `src/application/use-cases/pre-provision-user-access.ts`
- Manual resend:
  `src/application/use-cases/send-user-access-invite.ts`

Shared base template:

- `src/application/email/base-email-template.ts`

All future notification emails (account deletion, trip updates, digest-style
events, notification-preference based sends) should:

1. Implement a dedicated template module under `src/application/email/`.
2. Build subject/content there.
3. Reuse `renderBaseEmailTemplate(...)` for text + html shell.
4. Keep providers (`resend-email-service.ts`, `logging-email-service.ts`) free
   of business copy and layout logic.

This keeps branding and structure consistent across all email types while
allowing each template to own message-specific content.

## Testing Expectations

- Unit tests for each template module in `src/application/email/*.test.ts`.
- Provider-routing tests in
  `src/infrastructure/email/create-invite-email-service.test.ts`.
- Use-case tests for send/no-send semantics and non-blocking failure behavior:
  - `pre-provision-user-access.test.ts` and `.int-test.ts`
  - `send-user-access-invite.test.ts` and `.int-test.ts`

## Operational Monitoring

Structured logs emitted by providers:

- `email_invite_send_success`
- `email_invite_send_failed`

Primary triage:

- Resend dashboard (deliveries, failures, bounces)

Secondary triage:

- Vercel runtime logs
