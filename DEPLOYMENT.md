# asoldi.com Hostinger deploy

The product split (hub vs client Git vs Hostinger disk) is in [docs/deployment-split.md](docs/deployment-split.md).

## Hub (this repo)

Do **not** rely on Git auto-deploy while Sales recordings and large media are tracked in `public/`. That clone is ~1 GB and fills the plan next to the live copy.

Deploy a **small archive** (code + `dist`, exclude `public/myphoner-audio` and large `public/media`):

1. Copy recordings to `~/.asoldi-website-data/myphoner-audio` if that backup is not already there.
2. Zip the app without wav/mp4/`node_modules`/`.git` (keep under 50 MB).
3. Hostinger API: upload to `public_html`, `POST` Node.js build `source_type=archive`.
4. Settings that match the last green log: Express, Node **22**, entry `server.js`, build script `build`, Vite in dependencies, `postinstall` → `vite build`, `publicDir: false` on production Vite.
5. If `public/myphoner-audio` was overwritten, copy it back from `~/.asoldi-website-data/myphoner-audio`.
6. Confirm live JS is a new `assets/index-*.js` (not an old hash) and `/sales` + `/superadmin` return 200.

CRM JSON in `~/.asoldi-website-data` is outside the clone. Do not delete that folder.

The `backups/` subfolder is only historical copies of those JSON files. The app never reads it. If Hostinger inodes are full, delete timestamped files in `backups/` (keep the sibling live `*.json` files, and keep `myphoner-audio` if present). After deploy, the app keeps at most `DATA_BACKUP_KEEP` dated copies per file (default 5).

## Client sites

Maker **Publish to GitHub**, then one hPanel Git import. See [docs/CLIENT-SITE-DEPLOYMENT.md](docs/CLIENT-SITE-DEPLOYMENT.md) and [docs/deployment-split.md](docs/deployment-split.md).
