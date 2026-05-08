-- Madrasa Ledger — PostgreSQL schema
-- Run this once against your database to set up the tables.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE transaction_type AS ENUM ('income', 'expense');

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role                VARCHAR(20) NOT NULL DEFAULT 'reviewer',
  active              BOOLEAN NOT NULL DEFAULT true,
  approved            BOOLEAN NOT NULL DEFAULT false,
  reset_requested     BOOLEAN NOT NULL DEFAULT false,
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type             transaction_type NOT NULL,
  amount           NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  category         VARCHAR(255) NOT NULL,
  description      TEXT,
  transaction_date DATE NOT NULL,
  receipt_data     TEXT,
  receipt_name     TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date
  ON transactions (user_id, transaction_date DESC);

CREATE TABLE IF NOT EXISTS categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(255) NOT NULL,
  type       transaction_type NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, name, type)
);

CREATE TABLE IF NOT EXISTS budgets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category   VARCHAR(255) NOT NULL,
  type       transaction_type NOT NULL,
  amount     NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  period     VARCHAR(10) NOT NULL CHECK (period IN ('monthly', 'yearly')),
  year       INTEGER NOT NULL,
  month      INTEGER CHECK (month BETWEEN 1 AND 12),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recurring_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          transaction_type NOT NULL,
  amount        NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  category      VARCHAR(255) NOT NULL,
  description   TEXT,
  frequency     VARCHAR(10) NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
  start_date    DATE NOT NULL,
  next_due_date DATE NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_user_due
  ON recurring_transactions (user_id, next_due_date) WHERE active = true;

-- Migration: run these against an existing database to add new columns/tables
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'admin';
-- ALTER TABLE transactions ADD COLUMN IF NOT EXISTS receipt_data TEXT;
-- ALTER TABLE transactions ADD COLUMN IF NOT EXISTS receipt_name TEXT;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT false;
-- UPDATE users SET approved = true; -- approve all pre-existing accounts
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_requested BOOLEAN NOT NULL DEFAULT false;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
-- UPDATE users SET approved = true, role = 'super_admin' WHERE email = 'your@email.com'; -- bootstrap first super_admin

-- Migration: manageable system-default categories (user_id = NULL means global default)
-- ALTER TABLE categories ALTER COLUMN user_id DROP NOT NULL;
-- ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_user_id_name_type_key;
-- CREATE UNIQUE INDEX IF NOT EXISTS categories_global_name_type ON categories (name, type) WHERE user_id IS NULL;
-- CREATE UNIQUE INDEX IF NOT EXISTS categories_user_name_type ON categories (user_id, name, type) WHERE user_id IS NOT NULL;
-- INSERT INTO categories (user_id, name, type) VALUES
--   (NULL, 'Tuition fees', 'income'),
--   (NULL, 'Donations', 'income'),
--   (NULL, 'Zakat', 'income'),
--   (NULL, 'Sadaqah', 'income'),
--   (NULL, 'Fundraising', 'income'),
--   (NULL, 'Book sales', 'income'),
--   (NULL, 'Other income', 'income'),
--   (NULL, 'Salaries', 'expense'),
--   (NULL, 'Rent', 'expense'),
--   (NULL, 'Utilities', 'expense'),
--   (NULL, 'Books & supplies', 'expense'),
--   (NULL, 'Maintenance', 'expense'),
--   (NULL, 'Food & refreshments', 'expense'),
--   (NULL, 'Transport', 'expense'),
--   (NULL, 'Events', 'expense'),
--   (NULL, 'Other expense', 'expense')
-- ON CONFLICT DO NOTHING;
