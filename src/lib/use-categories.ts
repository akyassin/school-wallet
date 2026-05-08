import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { listCategoriesFn } from "@/api/categories";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, type TxType } from "@/lib/categories";

export interface UserCategory {
  id: string;
  name: string;
  type: TxType;
  is_default: boolean;
}

export function useCategories() {
  const { user, token } = useAuth();
  const [categories, setCategories] = useState<UserCategory[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const t = token ?? (typeof window !== "undefined" ? localStorage.getItem("auth_token") : null);
    if (!user || !t) return;
    setLoading(true);
    try {
      const data = await listCategoriesFn({ data: { token: t } });
      setCategories(data as UserCategory[]);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [user, token]);

  useEffect(() => {
    load();
  }, [load]);

  const defaults = categories.filter((c) => c.is_default);
  const custom = categories.filter((c) => !c.is_default);

  const merged = (type: TxType): string[] => {
    const fromDb = categories.filter((c) => c.type === type).map((c) => c.name);
    // Fall back to hardcoded list if the DB migration hasn't been run yet
    const hasDbDefaults = defaults.some((c) => c.type === type);
    const fallback = hasDbDefaults
      ? []
      : type === "income"
        ? INCOME_CATEGORIES
        : EXPENSE_CATEGORIES;
    return Array.from(new Set([...fromDb, ...fallback])).sort((a, b) => a.localeCompare(b));
  };

  return { categories, defaults, custom, loading, reload: load, merged };
}
