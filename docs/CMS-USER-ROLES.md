# CMS Users feature: role management

When the **Users** feature is enabled (in the hub or via config), the CMS must support **user roles**. This applies to:

- **Main site (Asoldi)** – `/admin` on the main site includes Manage clients (hub) and Users with roles.
- **Client CMS** – When the Users feature is activated for a client site in the hub, that site’s CMS (e.g. from `@damianhch/client-cms`) must also support changing user roles.

## The three roles

| Role       | Description |
|-----------|-------------|
| **employee** | Can log in at /login (ansatt) and access the Ansatt (employee) page. |
| **client**   | Reserved for future client-specific behaviour. |
| **none**     | Default for new users. No special access. |

- New users are created with role **none**. Admins must set **employee** (or **client**) manually.
- Only users with role **employee** can access the Ansatt page; others get 403 when calling `/api/auth/me` with a valid token.

## What the CMS must do

When **Users** is enabled:

1. **List users** – Include each user’s **role** (employee / client / none) in the response.
2. **Create user** – Accept optional `role`; default to **none** if omitted.
3. **Update user** – Allow changing **role** (e.g. dropdown or select in the Users tab). Persist via `PUT /api/admin/users/:id` with body `{ role: 'employee' | 'client' | 'none' }` (or equivalent in the client CMS package’s API).

So: **changing user role is part of the Users functionality** whenever that feature is activated—on the main site and on every client CMS.
