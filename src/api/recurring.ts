import { createServerFn } from '@tanstack/react-start';
import pool from '@/lib/db';
import { verifyToken } from '@/lib/auth-server';

function userId(token: string): string {
  return verifyToken(token).sub;
}

function advanceDate(date: Date, frequency: string): Date {
  const next = new Date(date);
  if (frequency === 'weekly') next.setDate(next.getDate() + 7);
  else if (frequency === 'monthly') next.setMonth(next.getMonth() + 1);
  else if (frequency === 'yearly') next.setFullYear(next.getFullYear() + 1);
  return next;
}

const fmt = (d: Date) => d.toISOString().slice(0, 10);

export const listRecurringFn = createServerFn({ method: 'GET' })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    const uid = userId(data.token);
    const { rows } = await pool.query(
      `SELECT id, type, amount::float AS amount, category, description,
              frequency, start_date, next_due_date, active
       FROM recurring_transactions WHERE user_id=$1
       ORDER BY active DESC, next_due_date ASC`,
      [uid],
    );
    return rows as Array<{
      id: string;
      type: 'income' | 'expense';
      amount: number;
      category: string;
      description: string | null;
      frequency: 'weekly' | 'monthly' | 'yearly';
      start_date: string;
      next_due_date: string;
      active: boolean;
    }>;
  });

export const createRecurringFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: {
      token: string;
      type: 'income' | 'expense';
      amount: number;
      category: string;
      description: string | null;
      frequency: 'weekly' | 'monthly' | 'yearly';
      start_date: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const uid = userId(data.token);
    await pool.query(
      `INSERT INTO recurring_transactions
         (user_id, type, amount, category, description, frequency, start_date, next_due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
      [uid, data.type, data.amount, data.category, data.description, data.frequency, data.start_date],
    );
  });

export const toggleRecurringFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { token: string; id: string; active: boolean }) => data)
  .handler(async ({ data }) => {
    const uid = userId(data.token);
    await pool.query(
      'UPDATE recurring_transactions SET active=$1 WHERE id=$2 AND user_id=$3',
      [data.active, data.id, uid],
    );
  });

export const deleteRecurringFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { token: string; id: string }) => data)
  .handler(async ({ data }) => {
    const uid = userId(data.token);
    await pool.query(
      'DELETE FROM recurring_transactions WHERE id=$1 AND user_id=$2',
      [data.id, uid],
    );
  });

export const applyDueRecurringFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    const uid = userId(data.token);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { rows } = await pool.query(
      `SELECT * FROM recurring_transactions
       WHERE user_id=$1 AND active=true AND next_due_date <= $2`,
      [uid, fmt(today)],
    );
    let count = 0;
    for (const r of rows) {
      let due = new Date(r.next_due_date);
      while (due <= today) {
        await pool.query(
          `INSERT INTO transactions (user_id, type, amount, category, description, transaction_date)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [uid, r.type, r.amount, r.category, r.description, fmt(due)],
        );
        count++;
        due = advanceDate(due, r.frequency);
      }
      await pool.query(
        'UPDATE recurring_transactions SET next_due_date=$1 WHERE id=$2',
        [fmt(due), r.id],
      );
    }
    return { count };
  });
