# Checkout + Sales/Maker Rollout Checklist

## Scope

This checklist covers:
- Legal checkout consent enforcement.
- Stripe checkout-session hardening + actionable errors.
- Stripe-backed rabattkode flow.
- Sales ↔ Website Maker preview/export handoff and Hostinger ZIP download.

## Local Verification (Completed)

- [x] Website Maker build succeeds (`npm run build` in `website maker application`).
- [x] Sales/checkout backend syntax is valid (`node --check server.js` in `Asoldi-website`).
- [x] Updated files are lint-clean in editor diagnostics (`ReadLints` on touched files).
- [x] Stripe env guard validated in code path (explicit messages for missing price IDs / auth/request errors).

## Staging E2E Matrix

Run this in staging with one real sales user + one real client user:

### A) Legal Consent + Checkout Start
- [ ] Client opens `/kunde/tjenester/nettside/planer`.
- [ ] `Gå til checkout` is disabled until all three checkboxes are accepted.
- [ ] Links open correctly:
  - [Personvern](https://asoldi.com/personvern)
  - [Vilkår](https://asoldi.com/vilkar)
- [ ] Binding text reflects selected tier dynamically.
- [ ] Navigating to checkout and starting card/faktura without legal acceptance returns `legal-consent-required`.

### B) Stripe Session Reliability
- [ ] Card checkout initializes without `Kunne ikke starte betaling`.
- [ ] Misconfigured Stripe scenarios return actionable messages:
  - missing/invalid price ID
  - Stripe auth issues
  - invalid request payload
- [ ] Session completes and return page receives `session_id`.
- [ ] Webhook updates payment state to `active`.

### C) Rabattkode (Stripe-backed)
- [ ] Valid Stripe promo code is accepted from rabattkode input.
- [ ] Invalid code shows clear error.
- [ ] Expired/not-applicable code shows clear error.
- [ ] Applied code affects displayed subtotal/total and is used in session creation.
- [ ] Removing code clears discount and re-creates embedded checkout session.

### D) Sales ↔ Maker Handoff
- [ ] Sales creates maker run from Sales panel.
- [ ] Maker run includes sales metadata + callback config.
- [ ] When maker steps update, callback updates sales client maker status.
- [ ] Sales "Maker preview" opens canonical stored preview URL.

### E) Export + Client Preview
- [ ] Sales can download `Hostinger ZIP` from Sales panel.
- [ ] Sync/import still updates `/sales-preview/:id`.
- [ ] Export endpoint returns zip + expected headers (`X-Export-*`).

## Production Rollout Order

1. Deploy Website Maker API changes (`/api/runs/v2`, `/api/runs/[runId]`, step callback emission, export headers).
2. Deploy Asoldi Website backend changes (checkout promo/legal/session + sales callback/export endpoints).
3. Deploy Asoldi frontend changes (plans, checkout, sales UI buttons/preview selection).
4. Run staging matrix above end-to-end.
5. Enable production callback token + callback URL config.
6. Smoke test with one internal sales/client flow before full rollout.

## Required Environment Configuration

Do **not** proceed without confirming these are set in deployment environment:
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_TIER_1_STANDARD`
- `STRIPE_PRICE_TIER_2_SEO`
- `STRIPE_PRICE_TIER_3_ECOMMERCE`
- `WEBSITE_MAKER_API_KEY` (if maker API is protected)
- `WEBSITE_MAKER_STATUS_CALLBACK_TOKEN` (recommended for callback auth)
- `WEBSITE_MAKER_STATUS_CALLBACK_URL` (optional; defaults to `<APP_URL>/api/admin/sales/maker-status-callback`)

