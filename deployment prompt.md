# SEO & Deployment Optimization Prompt for Client Websites


**Copy and paste this prompt for any new client website project.**


---


## USER PROVIDED DATA (Fill this section first)


### Domain Information
- **Domain URL**: `https://asoldi.com` (UPDATE THIS)
- **Domain Name**: `asoldi.com`


### Media Files Provided
**Media files are stored in `public/media/` and referenced in `app/constants.ts`:**
1. Drop image files into `public/media/`
2. Add the path in `app/constants.ts` under the `IMAGES` object
3. Use `IMAGES.yourKey` in components


**Example:**
- `public/media/logo.png` → `IMAGES.logo: "/media/logo.png"` → used in Navbar, Footer
- `public/media/hero-main.jpg` → `IMAGES.heroSalmon: "/media/hero-main.jpg"` → used in HomePage
- `public/media/food-menu.jpg` → `IMAGES.foodImage: "/media/food-menu.jpg"` → used in MenuPage


---


## Task: Optimize Website for SEO and Hostinger Deployment


I have a client website built in Google AI Studio that needs to be optimized for SEO and prepared for deployment to Hostinger (Node.js hosting). Please perform comprehensive SEO improvements and ensure the site works out-of-the-box when deployed.


**IMPORTANT**: This is an optimization task. Extract all business information automatically from the codebase - do NOT ask the user for business details, addresses, phone numbers, or page information. Only use placeholder domain URLs (client updates before deployment).


### Current State
- Website is a React/TypeScript application (likely built with Vite)
- May be using HashRouter instead of BrowserRouter
- May load Tailwind CSS from CDN (slow, must be replaced with build-time)
- Basic or missing SEO meta tags
- No structured data (JSON-LD)
- Missing sitemap.xml and robots.txt
- Not optimized for production deployment
- Images may be using external URLs (CDN) or local files


### CRITICAL: Auto-Extract Business Information


**BEFORE making any changes, you MUST:**


1. **Analyze the codebase** to automatically extract business information:
   - Search `constants.ts`, `config.ts`, or similar files for business name, address, phone
   - Search all page components for business name in titles/headings
   - Search for address patterns (street addresses, cities, postal codes)
   - Search for phone numbers (common formats: +XX XXX XXX XXX, (XXX) XXX-XXXX, etc.)
   - Search for coordinates in existing structured data or config files
   - Search for social media links in Footer, Navbar, or constants
   - Extract business description from homepage content or meta tags
   - Identify all routes/pages from App.tsx or router configuration


2. **Create/update `app/config.ts`** with extracted information:
   - Use extracted business name (don't ask user)
   - Use extracted address (don't ask user)
   - Use extracted phone number (don't ask user)
   - Use extracted coordinates if found, or leave empty if not found
   - Use placeholder domain `yourdomain.com` (client updates later)
   - Extract business description from existing content


3. **Map all pages automatically**:
   - Read App.tsx or router file to identify all routes
   - Extract page titles from existing content
   - Extract page descriptions from existing meta tags or content
   - Identify page types (Home, Menu, About, Blog, Contact, etc.)


**DO NOT ask the user for business information** - extract it from the codebase automatically. Only use placeholders for domain URLs (which client updates before deployment).


---


## Required SEO Optimizations


### 1. Router Optimization
- **Change HashRouter to BrowserRouter** if present
  - Replace `HashRouter` with `BrowserRouter` in the main App component
  - Ensure clean URLs (e.g., `/page` instead of `/#/page`)
  - Add HelmetProvider wrapper for dynamic meta tags


### 2. Dynamic Meta Tags Implementation
- **Install react-helmet-async** (use `--legacy-peer-deps` if React 19+)
- **Create a reusable SEO component** (`components/SEO.tsx`) that includes:
  - Title tags
  - Meta descriptions
  - Canonical URLs
  - Open Graph tags (og:title, og:description, og:image, og:url, og:type, og:locale, og:site_name)
  - Twitter Card tags (twitter:card, twitter:title, twitter:description, twitter:image)
  - Geo-location meta tags (geo.region, geo.placename, geo.position, ICBM)
  - Language and robots meta tags
  - Structured data (JSON-LD) support


### 3. Page-Specific SEO
- **Add SEO component to every page** with unique:
  - Page-specific titles (include business name and location)
  - Page-specific descriptions (50-160 characters, include keywords)
  - Page-specific images for social sharing (use local images from `IMAGES` constants)
  - Page-specific structured data schemas:
    - **Homepage**: Restaurant/LocalBusiness schema with full business details
    - **Menu pages**: Menu schema with sections
    - **About pages**: AboutPage schema
    - **Blog/News pages**: BlogPosting or Blog schema
    - **Contact/Booking pages**: Service schema with ordering options


### 4. Structured Data (JSON-LD)
- **Add comprehensive Restaurant/LocalBusiness schema** including:
  - Business name, address, phone, website URL
  - Geographic coordinates (latitude/longitude)
  - Cuisine type, price range
  - Opening hours specification
  - Aggregate ratings (if available)
  - Social media profiles (sameAs)
- **Add appropriate schemas** for other page types (Menu, Service, etc.)
- Ensure all structured data validates against Schema.org standards


### 5. Sitemap and Robots
- **Create `public/sitemap.xml`** with:
  - All main pages listed
  - Proper priority values (homepage: 1.0, main pages: 0.9, secondary: 0.7-0.8)
  - Change frequency (weekly for homepage/blog, monthly for static pages)
  - Last modified dates
  - Use placeholder domain `yourdomain.com` (client will update)
- **Create/update `public/robots.txt`** with:
  - Allow all user agents
  - Sitemap reference
  - Disallow rules for admin/private areas if needed


### 6. Enhanced index.html
- **Improve base meta tags**: title, description, keywords, author, robots, language, geo-location
- **Add Open Graph and Twitter Card tags** in HTML head
- **Add canonical URL** tag
- **Add structured data** (JSON-LD) in script tag
- **CRITICAL: Remove any CDN-loaded CSS/JS** (Tailwind CDN, esm.sh import maps, etc.)
- **Remove any broken or external references**


### 7. Tailwind CSS — Build-Time Only
- **NEVER use Tailwind Play CDN** (`cdn.tailwindcss.com`) — it's ~300KB and generates CSS at runtime, making the site extremely slow
- **Install as build-time tool**:
  ```bash
  npm install tailwindcss @tailwindcss/vite
  ```
- **Add plugin to `vite.config.ts`**:
  ```typescript
  import tailwindcss from '@tailwindcss/vite';
  plugins: [react(), tailwindcss()]
  ```
- **Create `app/styles.css`**:
  ```css
  @import "tailwindcss";
  ```
- **Import in `app/index.tsx`**: `import './styles.css';`
- **Remove ALL** Tailwind CDN `<script>` tags and inline `<script>tailwind.config = {...}</script>` blocks from `index.html`
- Move any custom theme values (fonts, colors, animations) into `app/styles.css` using `@theme { }` blocks


### 8. Image Optimization
- **Ensure all images have descriptive alt text**
- Fix any empty alt attributes
- Alt text should be descriptive and include relevant keywords naturally


### 9. Configuration Management
- **Create `app/config.ts`** file with: site URL, business name, address, phone, coordinates, description
- **Use config values** in SEO component and structured data
- Makes it easy for client to update domain/business info in one place


---


## Media System


**All media is managed through two things:**
1. `public/media/` folder — where image files live
2. `app/constants.ts` — the `IMAGES` object that maps keys to `/media/filename` paths


**Components import and use images like this:**
```typescript
import { IMAGES } from '../constants';
<img src={IMAGES.logo} alt="Logo" />
```


**If external CDN URLs exist**, download them to `public/media/` and update the path in `app/constants.ts`. No external image dependencies — everything local.


**To add a new image:**
1. Drop file into `public/media/`
2. Add entry in `app/constants.ts`: `myImage: "/media/my-image.jpg",`
3. Use `IMAGES.myImage` in any component


**To change an image:**
- Either replace the file in `public/media/` (keep same filename), OR
- Update the path in `app/constants.ts`


---


## Hostinger Deployment (Proven Working)


### Project Structure


```
├── app/              ← All React source (index.html, index.tsx, components, pages, etc.)
│   ├── index.html    ← HTML template (NO index.html in project root!)
│   ├── index.tsx     ← React entry point (imports styles.css)
│   ├── styles.css    ← Tailwind + custom styles (@import "tailwindcss")
│   ├── App.tsx
│   ├── config.ts     ← Business info + site URL (client edits this)
│   ├── constants.ts  ← IMAGES object mapping keys to /media/ paths
│   ├── components/
│   └── pages/
├── dist/             ← Build output (generated on server by postinstall; add to .gitignore)
├── public/
│   ├── media/        ← All image files
│   ├── .htaccess     ← SPA routing rules (copied to dist/ on build)
│   ├── sitemap.xml
│   └── robots.txt
├── server.js         ← Express server (ESM, simple ~45 lines)
├── package.json
├── vite.config.ts
└── .npmrc            ← legacy-peer-deps=true
```


**WHY this structure**: Having NO `index.html` in the project root prevents Hostinger from serving the raw source file directly (which causes MIME errors and blank screens).


### Step 1: Move Source to `app/` Folder


Move all React source files into `app/`:
- `index.html`, `index.tsx`, `App.tsx`, `pages/`, `components/`, `constants.ts`, `config.ts`, `styles.css`


Update `vite.config.ts`:
```typescript
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';


export default defineConfig({
  root: 'app',
  publicDir: path.resolve(__dirname, 'public'),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'app') }
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'esbuild'
  }
});
```


### Step 2: Create `server.js` (ESM, simple)


```javascript
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


const app = express();
const PORT = process.env.PORT || 3000;
const distPath = join(__dirname, 'dist');


app.use((req, res, next) => {
  if (req.path.match(/\.(tsx?|jsx)$/)) return res.status(404).send('Not found');
  next();
});


app.use(express.static(distPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));


app.get('*', (req, res) => {
  const indexPath = join(distPath, 'index.html');
  if (existsSync(indexPath)) res.sendFile(indexPath);
  else res.status(500).send('index.html not found');
});


app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
```


### Step 3: Create `public/.htaccess` (SPA routing for Hostinger's Apache layer)


```apache
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteCond %{REQUEST_FILENAME} !-l
RewriteRule . /index.html [L]
</IfModule>


<IfModule mod_deflate.c>
AddOutputFilterByType DEFLATE text/html text/css application/javascript application/json image/svg+xml
</IfModule>


<IfModule mod_expires.c>
ExpiresActive On
ExpiresByType text/css "access plus 1 year"
ExpiresByType application/javascript "access plus 1 year"
ExpiresByType image/jpeg "access plus 1 year"
ExpiresByType image/png "access plus 1 year"
ExpiresByType image/svg+xml "access plus 1 year"
</IfModule>
```


### Step 4: Configure `package.json`


**CRITICAL**:
- Vite, Tailwind, and all build tools MUST be in `dependencies` (NOT `devDependencies`). Hostinger runs `npm install` and may skip devDependencies; the build will fail if Vite is missing.
- Add **`"postinstall": "npm run build"`** so the build runs after npm install. Hostinger often only runs `npm install` (not a separate "Build command"); postinstall ensures the site is built and updated on every deploy.
- **Do NOT include native Node addons** in dependencies (see Step 4a below), or `npm install` will fail on Hostinger.


### Step 4a: Remove native addons (required for Hostinger)


Hostinger’s Node.js build environment **cannot compile native addons**. During `npm install`, packages that use `node-gyp` (e.g. **better-sqlite3**, native **bcrypt**, **sharp**) will try to build C++ code and fail because:
- The server has an older **glibc** (e.g. prebuilds expect GLIBC_2.29+).
- **Python** on the server is often 3.6; node-gyp may require 3.8+ and will throw `SyntaxError` during configure.

**Before deployment:**

1. **Audit `package.json`** for native addons: `better-sqlite3`, `bcrypt` (use `bcryptjs` if you need hashing), `sharp`, `node-sass`, or any package that runs `prebuild-install` or `node-gyp rebuild` on install.
2. **Remove any that the app does not use.** Static SPAs served by Express do not need database drivers or native modules; AI Studio / template projects often leave e.g. `better-sqlite3` in dependencies by mistake — remove it if it is not imported anywhere.
3. **If the site is static (React SPA + Express serving `dist/`)**: Only keep dependencies needed for the **build** (Vite, React, Tailwind, etc.) and **runtime** (express). Do not keep SQLite, native crypto, or image processors unless the server code actually uses them.

**If you need a database or native feature:** Use a hosted API, serverless function, or a stack that doesn’t rely on native compilation on Hostinger’s Node.js (e.g. use their PHP/MySQL for DB, or an external API).


```json
{
  "name": "project-name",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "main": "server.js",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "postinstall": "npm run build",
    "preview": "vite preview",
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.22.1",
    "react": "^19.x",
    "react-dom": "^19.x",
    "react-helmet-async": "^2.0.5",
    "react-router-dom": "^6.x",
    "@tailwindcss/vite": "^4.x",
    "@vitejs/plugin-react": "^5.x",
    "tailwindcss": "^4.x",
    "typescript": "~5.x",
    "vite": "^6.x"
  }
}
```


### Step 5: Create `.npmrc`


```
legacy-peer-deps=true
```


### Step 6: Push to GitHub


Build runs on the server via **postinstall** after `npm install`. No need to commit `dist/` — add `dist/` to `.gitignore`. Push source; Hostinger installs, runs postinstall (build), and serves the built output.


```bash
git add -A
git commit -m "Production ready"
git push
```


**Hostinger auto-deploys from GitHub.** After push, the site updates when the deploy completes.


### Step 7: Update `.gitignore`


```
node_modules/
dist/
.env
.env.local
server.log
```


---


## Additional SEO Best Practices


1. **Semantic HTML**: Proper heading hierarchy (h1, h2, h3)
2. **Internal Linking**: Navigation links use proper anchor text
3. **Mobile Responsiveness**: Correct viewport meta tag
4. **Page Speed**: No CDN dependencies, build-time CSS, optimized bundle
5. **Accessibility**: ARIA labels where needed, keyboard navigation


---


## Pre-Deployment Checklist


- [ ] Update domain URL in `app/config.ts`
- [ ] Update domain URL in `public/sitemap.xml`
- [ ] Update domain URL in `public/robots.txt`
- [ ] Update domain URL in `app/index.html` (Open Graph URLs)
- [ ] Verify business info in `app/config.ts`
- [ ] Verify all image paths in `app/constants.ts` point to files in `public/media/`
- [ ] Ensure `package.json` has `"postinstall": "npm run build"` and build tools in `dependencies`
- [ ] Remove native addons from `package.json` (e.g. better-sqlite3, native bcrypt, sharp) if not used — Hostinger cannot build them and install will fail (see Step 4a)
- [ ] Push to GitHub → Hostinger runs npm install → postinstall runs build → site updates
- [ ] Verify all pages load at live URL
- [ ] Test mobile responsiveness
- [ ] Test all navigation routes


---


## Expected Deliverables


✅ **SEO Score: 9/10** — Clean URLs, dynamic meta tags, structured data, sitemap, Open Graph, proper alt text, geo-location


✅ **Deployment Ready** — Express server, source in `app/`, postinstall runs build on deploy, .htaccess for SPA routing, build tools in dependencies


✅ **Production Optimized** — Build-time Tailwind CSS (~35KB vs ~300KB CDN), no external dependencies, fast loading


✅ **Local Media** — All images in `public/media/`, mapped in `app/constants.ts`, zero CDN dependencies


---


## Important Notes


1. **Preserve Existing Design**: Do NOT change visual design, layout, or user experience. Only optimize SEO and deployment.
2. **Domain Placeholders**: Use `yourdomain.com` as placeholder. Client updates before deployment.
3. **Auto-Extract Business Info**: Search codebase for business details — do NOT ask user. Only placeholder domain URLs.
4. **Test Everything**: Build completes, preview works, all routes navigate, meta tags update on navigation.
5. **Hostinger: No native addons**: Remove packages like `better-sqlite3` from dependencies if unused — Hostinger’s install environment cannot compile native addons (node-gyp), so install would fail. Static SPA + Express does not need them.


---


**Please implement all optimizations, test thoroughly, and provide clear documentation for the client. The website should be production-ready and SEO-optimized when complete.**





