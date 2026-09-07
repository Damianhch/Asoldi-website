# SEO & Hostinger Deployment Guide

This project is an **Express** Node.js app on Hostinger. The React UI is built locally into `web/`. `dist/server.js` only starts `server.js` (Hostinger Express Default may look for `dist/server.js`).

Official Hostinger docs:
- [Express.js](https://docs.hostinger.com/node.js/overview-1/express) — JavaScript: **blank** build, **blank** output, entry `server.js`
- [Build Settings](https://docs.hostinger.com/node.js/build-settings)
- [GitHub deploys](https://docs.hostinger.com/node.js/github)

## Hostinger (leave as shown)

| Field | Value |
|---|---|
| Framework | **express** |
| Build and output | **Default** (no build command) |
| Entry file | `server.js` or `dist/server.js` |
| Node | 22 |

There is **no** `"build"` script. A `build` script plus a Vite `dist/` folder makes Hostinger treat the app as compiled TypeScript (`dist/server.js`) and fail in ~20s with **0 log lines** before `npm` runs.

`preinstall` only deletes leftover **`dist/media`** copies. `public/` recordings and `~/.asoldi-website-data` stay.

## Local frontend

```bash
npm install
npm run build:web   # → web/
npm start
```
