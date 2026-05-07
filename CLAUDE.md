# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**SchoolWallet** — a financial management web app for Quran schools. Tracks income and expenses, generates reports, and exports to CSV/PDF. Localized for Swedish organizations (currency: SEK, locale: sv-SE).

## Commands

```bash
npm run dev          # Start dev server (Vite)
npm run build        # Production build
npm run build:dev    # Development build
npm run preview      # Preview production build
npm run lint         # ESLint
npm run format       # Prettier (write)
```

There is no test suite configured.

## Tech Stack

- **React 19** + **TypeScript** with TanStack Start (full-stack React/Vite meta-framework)
- **TanStack Router** — file-based routing under `src/routes/`
- **PostgreSQL** via `pg` (node-postgres) — database; `src/lib/db.ts` exports the pool
- **JWT auth** via `jsonwebtoken` + `bcryptjs` — replaces Supabase Auth
- **TanStack Start server functions** — all DB access in `src/server/` (runs server-side only)
- **React Hook Form** + **Zod** — form handling and validation
- **Tailwind CSS 4** + Radix UI (shadcn/ui-style components in `src/components/ui/`)
- **Recharts** — dashboard charts
- **jsPDF** + **jspdf-autotable** — PDF export
- **Cloudflare** — deployment target (`wrangler.jsonc`)

## Architecture

### Routing

TanStack Router uses file-based routing. `src/routes/__root.tsx` is the root layout — it wraps everything in `AuthProvider` and `ThemeProvider`. Route files map directly to pages: `dashboard.tsx`, `transactions.tsx`, `reports.tsx`, `login.tsx`.

### Auth

`src/lib/auth-context.tsx` provides `AuthProvider` and `useAuth()`. Auth state (JWT token + user object) is persisted in `localStorage` under keys `auth_token` and `auth_user`. The context exposes `signIn(token, user)` and `signOut()`. Server-side JWT utilities (sign/verify/bcrypt) live in `src/lib/auth-server.ts` — never import this file from client code.

Route `beforeLoad` guards check `localStorage.getItem("auth_token")` with a `typeof window === "undefined"` SSR guard.

### Data Layer

All DB access is server-side only via TanStack Start server functions in `src/server/`:
- `auth.ts` — `loginFn`, `signUpFn`, `verifySessionFn`
- `transactions.ts` — `listTransactionsFn`, `listTransactionsByRangeFn`, `createTransactionFn`, `updateTransactionFn`, `deleteTransactionFn`
- `categories.ts` — `listCategoriesFn`, `createCategoryFn`, `deleteCategoryFn`

Each server function receives a `token` field; it validates the JWT and extracts `user_id` internally — callers never pass `user_id` directly. The pg Pool is in `src/lib/db.ts` (reads `DATABASE_URL` from env).

**Tables** (schema in `src/db/schema.sql`):
- `users` — `id, email, password_hash, created_at`
- `transactions` — `id, user_id, type ('income'|'expense'), amount, category, description, transaction_date`
- `categories` — `id, user_id, name, type` (user-defined custom categories)

Default categories (not stored in DB) are defined in `src/lib/categories.ts`.

### Components

- `src/components/ui/` — Radix UI wrappers (shadcn/ui pattern). Treat as a library; modify sparingly.
- `src/components/Header.tsx` — navigation header with auth state and theme toggle
- `src/components/TransactionForm.tsx` — dialog for add/edit transactions
- `src/components/CategoryManager.tsx` — dialog for managing custom categories

### Utilities

- `src/lib/format.ts` — all currency and date formatting (SEK/sv-SE). Use these helpers, not inline `Intl` calls.
- `src/lib/utils.ts` — `cn()` for className merging (clsx + tailwind-merge)
- `src/lib/theme.tsx` — dark/light theme provider (persisted to localStorage)
- `src/lib/use-categories.ts` — hook merging default + custom categories

## Code Conventions

- Path alias `@/*` maps to `src/*`
- Prettier: 100-char line width, double quotes, trailing commas everywhere, semicolons on
- Component files use `.tsx`; utility/hook files use `.ts`
- Custom hooks in `src/lib/` prefixed with `use-`
