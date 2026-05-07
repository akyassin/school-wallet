import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { listCategoriesFn } from "@/api/categories";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, type TxType } from "@/lib/categories";

export interface UserCategory {
  id: string;
  name: string;
  type: TxType;
}

export function useCategories() {
  const { user, token } = useAuth();
  const [custom, setCustom] = useState<UserCategory[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const t = token ?? (typeof window !== "undefined" ? localStorage.getItem("auth_token") : null);
    if (!user || !t) return;
    setLoading(true);
    try {
      const data = await listCategoriesFn({ data: { token: t } });
      setCustom(data as UserCategory[]);
    } catch {
      // silently ignore — defaults are still shown
    } finally {
      setLoading(false);
    }
  }, [user, token]);

  useEffect(() => { load(); }, [load]);

  const merged = (type: TxType): string[] => {
    const defaults = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const userOnes = custom.filter((c) => c.type === type).map((c) => c.name);
    return Array.from(new Set([...defaults, ...userOnes])).sort((a, b) => a.localeCompare(b));
  };

  return { custom, loading, reload: load, merged };
}
