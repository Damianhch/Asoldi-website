# Asoldi runtime data and LAN vs production

There are **two different things** to keep in sync. Mixing them is what made LAN `/sales` show 44 clients while `asoldi.com/sales` showed another number.

## 1) Code / structure → publish to asoldi.com

Same as before:

1. Edit and test on LAN (`http://192.168.68.92:3200`)
2. Commit / push the **Asoldi-website** repo
3. Hostinger deploys that commit to **https://asoldi.com**

Git never contains sales clients or Admin users. A deploy does not copy LAN JSON onto production, and it does not copy production JSON onto LAN.

## 2) Sales / client data → production is the only source of truth

Live CRM data (MyPhoner winners, backfills, client records) lives on Hostinger:

`~/.asoldi-website-data/sales-clients.json` on **asoldi.com**

LAN Docker stores a **one-way mirror** of that data in:

`C:\hosted\asoldi-data` → container `/data` (`APP_DATA_DIR=/data`)

Rules:

- **MyPhoner webhooks stay on asoldi.com.** LAN must not register or steal them (`MYPHONER_WEBHOOK_RECONCILE_ENABLED=0` on the LAN compose).
- **Adding/editing a client on LAN only changes the LAN copy.** It does not update asoldi.com. The next production mirror overwrites that local edit.
- **Backfill / “fix the real website”** must be run against **https://asoldi.com**, not the LAN URL, unless you explicitly ask to change the LAN copy only.
- **Refresh LAN so it matches production:**

```bash
PROD_ADMIN_PASSWORD='your-admin-password' node scripts/sync-prod-runtime.mjs --out-dir C:\hosted\asoldi-data
```

That pulls Admin users + the full sales client list from asoldi.com. It **never writes back**.

Users-only (legacy):

```bash
PROD_ADMIN_PASSWORD='your-admin-password' node scripts/sync-prod-users.mjs --out C:\hosted\asoldi-data\users.json
```

## Why the counts diverged

A workstation `~/.asoldi-website-data` folder (March 2026, ~45 clients) was copied onto LAN. Production had kept receiving MyPhoner winners (68 clients at last sync: 53 Asoldi + 15 SSU). Those are independent JSON files, not git.

## Do not overwrite LAN data on code updates

PC1 → PC2 code sync:

- `Asoldi-website` → `\\192.168.68.92\hosted\asoldi`
- `Website-creator` → `\\192.168.68.92\hosted\website-creator`

Never `/MIR` into `C:\hosted\asoldi-data`.

## Password hashes

The public admin API does not return user password hashes. Existing local hashes are kept when the username already exists; brand-new LAN users get `LAN_USER_SYNC_PASSWORD` or `ADMIN_PASSWORD`.

Optional env (see `.env.example`):

- `PROD_ADMIN_URL` (default `https://asoldi.com`)
- `PROD_ADMIN_USERNAME` / `PROD_ADMIN_PASSWORD`
- `LAN_USER_SYNC_PASSWORD`
