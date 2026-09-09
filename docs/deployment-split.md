# What lives where (hub, GitHub, Hostinger)

This is the rule for **every new client website** and for **asoldi.com**. Do not mix the three layers.

```
asoldi.com /superadmin
  flags, plan, catalog type, site key, githubRepo
  (not client users, not client products)

GitHub (private repo per client)
  the website + CMS software
  (not CMS JSON)

Hostinger (that domain’s Node app disk)
  runtime + client-specific CMS files + CMS uploads
  ~/.asoldi-cms-data/<siteKey>
```

## Client sites (Maker → GitHub → Hostinger)

Use this for every new `clientdomain.com`.

| What | Where | Survives a deploy? |
|---|---|---|
| Generated website HTML/CSS/JS and page images from Maker | GitHub `public/` | Yes (it is the site) |
| Express + vendored CMS (`server.js`, `vendor/client-cms`, `cms.config.json`) | GitHub | Yes |
| Superadmin flags / plan / catalog / site key / `githubRepo` | Hub JSON on asoldi.com (`~/.asoldi-website-data`) | Yes (not in the client repo) |
| CMS users, products, notes | Hostinger `~/.asoldi-cms-data/<siteKey>` | Yes — **outside the Git clone** |
| CMS uploads (images, video, audio the client adds in `/admin`) | Hostinger `~/.asoldi-cms-data/<siteKey>` (or that site’s upload dir) | Yes — **outside Git** |
| Contact form posts | asoldi.com `/api/client-forms/:siteKey` | Yes |

Maker **Publish to GitHub** writes the repo. It does **not** SFTP and does **not** create a Hostinger website via API (that blocks Node.js on that domain).

**Once per domain, human in hPanel:** Websites → Add Website → Node.js web app → Import that GitHub repo. Framework **express**, entry **`server.js`**, **empty build**, Node **22**. Later Maker publishes are `git push` only; Hostinger auto-deploys `main`.

`package.json` must look like Express (no Vite/React). If Hostinger sees Vite, it never starts `server.js`.

Client website images that are part of the published pages belong in Git `public/`. That is the website. Client **CMS** media (product shots, avatars, files the client uploads in `/admin`) belong on Hostinger disk, not in Git.

## Hub (asoldi.com)

asoldi.com is **not** a Maker client site. It is Vite + Express. Sales CRM and call recordings are production data.

| What | Where | Survives a deploy? |
|---|---|---|
| Hub source + built SPA | GitHub `Damianhch/Asoldi-website` (code) / Hostinger `nodejs/dist` (running SPA) | Code yes |
| Superadmin site list, flags, plans, keys | `~/.asoldi-website-data` | Yes — never in Git |
| Sales clients, notes, connections | `~/.asoldi-website-data` | Yes |
| Call recordings (wav) and hub marketing media | Hostinger `nodejs/public/myphoner-audio` and `nodejs/public/media` | Only if they are **not** deleted by a checkout. Keep a copy under `~/.asoldi-website-data/` before any overwrite deploy |

**Do not Git-deploy asoldi.com while `public/myphoner-audio` and large `public/media` are in the repo.** Hostinger clones a second copy next to the live files and fills the disk (0-line failed builds, Sep 2026). Hub deploys must be a **small archive** (source + `dist`, no wav/mp4) via the Hostinger API, then copy recordings back if the archive overwrite cleared `public/`.

Proven green hub recipe: Express, Node 22, entry `server.js`, `npm run build` / postinstall Vite, Vite **not** copying `public/` into `dist/`.

## Quick checks

- Client live: `https://{domain}/api/cms/config` → real **name**, not `"Site"`, plus plan/catalog/features from superadmin.
- Client `/admin` → CMS (modules from hub flags). Users/products still there after a Git deploy.
- Hub: `https://asoldi.com/superadmin` → add/edit site with flags, plan, catalog type, site key, GitHub repo. Not client products.
- After Maker Publish: hub site has `githubRepo` like `Damianhch/website---{slug}`.
