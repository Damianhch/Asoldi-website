# Sales offer flow (tilbud + kontrakt)

How a sales rep turns a client meeting into a sent offer e-mail with the matching contract PDF, and how the
admin reviews custom offers before they go out.

## Roles and pages

| Who | Where | What |
|-----|-------|------|
| Sales rep | `/sales` → client card → **Send tilbud** (also the `Send tilbud` next-action → **Åpne tilbud**) | Opens `/sales/offer?clientId=…` |
| Sales rep | `/sales/offer` (`SalesOfferComposer.tsx`) | Pick tier, AI-fill from the Fireflies meeting, edit the e-mail, preview the contract, send or request admin review |
| Admin | `/admin` → **Tilbud** tab (`OfferReviewSection.tsx`) | Queue of offers waiting for review, e-mail editor, product editor, contract summary editor, meeting data, verify |
| Admin | `/admin` → Tilbud → **ukoblede Fireflies-møter** | Link recorded meetings that could not be matched automatically |

## Status lifecycle

```
draft ──(request review)──▶ review-requested ──(verify)──▶ verified ──(send)──▶ sent
  ▲                                │   ▲                        │
  └──────── tilbake til selger ────┘   └──── åpne for redigering ┘
```

* `draft` – rep is editing; autosaves every 1.5 s. Tier 1–3 without the “Kjør via admin først” flag can be sent
  straight away.
* `review-requested` – rep clicked **Se gjennom tilbud (admin)**. Content is locked for the rep; admin gets an
  e-mail (`FIREFLIES_NOTIFY_EMAIL`, default `ansatte@asoldi.com`) and the offer shows in the Tilbud queue.
* `verified` – admin approved. Content is locked; rep gets an e-mail and a **Send tilbud + kontrakt** button.
  Any admin content edit drops it back to `review-requested`.
* `sent` – e-mail + contract PDF delivered (BCC copy to the rep). **Nytt tilbud** starts a fresh draft.

**Custom tier (`Skreddersydd`) always requires verification.** Standard tiers require it only when the rep ticks
“Kjør via admin først”.

## Hard requirements before sending

`lib/offer-readiness.js` — the client card must have `businessName`, `orgNumber` (9 digits), `businessAddress`
(falls back to `meetingPlace`), `contactPerson`, `contactEmail`. Enforced in the UI (amber banner) and on the
`send` / `request-review` routes (HTTP 400 with the missing labels). **Hent fra Brønnøysund** in the client edit
form fills org number + address (`GET /api/admin/sales/brreg-search`).

## Pricing source of truth

`lib/website-tiers.js` — the only place tier names, monthly ex-MVA prices, page counts (5 / 7 / 10), delivery
weeks and included features live. `app/data/websiteProducts.ts`, `app/data/clientWebsitePlans.ts`,
`app/pages/sales/websitePricing.ts`, `PackageDeals.tsx` and the server all derive from it. Prices are ex. MVA;
`withMva()` adds 25 %. Tier 2 lists Google + Google Maps ranking + AI; only Tier 3 is multilingual.

## E-mail template

`lib/offer-email.js` builds the branded offer e-mail (same layout as the confirmation mails via
`buildSalesLayoutEmail`). Marker elements survive the visual editor:

* `<div id="offer-products">…<div id="offer-products-end">` – the “Hva er inkludert” block. `applyOfferProducts`
  swaps it whenever products change (tier chosen, admin adds a product).
* `data-offer-slot="need|project|terms|benefits|delivery"` – the nuance slots filled by DeepSeek
  (`fillOfferSlots`) or by hand.

Each product renders: name, “Opp til N sider”, included bullets, monthly price ex. MVA; the totals table shows
ex. MVA, MVA 25 % and incl. MVA **per month** (retainer).

## AI (DeepSeek)

`lib/deepseek.js` (`DEEPSEEK_API_KEY`, optional `DEEPSEEK_MODEL`) + `lib/offer-ai.js`:

* **Fyll ut med kundedetaljer** → `fillOfferFromTranscript` reads the linked Fireflies transcript/summary and
  returns `need / project / terms / benefits` for the slots. Disabled (with hint) when no meeting is linked or
  DeepSeek isn’t configured. Nothing runs automatically.
* **Speil e-posten i kontrakten** (admin) → `reflectContractFromEmail` summarises the edited e-mail into a
  contract scope (title, scope sentence, per-product includes ≤ 8 bullets, extra terms, delivery weeks). Prices
  and page counts are re-anchored on the structured product list so the model cannot drift them. Admin can edit
  the summary before verifying.

## Contract PDF

`lib/offer-contract-pdf.js` (pdfkit). Sections follow the original “Web utviklings kontrakt” template: parties,
scope summary (no price breakdown), monthly fee ex./incl. MVA, delivery, client obligations, IP, termination,
signatures. Three blank tier templates: `GET /api/admin/offers/contract-template/<tierId>.pdf`.
For an offer: tier contract when only a tier is present; admin-verified summary when custom products exist.

## Fireflies meeting data

* Webhook `POST /api/webhooks/fireflies?token=…` (`lib/fireflies-webhook.js`) stores the meeting record and runs
  `lib/fireflies-client-match.js`: attendee e-mail = `contactEmail` (+70), attendee domain = client website (+30),
  host = client’s rep (+15), start within 45 min / 3 h of `meetingAt` (+35 / +25), contact name / business name in
  title or attendees (+25 / +20). `high ≥ 70`, `medium ≥ 40`; ties are downgraded so a human confirms.
  Matched meetings land in `client.meetings[]`; the notify e-mail still goes to `FIREFLIES_NOTIFY_EMAIL`.
  A failing notify e-mail no longer fails the webhook (record + match are the primary output).
* Media (video / audio / transcript) is downloaded in the background to `<data>/fireflies-media/<meetingId>/`
  (`lib/fireflies-media.js`, cap `FIREFLIES_MEDIA_MAX_MB`, default 400) and streamed to admins via
  `GET /api/admin/fireflies/meetings/:id/media/:kind?token=…`.
* Admin: list / link / unlink / refresh under `/api/admin/fireflies/meetings…`; UI in
  `MeetingDataPanel.tsx` (Tilbud → Møtedata tab and the unmatched list).

## Data

`data/sales-offers.js` → `sales-offers.json` in the persistent data dir. One active offer per client (the newest
non-sent one). Every transition is appended to `offer.history`.

## Routes

Sales (owner or admin): `GET/PUT /api/admin/sales/:id/offer`, `POST …/offer/new`, `POST …/offer/fill`,
`POST …/offer/request-review`, `GET …/offer/contract.pdf`, `POST …/offer/send`.

Admin only: `GET /api/admin/offers[?status=]`, `GET/PUT /api/admin/offers/:id`,
`POST …/:id/reflect-contract`, `PUT …/:id/contract`, `POST …/:id/verify`, `POST …/:id/reopen` (`{toDraft}`),
`GET …/:id/contract.pdf`, `GET /api/admin/offers/contract-template/:tierId.pdf`,
`GET /api/admin/fireflies/meetings[?unmatched=1|clientId=]`, `GET/POST …/:meetingId[/link|/unlink|/refresh]`.

## Tests

`node scripts/sales-offers.test.mjs` (part of `npm test`) covers tiers, e-mail product injection + idempotence,
readiness, PDF generation, the matcher, the AI adapters (with an injected chat) and the store lifecycle.
