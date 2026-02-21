# Stripe Weekly Billing Wiring (Singularity Members)

This setup is for users who are already Singularity members and only need weekly automation fee billing (10% of weekly profits).

## What is wired

- Payment method management in Settings:
  - `GET/POST/DELETE /api/billing/payment-method`
  - `POST /api/billing/setup-intent`
- Weekly billing job:
  - `scripts/weekly-billing.ts`
  - Charges only users with `billing_enabled = true` and a default payment method
- Stripe webhook reconciliation:
  - `POST /api/webhooks/stripe`
  - Handles:
    - `payment_intent.succeeded`
    - `payment_intent.payment_failed`
    - `charge.refunded`

## Required env vars

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `DATABASE_URL`

## Commands

- Run billing schema migration:
  - `npm run billing:migrate`
- Run onboarding schema migration:
  - `npm run db:migrate`
- Run weekly billing manually:
  - `npm run billing:weekly`

## Cron job (Render)

Create a Render Cron Job:

- Name: `meridian-weekly-billing`
- Command: `npm run billing:weekly`
- Schedule: `59 7 * * 1`

Notes:
- Render cron uses UTC.
- `59 7 * * 1` UTC = Sunday 11:59 PM PST.

## Stripe dashboard webhook

Create a webhook endpoint in Stripe:

- URL: `https://YOUR_DOMAIN/api/webhooks/stripe`
- Events:
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `charge.refunded`

Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.
