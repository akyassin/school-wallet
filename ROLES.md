# Role Permissions

SchoolWallet uses three roles. Every new registration defaults to **Reviewer** and must be approved by a Super Admin before the account can be used.

## Comparison

| Capability | Reviewer | Admin | Super Admin |
|---|:---:|:---:|:---:|
| View dashboard & charts | ✅ | ✅ | ✅ |
| View transactions | ✅ | ✅ | ✅ |
| View budgets | ✅ | ✅ | ✅ |
| View recurring transactions | ✅ | ✅ | ✅ |
| Export CSV / PDF reports | ✅ | ✅ | ✅ |
| Add / edit / delete transactions | ❌ | ✅ | ✅ |
| Add / edit / delete budgets | ❌ | ✅ | ✅ |
| Add / edit / delete recurring | ❌ | ✅ | ✅ |
| Manage custom categories | ❌ | ✅ | ✅ |
| View Users page | ❌ | ❌ | ✅ |
| Approve / reject registrations | ❌ | ❌ | ✅ |
| Change user roles | ❌ | ❌ | ✅ |
| Activate / deactivate users | ❌ | ❌ | ✅ |
| Set temporary passwords | ❌ | ❌ | ✅ |
| Delete users | ❌ | ❌ | ✅ |

## Role assignment

- **Super Admin** — must be set manually in the database on first setup, or promoted by an existing Super Admin via the Users page.
- **Admin** — assigned by a Super Admin when approving a new registration, or changed later via the Users page.
- **Reviewer** — the default role for all new registrations; read-only access.

## Enforcement

Permissions are enforced in two places:

1. **UI** — write buttons (Add, Edit, Delete) are hidden for roles that don't have write access.
2. **Server** — all write API endpoints reject requests from Reviewer accounts with a `403`-equivalent error, even if called directly.

## First-time database setup

After running the schema migrations, bootstrap the first Super Admin:

```sql
UPDATE users
SET approved = true, role = 'super_admin'
WHERE email = 'your@email.com';
```
