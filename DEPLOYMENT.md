# SEO & Hostinger Deployment Guide

This project is optimized for SEO and deployment to **Hostinger** (Node.js hosting).

## Pre-deployment checklist

Before going live, update the domain and verify business info in **one place**:

- [ ] **Domain URL** in `app/config.ts`: set `SITE_URL` and `DOMAIN_NAME` (e.g. `https://asoldi.com`, `asoldi.com`)
- [ ] **Domain URL** in `public/sitemap.xml`: replace `https://asoldi.com` in all `<loc>` tags if using a different domain
- [ ] **Domain URL** in `public/robots.txt`: update `Sitemap: https://asoldi.com/sitemap.xml`
- [ ] **Domain URL** in `app/index.html`: update Open Graph and canonical URLs in the `<head>`
- [ ] **Business info** in `app/config.ts`: verify name, address, phone, email, opening hours, social links
- [ ] **Images**: ensure `public/media/og-image.jpg` exists for social sharing (or add your image and keep the path in `app/constants.ts`)
- [ ] **Build**: `package.json` has `"postinstall": "npm run build"` and build tools (Vite, Tailwind, TypeScript) in `dependencies` for Hostinger

## Media and images

- **Location**: Put all images in `public/media/`
- **Mapping**: Add paths in `app/constants.ts` under the `IMAGES` object (e.g. `ogImage: "/media/og-image.jpg"`)
- **Usage**: In components, use `IMAGES.yourKey` so all assets stay local (no CDN dependency)

## Hostinger deployment

1. **Push to GitHub**  
   Hostinger deploys from your repo. Do **not** commit the `dist/` folder (it is in `.gitignore`).

2. **Build on deploy**  
   Hostinger runs `npm install`; the **postinstall** script runs `npm run build`, so the site is built automatically.

3. **Run**  
   Start command: `npm start` (runs `node server.js`), which serves the built files from `dist/` and supports SPA routing.

4. **SPA routing**  
   `public/.htaccess` is copied into `dist/` on build so Apache (if used in front of Node) can redirect all routes to `index.html`.

## Local development

```bash
npm install
npm run dev    # Vite dev server (root: app/)
npm run build  # Output: dist/
npm start      # Serve dist/ with Express (production-like)
```

## SEO features included

- **Dynamic meta tags** (react-helmet-async): title, description, canonical, Open Graph, Twitter Card, geo tags
- **Structured data (JSON-LD)**: LocalBusiness/ProfessionalService on homepage; Service on service pages; AboutPage, ContactPage where relevant
- **Sitemap** at `public/sitemap.xml` and **robots.txt** at `public/robots.txt`
- **Build-time Tailwind** (no CDN), semantic HTML, and descriptive image alt text

## Project structure (production)

```
app/                 # React source (entry: app/index.html, app/index.tsx)
  config.ts          # Site URL + business info (edit before deploy)
  constants.ts       # IMAGES paths for public/media/
  components/
  pages/
public/
  media/             # Put images here; reference in constants.ts
  .htaccess          # SPA routing (copied to dist/)
  sitemap.xml
  robots.txt
dist/                # Build output (generated; do not commit)
server.js            # Express server for Hostinger
package.json         # postinstall = build; start = node server.js
```

After deployment, verify all routes load, meta tags update on navigation, and mobile layout works.
