# SEO & Hostinger Deployment Guide

This project is an **Express** Node.js app on Hostinger, with a React UI that is built **locally** and committed in `dist/`.

Official Hostinger docs:
- [Express.js](https://docs.hostinger.com/node.js/overview-1/express) — server mode, **blank** build script, entry `server.js`
- [Build Settings](https://docs.hostinger.com/node.js/build-settings) — build field is an **npm script name** (e.g. `build`), not `vite build`
- [GitHub deploys](https://docs.hostinger.com/node.js/github) — pull → `npm install` → optional build script → start
- [React / Vite](https://docs.hostinger.com/node.js/overview-1/react) — Hostinger’s React preset is **static only** (no `server.js`). Do not use it for asoldi.com.

## Pre-deployment checklist

- [ ] **Domain URL** in `app/config.ts`: `SITE_URL` and `DOMAIN_NAME`
- [ ] **Domain URL** in `public/sitemap.xml` and `public/robots.txt`
- [ ] **Business info** in `app/config.ts`
- [ ] After UI changes: `npm run build:web` and commit the new `dist/`
- [ ] Images/video/audio stay in `public/` (Express serves them). Do not copy them into `dist/`.

## Hostinger settings (do not change)

Leave hPanel as it already is:

| Field | Value |
|---|---|
| Framework | **express** (not Vite / React) |
| Build command | `build` if Hostinger will not accept empty — our `package.json` `build` script is a no-op that logs one line |
| Output directory | *(blank, Express)* |
| Entry file | `server.js` |
| Start | `node server.js` (`npm start`) |
| Node | 22 |

Hostinger **does not** run `vite build`. Vite/React live in `devDependencies` so auto-detect stays Express and production `npm install` does not pull the bundler.

There is **no `postinstall`**. A postinstall Vite compile runs during `npm install` and can fill the disk. Express **Default** settings have no Build command, so a failed `npm install` shows **0 lines** in Build logs.

`preinstall` runs first on Hostinger: it deletes leftover **`dist/media`** / **`dist/myphoner-audio`** copies (never `public/`, never `~/.asoldi-website-data`). User data is already outside git. Recordings in `public/` stay in the tree so a checkout does not delete them.

## Local frontend build (not on Hostinger)

```bash
npm install
npm run build:web   # vite build → dist/ (~1MB JS, no public/ media)
npm start           # Express serves dist/ then public/
```

## Media and user data

- Hub marketing video + Sales wavs stay in `public/` (still in git so a Hostinger checkout does not delete them).
- Sales/admin JSON lives in `~/.asoldi-website-data` (not in git). Deploys do not replace it.
- Leftover **`dist/media` / `dist/myphoner-audio`** are Vite duplicates. `preinstall` deletes those on Hostinger. Never delete `public/`.
