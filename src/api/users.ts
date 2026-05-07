import { createServerFn } from "@tanstack/react-start";
import pool from "@/lib/db";
import { verifyToken, hashPassword } from "@/lib/auth-server";

function requireSuperAdmin(token: string) {
  const payload = verifyToken(token);
  if (payload.role !== "super_admin") throw new Error("Unauthorized");
  return payload;
}

const VALID_ROLES = ["super_admin", "admin", "reviewer"];

export const listUsersFn = createServerFn({ method: "GET" })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    requireSuperAdmin(data.token);
    const { rows } = await pool.query(
      "SELECT id, email, role, active, created_at FROM users ORDER BY created_at ASC",
    );
    return rows as { id: string; email: string; role: string; active: boolean; created_at: string }[];
  });

export const updateUserRoleFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; userId: string; role: string }) => data)
  .handler(async ({ data }) => {
    const caller = requireSuperAdmin(data.token);
    if (!VALID_ROLES.includes(data.role)) throw new Error("Invalid role");
    if (caller.sub === data.userId && data.role !== "super_admin")
      throw new Error("Cannot demote your own super_admin account");
    await pool.query("UPDATE users SET role = $1 WHERE id = $2", [data.role, data.userId]);
  });

export const toggleUserActiveFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; userId: string; active: boolean }) => data)
  .handler(async ({ data }) => {
    const caller = requireSuperAdmin(data.token);
    if (caller.sub === data.userId) throw new Error("Cannot deactivate your own account");
    await pool.query("UPDATE users SET active = $1 WHERE id = $2", [data.active, data.userId]);
  });

export const resetUserPasswordFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; userId: string; newPassword: string }) => data)
  .handler(async ({ data }) => {
    requireSuperAdmin(data.token);
    if (data.newPassword.length < 8) throw new Error("Password must be at least 8 characters");
    const hash = await hashPassword(data.newPassword);
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, data.userId]);
  });

export const deleteUserFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; userId: string }) => data)
  .handler(async ({ data }) => {
    const caller = requireSuperAdmin(data.token);
    if (caller.sub === data.userId) throw new Error("Cannot delete your own account");
    await pool.query("DELETE FROM users WHERE id = $1", [data.userId]);
  });
