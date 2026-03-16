# Universal CMS: client portal + agency super-admin

Two layers:

1. **Client CMS (primary)** – Your **clients** (the businesses you build sites for) log in to manage **their own** site: analytics, ecommerce products, pricing, etc. They only see their own data.
2. **Agency super-admin (secondary)** – **You** log in to manage clients: turn features on/off per client (e.g. enable ecommerce), see all clients, support, etc.

---

## 1. Client-facing CMS (primary)

**Who uses it:** The client (e.g. restaurant owner, shop owner).  
**Where:** `theirdomain.com/admin` or `asoldi.com/admin` with client login.  
**What they see (per site):**

- **Analytics** – Their Google Analytics / Business Profile (or similar) – dashboards, links, or embedded views so they see their own traffic/insights.
- **Ecommerce** – If they have a shop: add/edit products, pricing, inventory. Only their products.
- **Pricing / offers** – If you expose it: manage their pricing plans, offers, etc.
- **Users** – If relevant: e.g. their staff logins for their site (like the current “ansatt” users).

So: one **client portal** product that you reuse on every project. Each client gets a login and only sees data for **their** site. No client sees another client’s data.

**Ways to run it:**

- **Multi-tenant (one app, many clients):** One CMS app. Each “site” = one client. Client logs in → CMS shows only that site’s data (analytics, products, users). Best when you have many clients and one codebase to maintain.
- **One install per client:** Same CMS code, but each website has its own deployment and its own database (e.g. client A at clienta.com/admin, client B at clientb.com/admin). Simpler per-client isolation; more deployments to maintain.

**Universal here means:** Same client CMS product (same features: analytics, ecommerce, pricing, users) on every website; either one multi-tenant app or one deployment per client.

---

## 2. Agency super-admin (back backend)

**Who uses it:** You (the agency / developer).  
**Where:** e.g. `cms.asoldi.com` or `asoldi.com/superadmin` – separate from client logins.  
**What you see:**

- **List of clients/sites** – All sites you manage.
- **Per-client settings / feature flags** – e.g. “Ecommerce: On/Off”, “Analytics: On/Off”, “Pricing module: On/Off”. So you control which parts of the client CMS each client gets.
- **Activate functionality** – Turn on ecommerce (or other modules) for a given client when they’re ready.
- Optional: impersonate a client, reset client password, view support info, billing, etc.

So: a **back backend** for you to manage clients and their capabilities, not for clients to use day-to-day.

---

## How it fits together

```
[Client]  →  logs in at clientdomain.com/admin  →  Client CMS
                ↓
            Sees only their:
            - Analytics (their GA / Business Profile)
            - Ecommerce (their products, pricing)
            - Users (their staff) etc.

[Agency]  →  logs in at cms.asoldi.com (or /superadmin)  →  Super-admin
                ↓
            Sees all clients, and for each:
            - Enable/disable Ecommerce, Analytics, etc.
            - Manage client account / access
```

- **Client CMS** = the “backend” your clients use. Primary focus: they manage their analytics, ecommerce, pricing.  
- **Super-admin** = the “back backend” you use to manage those clients and activate functionality (e.g. ecommerce) per client.

---

## What to build (order of work)

**Phase 1 – Client CMS (current site)**  
- Keep/evolve the current `/admin`: make it the **client** portal for this one site (Asoldi’s own site or one pilot client).  
- Already have: users (ansatt) managed by you. Next:  
  - **Analytics:** Connect one site to GA / Business Profile; client sees their analytics (read-only or linked).  
  - **Ecommerce (if needed):** Products, pricing for that site; client can add/edit.  
- Access control: only that client’s login sees that site’s data.

**Phase 2 – Multi-tenant client CMS**  
- Same client CMS, but support many “sites” (many clients).  
- Client logs in → choose site or auto-scope to one site → see only that site’s analytics, products, users.  
- Data model: `sites` table; analytics_config, products, users scoped by `site_id`.

**Phase 3 – Super-admin**  
- Separate app or area: agency login (you).  
- Screens: list of clients/sites; per-client toggles (Ecommerce on/off, Analytics on/off, etc.).  
- When you “enable ecommerce” for a client, their Client CMS shows the Ecommerce module; otherwise it’s hidden.

**Phase 4 – Universal reuse**  
- Every new website project either:  
  - Uses the same multi-tenant Client CMS (new client = new site in that app), or  
  - Gets its own Client CMS instance (same codebase).  
- You always use the same Super-admin to manage all of them and activate functionality.

---

## Recommendation: single per client + hub (not multi-tenant)

**Choice: single CMS per website, connected to one central “hub” (super-admin).**

| | Multi-tenant | Single per client + hub |
|--|----------------|--------------------------|
| **Speed** | One app/DB for everyone; can get slower with many clients. | Each site has its own app/DB; only that site’s traffic. No noisy neighbours. |
| **Load only when needed** | Same: CMS loads only when user visits `/admin`. | Same: CMS code only loads on `/admin`. |
| **Easy to add to a new client** | No “install” – you add site in hub and point domain. | Copy same CMS into the project (or use template); set hub URL + site key; deploy. Like installing WordPress on a new domain. |
| **Copyable** | N/A – one central app. | Same CMS code in every repo; copy or npm package or template. |
| **Managed** | One codebase to update; all clients get it when you deploy hub. | Update CMS package/template; each client redeploys when you want, or use shared npm package so they get updates. |
| **Connection to super backend** | Built-in (hub and CMS are same or linked). | Each site’s CMS calls the hub once (e.g. on `/admin` load) to get “what features am I allowed?” and only shows those. |

**Why single + hub fits your flow:**

- **Fast:** No shared DB; mongsushi.no’s CMS only serves mongsushi.no. Nothing loads until someone opens mongsushi.no/admin.
- **Easy to install:** For each new client you add the same CMS to their project (from a template or copy), set `CMS_HUB_URL` + `CMS_SITE_KEY` (or domain), deploy. Like adding WordPress to a new site.
- **Copyable:** One “client CMS” codebase you reuse: same files or an npm package. Every client site gets the same bundle; only config (env) changes.
- **Hub = connecting backend:** The hub (super-admin) doesn’t hold client data (products, users). It holds: list of sites + which features you granted (ecommerce, analytics, etc.). When mongsushi.no/admin loads, it asks the hub “what can this site show?” and only renders those modules. So: playground (client CMS on their domain) + connecting hub (your super-admin).

**Flow end-to-end:**

1. You add “Mong Sushi” in the hub: domain `mongsushi.no`, enable Ecommerce + Analytics. Hub gives you a **site key** (or you register by domain).
2. In the mongsushi.no project you add the client CMS (copy from template or use package), set env: `CMS_HUB_URL=https://hub.asoldi.com`, `CMS_SITE_KEY=xxx` (or `CMS_DOMAIN=mongsushi.no`). Deploy to Hostinger.
3. Someone goes to mongsushi.no/admin → CMS loads → calls hub “config for mongsushi.no?” → hub returns `{ ecommerce: true, analytics: true }` → CMS shows only those sections. All product/user data stays on mongsushi.no’s server.

So: **single per client** for the CMS, **one hub** (super-admin) that only stores site registry and feature flags. Easy to install, fast, copyable, and connected to the super backend with no issues.

---

## Summary

- **Primary:** Client-facing CMS – clients log in to see **their** analytics, manage **their** ecommerce products and pricing. Same product for every client; one or many deployments (multi-tenant vs per-client).
- **Secondary:** Agency super-admin – you log in to manage clients and **activate functionality** (ecommerce, analytics, etc.) per client.  
We can implement the former first (client analytics + ecommerce + pricing in the current admin), then add the super-admin layer for you to manage and enable features per client.
