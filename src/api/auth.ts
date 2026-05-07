import { createServerFn } from '@tanstack/react-start';
import pool from '@/lib/db';
import { signToken, hashPassword, comparePassword } from '@/lib/auth-server';

export const loginFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { email: string; password: string }) => data)
  .handler(async ({ data }) => {
    const { rows } = await pool.query(
      'SELECT id, email, password_hash, role, active FROM users WHERE email = $1',
      [data.email.toLowerCase()],
    );
    const user = rows[0];
    if (!user || !(await comparePassword(data.password, user.password_hash))) {
      throw new Error('Invalid email or password');
    }
    if (!user.active) throw new Error('Your account has been deactivated. Contact an administrator.');
    const token = signToken({ sub: user.id, email: user.email, role: user.role });
    return { token, user: { id: user.id as string, email: user.email as string, role: user.role as string } };
  });

export const signUpFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { email: string; password: string }) => data)
  .handler(async ({ data }) => {
    const { rows: existing } = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [data.email.toLowerCase()],
    );
    if (existing.length > 0) throw new Error('An account with this email already exists');
    const hash = await hashPassword(data.password);
    const { rows } = await pool.query(
      'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role',
      [data.email.toLowerCase(), hash, 'reviewer'],
    );
    const user = rows[0];
    const token = signToken({ sub: user.id, email: user.email, role: user.role });
    return { token, user: { id: user.id as string, email: user.email as string, role: user.role as string } };
  });
