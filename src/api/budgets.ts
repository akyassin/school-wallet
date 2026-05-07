import { createServerFn } from '@tanstack/react-start';
import pool from '@/lib/db';
import { verifyToken } from '@/lib/auth-server';

function userId(token: string): string {
  return verifyToken(token).sub;
}

function requireWriter(token: string): string {
  const payload = verifyToken(token);
  if (payload.role !== 'super_admin' && payload.role !== 'admin') {
    throw new Error('You do not have permission to perform this action');
  }
  return payload.sub;
}

export const listBudgetsFn = createServerFn({ method: 'GET' })
  .inputValidator(
    (data: { token: string; period: 'monthly' | 'yearly'; year: number; month?: number }) => data,
  )
  .handler(async ({ data }) => {
    const uid = userId(data.token);
    const { rows } = await pool.query(
      `SELECT
        b.id, b.category, b.type, b.amount::float AS amount, b.period, b.year, b.month,
        COALESCE(SUM(t.amount), 0)::float AS actual
       FROM budgets b
       LEFT JOIN transactions t
         ON t.user_id = b.user_id
         AND t.category = b.category
         AND t.type = b.type
         AND (
           (b.period = 'monthly'
            AND EXTRACT(YEAR FROM t.transaction_date) = b.year
            AND EXTRACT(MONTH FROM t.transaction_date) = b.month)
           OR
           (b.period = 'yearly'
            AND EXTRACT(YEAR FROM t.transaction_date) = b.year)
         )
       WHERE b.user_id = $1
         AND b.period = $2
         AND b.year = $3
         AND ($4::int IS NULL OR b.month = $4)
       GROUP BY b.id
       ORDER BY b.type, b.category`,
      [uid, data.period, data.year, data.month ?? null],
    );
    return rows as Array<{
      id: string;
      category: string;
      type: 'income' | 'expense';
      amount: number;
      actual: number;
      period: 'monthly' | 'yearly';
      year: number;
      month: number | null;
    }>;
  });

export const upsertBudgetFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: {
      token: string;
      category: string;
      type: 'income' | 'expense';
      amount: number;
      period: 'monthly' | 'yearly';
      year: number;
      month?: number;
    }) => data,
  )
  .handler(async ({ data }) => {
    const uid = requireWriter(data.token);
    const month = data.month ?? null;
    const { rows: existing } = await pool.query(
      `SELECT id FROM budgets
       WHERE user_id=$1 AND category=$2 AND type=$3 AND period=$4 AND year=$5
         AND (month=$6 OR (month IS NULL AND $6::int IS NULL))`,
      [uid, data.category, data.type, data.period, data.year, month],
    );
    if (existing.length > 0) {
      await pool.query('UPDATE budgets SET amount=$1 WHERE id=$2', [data.amount, existing[0].id]);
    } else {
      await pool.query(
        `INSERT INTO budgets (user_id, category, type, amount, period, year, month)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [uid, data.category, data.type, data.amount, data.period, data.year, month],
      );
    }
  });

export const deleteBudgetFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { token: string; id: string }) => data)
  .handler(async ({ data }) => {
    const uid = requireWriter(data.token);
    await pool.query('DELETE FROM budgets WHERE id=$1 AND user_id=$2', [data.id, uid]);
  });
