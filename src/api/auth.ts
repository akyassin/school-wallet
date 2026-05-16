import { createServerFn } from "@tanstack/react-start";
import pool from "@/lib/db";
import {
  signToken,
  signRefreshToken,
  hashPassword,
  comparePassword,
  verifyToken,
  verifyRefreshToken,
} from "@/lib/auth-server";

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; password: string }) => data)
  .handler(async ({ data }) => {
    const { rows } = await pool.query(
      "SELECT id, email, password_hash, role, active, approved, must_change_password FROM users WHERE email = $1",
      [data.email.toLowerCase()],
    );
    const user = rows[0];
    if (!user || !(await comparePassword(data.password, user.password_hash))) {
      throw new Error("Invalid email or password");
    }
    if (!user.approved)
      throw new Error(
        "Your account is pending approval. An administrator will review your registration.",
      );
    if (!user.active)
      throw new Error("Your account has been deactivated. Contact an administrator.");

    const payload = { sub: user.id, email: user.email, role: user.role };
    const token = signToken(payload);
    const refreshToken = signRefreshToken(payload);

    return {
      token,
      refreshToken,
      user: {
        id: user.id as string,
        email: user.email as string,
        role: user.role as string,
        must_change_password: user.must_change_password as boolean,
      },
    };
  });

export const refreshAccessTokenFn = createServerFn({ method: "POST" })
  .inputValidator((data: { refreshToken: string }) => data)
  .handler(async ({ data }) => {
    const payload = verifyRefreshToken(data.refreshToken);
    const { rows } = await pool.query(
      "SELECT id, email, role, active, approved FROM users WHERE id = $1",
      [payload.sub],
    );
    const user = rows[0];
    if (!user || !user.active || !user.approved) throw new Error("Access denied");

    const newPayload = { sub: user.id, email: user.email, role: user.role };
    return {
      token: signToken(newPayload),
      refreshToken: signRefreshToken(newPayload),
    };
  });

export const signUpFn = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; password: string }) => data)
  .handler(async ({ data }) => {
    const { rows: existing } = await pool.query("SELECT id FROM users WHERE email = $1", [
      data.email.toLowerCase(),
    ]);
    if (existing.length > 0) throw new Error("An account with this email already exists");
    const hash = await hashPassword(data.password);
    await pool.query("INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)", [
      data.email.toLowerCase(),
      hash,
      "reviewer",
    ]);
    return { pending: true };
  });

export const requestPasswordResetFn = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string }) => data)
  .handler(async ({ data }) => {
    await pool.query(
      "UPDATE users SET reset_requested = true WHERE email = $1 AND approved = true AND active = true",
      [data.email.toLowerCase()],
    );
    return { ok: true };
  });

export const changePasswordFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; newPassword: string }) => data)
  .handler(async ({ data }) => {
    const payload = verifyToken(data.token);
    if (data.newPassword.length < 8) throw new Error("Password must be at least 8 characters");
    const hash = await hashPassword(data.newPassword);
    await pool.query(
      "UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2",
      [hash, payload.sub],
    );
  });
