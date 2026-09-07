# SEO & Hostinger Deployment Guide

asoldi.com deploys like the last **green** Hostinger log:

```text
> postinstall
> npm run build
> vite build
✓ 2179 modules transformed.
```

`package.json`: `"build": "vite build"`, `"postinstall": "npm run build"`, `"start": "node server.js"`, Vite in **dependencies**. Hostinger runs that during `npm install` (and again if Build = `build`). That is what writes the Build log.

Vite does **not** copy `public/` into `dist/` (recordings stay in `public/`; `dist/` is the JS bundle only).
