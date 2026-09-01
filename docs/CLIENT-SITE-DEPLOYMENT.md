# Add CMS to a client site – step-by-step (including Hostinger)

Use this when you want **clientdomain.com/admin** for a client. The hub (asoldi.com/superadmin) only stores **feature flags, plan, catalog type, site key, and `githubRepo`**. Website code and CMS software live in that client’s **private GitHub repo**. Users, products, and uploads live on **Hostinger disk**, outside the Git clone (`~/.asoldi-cms-data/<siteKey>`).

When the **Users** feature is enabled, the client CMS must support **changing user role** (employee, client, none). See [CMS-USER-ROLES.md](CMS-USER-ROLES.md).

---

## Summary (new Maker sites)

1. **Hub:** Add the client in super-admin (or let Maker **Publish to GitHub** register the site) and copy the **site key** if you need it by hand.
2. **Website Creator:** **Publish to GitHub** — Express + vendored CMS + Maker HTML on `main`. No SFTP. No Hostinger API website create.
3. **hPanel (once per domain):** **Websites → Add Website → Node.js web app → Import Git repository** → that repo. Framework **express**, entry **`server.js`**, **empty** build, Node **22**. Deploy.

Later Maker publishes are push-only; Hostinger auto-deploys `main`.

Existing React/Vite clients (Mong Sushi) skip step 2–3 Maker template and keep their own `server.js`. See [Existing React/Vite client sites](#existing-reactvite-client-sites) below.

---

## Step 1 – In the hub (main Asoldi site)

1. Open **super-admin**: `https://asoldi.com/superadmin` (or the current hub host).
2. Log in (same as `/admin` on the main site). Username is **`asoldi.com`**.
3. Click **Add site**:
   - **Name:** e.g. Mong Sushi
   - **Domain:** e.g. `mongsushi.no`
   - **Website plan** and, for shops, **ecommerce catalog type** (menu / tiers / normal).
   - **GitHub repo** (optional): `Damianhch/website---mongsushi` — Maker fills this on Publish.
4. Save, then **copy the site key** if you will set Hostinger env by hand.

---

## Step 2 – Maker: Publish to GitHub

On the Maker PC, after Step 3 (or a custom edit):

1. Set Maker env: `GITHUB_TOKEN` (create private repos + push), `GITHUB_ORG=Damianhch`, optional `CLIENT_REPOS_ROOT`, `CMS_HUB_URL=https://asoldi.com`.
2. Open the run → **Publish to GitHub**.
3. Maker creates or reuses `Damianhch/website---{slug}`, writes `server.js`, `public/` (HTML), `vendor/client-cms`, `cms.config.json`, `HOSTINGER.md`, and pushes `main`.
4. If that repo is already cloned locally with the matching remote, Maker **does not clone again**.

Do **not** SFTP into `public_html`. Do **not** pre-create a classic Hostinger website for that domain (it blocks Node.js web app onboarding). Do **not** put `vite`/`react` in the client `package.json` — Hostinger would treat the app as static and never start `server.js`.

---

## Step 3 – Optional Hostinger env

Maker already wrote `cms.config.json` in the private repo. Public pages and `/admin` work with no extra env.

| Variable | Example | Required |
|---|---|---|
| `CMS_HUB_URL` | `https://asoldi.com` | No if `cms.config.json` is present |
| `CMS_SITE_KEY` | hub site key | No if `cms.config.json` is present |
| `CMS_DATA_PATH` | `/home/u.../.asoldi-cms-data/my-site` | No (default `~/.asoldi-cms-data/<siteKey>`) |

Do **not** set `NPM_TOKEN` when CMS is vendored (`file:vendor/client-cms`).

---

## Step 4 – Connect GitHub in hPanel (once)

1. **Websites → Add Website → Node.js web app → Import Git repository**.
2. Pick `Damianhch/website---{client}`.
3. Framework **express**, branch **main**, Node **22**, entry **`server.js`**, **empty** build command.
4. Deploy. Later Maker publishes / `git push` auto-deploy.

If Hostinger auto-detects Vite, override to Express + `server.js`. If the domain is already a non-Node website, remove that slot first.

After deploy, `clientdomain.com` is the Maker HTML and `clientdomain.com/admin` is the CMS (modules from superadmin). Client users/products stay on that Hostinger disk across deploys.

---

## Existing React/Vite client sites

Use this only for hand-built SPAs such as Mong Sushi. New Maker sites should **not** follow this path.

### Install the package (npm or vendor)

Prefer **vendoring** `website-cms` as `file:vendor/client-cms` so Hostinger does not need `NPM_TOKEN`. If you install from GitHub Packages instead:

- Scope: `npm config set "@damianhch:registry" "https://npm.pkg.github.com"`
- Project `.npmrc`:
  ```ini
  legacy-peer-deps=true
  @damianhch:registry=https://npm.pkg.github.com
  //npm.pkg.github.com/:_authToken=${NPM_TOKEN}
  ```
- `npm install @damianhch/client-cms`

Full registry detail: **[PUBLISH-NPM-PACKAGE-WALKTHROUGH.md](PUBLISH-NPM-PACKAGE-WALKTHROUGH.md)** → Part E.

### Server (API)

Mount **before** `express.static` / SPA fallback. Omit `dataPath` so content lives under `~/.asoldi-cms-data/<siteKey>`:

```js
import createCmsRoutes from '@damianhch/client-cms';

app.use(express.json());
app.use('/api/cms', createCmsRoutes({
  hubUrl: process.env.CMS_HUB_URL || 'https://asoldi.com',
  siteKey: process.env.CMS_SITE_KEY,
}));
```

HTML (non-React) apps should also `import { mountCmsAdmin } from '@damianhch/client-cms'` and call `mountCmsAdmin(app)` so `/admin` is the prebuilt SPA.

### React app (route + hide client layout on /admin)

```jsx
import { ClientCMS } from '@damianhch/client-cms/ClientCMS';

function AppInner() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith('/admin');

  const toggleMenu = () => {
    setIsMenuOpen((open) => {
      const next = !open;
      document.body.style.overflow = next ? 'hidden' : 'unset';
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[#121212] font-sans selection:bg-[#E53935] selection:text-white">
      {!isAdmin && <Navbar onMenuToggle={toggleMenu} isMenuOpen={isMenuOpen} />}
      {!isAdmin && <MenuOverlay isOpen={isMenuOpen} onClose={toggleMenu} />}

      <main className="relative z-0">
        <Routes>
          <Route path="/admin" element={<ClientCMS />} />
          <Route path="/" element={<Home />} />
          <Route path="/meny" element={<Menu />} />
          <Route path="/om-oss" element={<About />} />
          <Route path="/blogg" element={<Blog />} />
          <Route path="/booking" element={<Booking />} />
        </Routes>
      </main>

      {!isAdmin && <Footer />}
    </div>
  );
}

function App() {
  return (
    <HelmetProvider>
      <Router>
        <ScrollToTop />
        <AppInner />
      </Router>
    </HelmetProvider>
  );
}
```

- Always add `<Route path="/admin" element={<ClientCMS />} />`.
- `useLocation` stays inside the router so the client navbar/footer hide on `/admin`.

### Tailwind (React CMS UI only)

If the client uses Tailwind, scan the package so classes are not purged:

```css
@import "tailwindcss";

/* So CMS Tailwind classes are not purged */
@source "../node_modules/@damianhch/client-cms/**/*.jsx";
```

Maker HTML sites skip this: they serve `vendor/client-cms/admin-dist`.

Hostinger for these existing apps: connect the GitHub repo (classic Git or Node.js web app). Keep `CMS_HUB_URL` and `CMS_SITE_KEY` in env. Vite in `package.json` makes Hostinger treat the app as static — Mong Sushi already has a custom `server.js` on classic Git; do not migrate it onto the Node.js Web App product unless you drop Vite from `package.json` or Hostinger is already starting Node.

---

## Quick reference – which doc does what

| Doc | Use it for |
|-----|------------|
| **[SETUP-HUB-AND-CLIENTS.md](SETUP-HUB-AND-CLIENTS.md)** | Hub vs client overview; Maker vs hand-built React. |
| **This file (CLIENT-SITE-DEPLOYMENT.md)** | End-to-end: hub → Maker GitHub publish → hPanel Node.js web app. |
| **[PUBLISH-NPM-PACKAGE-WALKTHROUGH.md](PUBLISH-NPM-PACKAGE-WALKTHROUGH.md)** | Publishing `@damianhch/client-cms`; Part E for GitHub Packages (existing React sites only). |

---

## Changing domain later

1. In super-admin, set **Domain** to the new hostname.
2. Leave **CMS_SITE_KEY** as is. Update **CMS_HUB_URL** only if the hub URL changes.
