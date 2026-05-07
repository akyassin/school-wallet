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

export const listCategoriesFn = createServerFn({ method: 'GET' })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    const uid = userId(data.token);
    const { rows } = await pool.query(
      'SELECT id, name, type FROM categories WHERE user_id=$1 ORDER BY name',
      [uid],
    );
    return rows as Array<{ id: string; name: string; type: 'income' | 'expense' }>;
  });

export const createCategoryFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { token: string; name: string; type: 'income' | 'expense' }) => data)
  .handler(async ({ data }) => {
    const uid = requireWriter(data.token);
    await pool.query(
      'INSERT INTO categories (user_id, name, type) VALUES ($1, $2, $3)',
      [uid, data.name, data.type],
    );
  });

export const deleteCategoryFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { token: string; id: string }) => data)
  .handler(async ({ data }) => {
    const uid = requireWriter(data.token);
    await pool.query('DELETE FROM categories WHERE id=$1 AND user_id=$2', [data.id, uid]);
  });
