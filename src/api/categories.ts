import { createServerFn } from "@tanstack/react-start";
import pool from "@/lib/db";
import { verifyToken } from "@/lib/auth-server";

function userId(token: string): string {
  return verifyToken(token).sub;
}

export const listCategoriesFn = createServerFn({ method: "GET" })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    const uid = userId(data.token);
    const { rows } = await pool.query(
      `SELECT id, name, type, (user_id IS NULL) AS is_default
       FROM categories
       WHERE user_id = $1 OR user_id IS NULL
       ORDER BY is_default DESC, type, name`,
      [uid],
    );
    return rows as Array<{
      id: string;
      name: string;
      type: "income" | "expense";
      is_default: boolean;
    }>;
  });

export const createCategoryFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { token: string; name: string; type: "income" | "expense"; is_default?: boolean }) =>
      data,
  )
  .handler(async ({ data }) => {
    const payload = verifyToken(data.token);
    if (data.is_default) {
      if (payload.role !== "super_admin")
        throw new Error("Only super admin can create system defaults");
      await pool.query("INSERT INTO categories (user_id, name, type) VALUES (NULL, $1, $2)", [
        data.name,
        data.type,
      ]);
    } else {
      if (payload.role !== "super_admin" && payload.role !== "admin") {
        throw new Error("You do not have permission to perform this action");
      }
      await pool.query("INSERT INTO categories (user_id, name, type) VALUES ($1, $2, $3)", [
        payload.sub,
        data.name,
        data.type,
      ]);
    }
  });

export const updateCategoryFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; id: string; name: string }) => data)
  .handler(async ({ data }) => {
    const payload = verifyToken(data.token);
    if (payload.role !== "super_admin" && payload.role !== "admin") {
      throw new Error("You do not have permission to perform this action");
    }
    const { rowCount } = await pool.query(
      `UPDATE categories SET name = $1
       WHERE id = $2 AND (user_id = $3 OR (user_id IS NULL AND $4 = 'super_admin'))`,
      [data.name, data.id, payload.sub, payload.role],
    );
    if (!rowCount) throw new Error("Category not found or permission denied");
  });

export const deleteCategoryFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; id: string }) => data)
  .handler(async ({ data }) => {
    const payload = verifyToken(data.token);
    if (payload.role !== "super_admin" && payload.role !== "admin") {
      throw new Error("You do not have permission to perform this action");
    }
    await pool.query(
      `DELETE FROM categories
       WHERE id = $1 AND (user_id = $2 OR (user_id IS NULL AND $3 = 'super_admin'))`,
      [data.id, payload.sub, payload.role],
    );
  });
