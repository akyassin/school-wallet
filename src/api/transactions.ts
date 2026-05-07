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

export const listTransactionsFn = createServerFn({ method: 'GET' })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    const uid = userId(data.token);
    const { rows } = await pool.query(
      `SELECT id, type, amount, category, description, transaction_date,
              (receipt_name IS NOT NULL) AS has_receipt
       FROM transactions WHERE user_id = $1
       ORDER BY transaction_date DESC`,
      [uid],
    );
    return rows as Array<{
      id: string;
      type: 'income' | 'expense';
      amount: number;
      category: string;
      description: string | null;
      transaction_date: string;
      has_receipt: boolean;
    }>;
  });

export const listTransactionsByRangeFn = createServerFn({ method: 'GET' })
  .inputValidator((data: { token: string; from: string; to: string }) => data)
  .handler(async ({ data }) => {
    const uid = userId(data.token);
    const { rows } = await pool.query(
      `SELECT id, type, amount, category, description, transaction_date,
              (receipt_name IS NOT NULL) AS has_receipt
       FROM transactions WHERE user_id = $1
         AND transaction_date >= $2 AND transaction_date <= $3
       ORDER BY transaction_date ASC`,
      [uid, data.from, data.to],
    );
    return rows as Array<{
      id: string;
      type: 'income' | 'expense';
      amount: number;
      category: string;
      description: string | null;
      transaction_date: string;
      has_receipt: boolean;
    }>;
  });

export const getReceiptFn = createServerFn({ method: 'GET' })
  .inputValidator((data: { token: string; id: string }) => data)
  .handler(async ({ data }) => {
    const uid = userId(data.token);
    const { rows } = await pool.query(
      'SELECT receipt_data, receipt_name FROM transactions WHERE id=$1 AND user_id=$2',
      [data.id, uid],
    );
    return (rows[0] ?? null) as { receipt_data: string; receipt_name: string } | null;
  });

export const createTransactionFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: {
      token: string;
      type: 'income' | 'expense';
      amount: number;
      category: string;
      description: string | null;
      transaction_date: string;
      receipt_data?: string | null;
      receipt_name?: string | null;
    }) => data,
  )
  .handler(async ({ data }) => {
    const uid = requireWriter(data.token);
    await pool.query(
      `INSERT INTO transactions (user_id, type, amount, category, description, transaction_date, receipt_data, receipt_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [uid, data.type, data.amount, data.category, data.description, data.transaction_date,
       data.receipt_data ?? null, data.receipt_name ?? null],
    );
  });

export const updateTransactionFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: {
      token: string;
      id: string;
      type: 'income' | 'expense';
      amount: number;
      category: string;
      description: string | null;
      transaction_date: string;
      receipt_data?: string | null;
      receipt_name?: string | null;
      clear_receipt?: boolean;
    }) => data,
  )
  .handler(async ({ data }) => {
    const uid = requireWriter(data.token);
    if (data.receipt_data !== undefined || data.clear_receipt) {
      await pool.query(
        `UPDATE transactions
         SET type=$1, amount=$2, category=$3, description=$4, transaction_date=$5,
             receipt_data=$6, receipt_name=$7, updated_at=NOW()
         WHERE id=$8 AND user_id=$9`,
        [data.type, data.amount, data.category, data.description, data.transaction_date,
         data.clear_receipt ? null : (data.receipt_data ?? null),
         data.clear_receipt ? null : (data.receipt_name ?? null),
         data.id, uid],
      );
    } else {
      await pool.query(
        `UPDATE transactions
         SET type=$1, amount=$2, category=$3, description=$4, transaction_date=$5, updated_at=NOW()
         WHERE id=$6 AND user_id=$7`,
        [data.type, data.amount, data.category, data.description, data.transaction_date, data.id, uid],
      );
    }
  });

export const deleteTransactionFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { token: string; id: string }) => data)
  .handler(async ({ data }) => {
    const uid = requireWriter(data.token);
    await pool.query('DELETE FROM transactions WHERE id=$1 AND user_id=$2', [data.id, uid]);
  });
