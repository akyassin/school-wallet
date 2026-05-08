import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { getPendingCountFn } from "@/api/users";

export const PENDING_COUNT_REFRESH_EVENT = "pending-count-refresh";

export function usePendingCount() {
  const { user, token } = useAuth();
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async (t: string) => {
    try {
      const result = await getPendingCountFn({ data: { token: t } });
      setCount(result.count);
    } catch {
      // silently ignore errors (e.g. token expired)
    }
  }, []);

  useEffect(() => {
    if (user?.role !== "super_admin" || !token) return;

    fetchCount(token);
    const id = setInterval(() => fetchCount(token), 60_000);

    const onRefresh = () => fetchCount(token);
    window.addEventListener(PENDING_COUNT_REFRESH_EVENT, onRefresh);

    return () => {
      clearInterval(id);
      window.removeEventListener(PENDING_COUNT_REFRESH_EVENT, onRefresh);
    };
  }, [user?.role, token, fetchCount]);

  return count;
}
