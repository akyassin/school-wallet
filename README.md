# SchoolWallet

A financial management web application for Quran schools. Track income and expenses, manage budgets, generate reports, and export data — all localized for Swedish organizations (SEK, sv-SE).

## Features

- **Dashboard** — income/expense overview with charts and key metrics
- **Transactions** — record, edit, and filter income and expenses; attach receipts
- **Budgets** — set monthly or yearly spending limits per category
- **Recurring transactions** — automate repeating entries (weekly, monthly, yearly)
- **Reports** — date-range reports with CSV and PDF export
- **Category management** — system-default and custom categories per organization
- **Role-based access** — three tiers: `super_admin`, `admin`, `reviewer`
- **Registration approval workflow** — new accounts require admin approval
- **Dark / light theme**

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript, TanStack Start (Vite) |
| Routing | TanStack Router (file-based) |
| Database | PostgreSQL via `pg` (node-postgres) |
| Auth | JWT (`jsonwebtoken`) + bcrypt (`bcryptjs`) |
| Forms | React Hook Form + Zod |
| Styling | Tailwind CSS 4 + Radix UI (shadcn/ui pattern) |
| Charts | Recharts |
| PDF export | jsPDF + jspdf-autotable |
| Deployment | Cloudflare (Workers / Pages) |

## Getting Started

### Prerequisites

- Node.js 18+
- A PostgreSQL database
- (Optional) Cloudflare account for deployment

### Installation

```bash
git clone <repo-url>
cd school-wallet
npm install
```

### Environment

Create a `.env` file at the project root:

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
JWT_SECRET=your-secret-key
```

### Database setup

Run the schema once against your database:

```bash
psql $DATABASE_URL -f src/db/schema.sql
```

Then bootstrap the first `super_admin` account:

```sql
UPDATE users SET approved = true, role = 'super_admin' WHERE email = 'your@email.com';
```

### Development

```bash
npm run dev        # starts Vite dev server
npm run lint       # ESLint
npm run format     # Prettier (write)
```

### Production build

```bash
npm run build      # production bundle
npm run preview    # preview the production build locally
```

## Project Structure

```
src/
├── components/        # Shared UI components
│   └── ui/            # Radix UI wrappers (shadcn/ui pattern)
├── db/
│   └── schema.sql     # PostgreSQL schema
├── lib/               # Utilities and hooks
│   ├── auth-context.tsx
│   ├── categories.ts
│   ├── db.ts
│   ├── format.ts      # SEK/sv-SE formatters
│   └── theme.tsx
├── routes/            # File-based pages
│   ├── dashboard.tsx
│   ├── transactions.tsx
│   ├── budgets.tsx
│   ├── recurring.tsx
│   ├── reports.tsx
│   ├── users.tsx
│   └── login.tsx
└── server/            # Server-only DB functions (TanStack Start)
    ├── auth.ts
    ├── transactions.ts
    └── categories.ts
```

## Roles

| Role | Permissions |
|---|---|
| `super_admin` | Full access, manage users, manage system categories |
| `admin` | Create/edit/delete transactions and categories |
| `reviewer` | Read-only access to transactions and reports |

## Deployment

The app targets Cloudflare via `wrangler.jsonc`. Set your environment variables as Cloudflare secrets:

```bash
wrangler secret put DATABASE_URL
wrangler secret put JWT_SECRET
```

Then deploy:

```bash
npm run build
wrangler deploy
```
