# Hub and client CMS – quick setup

## This repo = hub + one client (this site)

- **Super-admin (you):** https://seashell-camel-446716.hostingersite.com/superadmin  
  When you move to asoldi.com, use https://asoldi.com/superadmin. Same login as this site’s /admin.
- **Client CMS (this site):** https://seashell-camel-446716.hostingersite.com/admin  
  Features are controlled from the hub (super-admin). No need to set `CMS_SITE_KEY` if you add this site in the hub with the same domain.

---

## 1. Use the hub (first time)

1. Deploy this repo to Hostinger (or your host) so it serves the main site.
2. Open **/superadmin** (e.g. https://seashell-camel-446716.hostingersite.com/superadmin).
3. Log in with the same credentials you use for **/admin** on this site.
4. Click **Add site**:
   - **Name:** e.g. Asoldi (or Mong Sushi for a client).
   - **Domain:** e.g. `seashell-camel-446716.hostingersite.com` for this site, or `mongsushi.no` for the client.
   - **Website plan:** Tier 1 / Tier 2 / Tier 3 / Custom (sets default CMS modules).
   - If ecommerce is included, pick **catalog type** (menu, tiers, or normal products).
5. Save and **copy the site key** (long hex string). For client projects you’ll set it as `CMS_SITE_KEY` in env.
   Edit the site later to toggle Users, Analytics, Ecommerce, Blog, and Social sync, and to store the GitHub repo used for CMS version bumps.

To have **this** site’s /admin driven by the hub, add a site in super-admin with domain = this site’s host (e.g. `seashell-camel-446716.hostingersite.com`). Then /admin will load config by domain and show only the features you turn on for that site in the hub.

---

## 2. Add CMS to a client (e.g. mongsushi.no)

1. In the **hub** (/superadmin): Add site **Mong Sushi**, domain **mongsushi.no** (or let Maker Go Live / Publish to GitHub register it). Copy the **site key** if you need to set env by hand.
2. **Maker clients:** Website Creator **Publish to GitHub** writes an Express repo (`server.js`, `public/` HTML, vendored CMS, `cms.config.json`). Then in hPanel: **Add Website → Node.js web app → Import Git repository**. Framework **express**, entry **`server.js`**, empty build.
3. **Hand-built React clients (Mong Sushi):** GitHub repo already has `server.js`. Connect Hostinger Git (classic or Node.js web app). CMS JSON lives in `~/.asoldi-cms-data/<siteKey>` (or `CMS_DATA_PATH`), not in the Git clone.
4. Optional Hostinger env: `CMS_HUB_URL`, `CMS_SITE_KEY` (overrides `cms.config.json`). No `NPM_TOKEN` when CMS is vendored.

`domain.com/admin` shows only modules enabled in the hub. Client users/products stay on that Hostinger disk across deploys.

---

## 3. Change domain later (universal)

When you move this site from the test URL to **asoldi.com**:

1. In the hub (still on test URL or already on asoldi.com), edit the site and set **Domain** to **asoldi.com**.
2. If the hub itself moves to asoldi.com, set **CMS_HUB_URL=https://asoldi.com** on every client host. **CMS_SITE_KEY** does not change.

Sites are identified by **site key** in the hub; domain is just for display and for lookup when the client doesn’t send a key. So changing domain in the hub does not break existing client installs.
