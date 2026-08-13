# Asoldi runtime data (users, admin, sales)

Git only has **code**. Admin → Users, sales clients, calendar tokens, and similar CMS records live in JSON files **outside the repo**. Cloning or robocopying the Asoldi-website repo will never recreate the live `asoldi.com/admin` user list.

## Where the data actually lives

| Environment | Path | Notes |
|---|---|---|
| **Production (`asoldi.com`)** | Hostinger home `~/.asoldi-website-data/` (or `APP_DATA_DIR` / `.builds/data` if set) | Source of truth for live users |
| **LAN Docker (PC2)** | `C:\hosted\asoldi-data\` mounted as `/data` (`APP_DATA_DIR=/data`) | Survives code sync and container recreate |
| **This Windows PC (local Node)** | `C:\Users\<you>\.asoldi-website-data\` | Often stale vs production; do not treat as source of truth |

`data/users.json` in the repo is gitignored. The `u439392007.asoldi.com` FTP account is a subdomain jail and does **not** contain the CMS data directory.

## Do not overwrite LAN data on code updates

PC1 → PC2 code sync is:

- `...\Asoldi-website` → `\\192.168.68.92\hosted\asoldi`
- `...\Website-creator` → `\\192.168.68.92\hosted\website-creator`

Never `/MIR` into `C:\hosted\asoldi-data`. That folder is the CMS database for LAN `/admin`.

## Refresh users from production

From the Asoldi-website repo (uses `asoldi.com/admin` login, not FTP):

```bash
PROD_ADMIN_PASSWORD='your-admin-password' node scripts/sync-prod-users.mjs --out "$HOME/.asoldi-website-data/users.json"
```

On PC2 / LAN Docker:

```bash
PROD_ADMIN_PASSWORD='your-admin-password' node scripts/sync-prod-users.mjs --out C:\hosted\asoldi-data\users.json
```

The public admin API does not return password hashes. Existing local hashes are kept when the username already exists; brand-new LAN users get `LAN_USER_SYNC_PASSWORD` or `ADMIN_PASSWORD`. Set per-user passwords afterwards in **Admin → Users** if needed.

Optional env (see `.env.example`):

- `PROD_ADMIN_URL` (default `https://asoldi.com`)
- `PROD_ADMIN_USERNAME` / `PROD_ADMIN_PASSWORD`
- `LAN_USER_SYNC_PASSWORD`
