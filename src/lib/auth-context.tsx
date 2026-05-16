import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { refreshAccessTokenFn } from "@/api/auth";
import { isTokenExpired, getTokenRemainingMs } from "@/lib/token-utils";

export interface AppUser {
  id: string;
  email: string;
  role: string;
  must_change_password?: boolean;
}

interface AuthCtx {
  user: AppUser | null;
  token: string | null;
  loading: boolean;
  signIn: (token: string, user: AppUser, refreshToken?: string) => void;
  signOut: () => void;
  updateUser: (patch: Partial<AppUser>) => void;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  token: null,
  loading: true,
  signIn: () => {},
  signOut: () => {},
  updateUser: () => {},
});

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";
const REFRESH_KEY = "auth_refresh_token";

const THIRTY_MIN_MS = 30 * 60 * 1000;
const ACTIVITY_DEBOUNCE_MS = 60_000;

function redirectToLogin() {
  const from = window.location.pathname + window.location.search;
  const skip = from === "/" || from.startsWith("/login");
  window.location.replace(skip ? "/login" : `/login?from=${encodeURIComponent(from)}`);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const lastCheckAt = useRef<number>(0);

  const clearAuth = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(REFRESH_KEY);
    setToken(null);
    setUser(null);
  }, []);

  // On mount: restore session or refresh expired token
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const savedToken = localStorage.getItem(TOKEN_KEY);
      const savedUser = localStorage.getItem(USER_KEY);
      const savedRefresh = localStorage.getItem(REFRESH_KEY);

      if (!savedToken || !savedUser) {
        if (!cancelled) setLoading(false);
        return;
      }

      let parsedUser: AppUser;
      try {
        parsedUser = JSON.parse(savedUser);
      } catch {
        if (!cancelled) { clearAuth(); setLoading(false); }
        return;
      }

      if (!isTokenExpired(savedToken)) {
        if (!cancelled) { setToken(savedToken); setUser(parsedUser); }
      } else if (savedRefresh) {
        try {
          const result = await refreshAccessTokenFn({ data: { refreshToken: savedRefresh } });
          if (!cancelled) {
            localStorage.setItem(TOKEN_KEY, result.token);
            localStorage.setItem(REFRESH_KEY, result.refreshToken);
            setToken(result.token);
            setUser(parsedUser);
          }
        } catch {
          if (!cancelled) { clearAuth(); redirectToLogin(); }
        }
      } else {
        if (!cancelled) { clearAuth(); redirectToLogin(); }
      }

      if (!cancelled) setLoading(false);
    };

    init();
    return () => { cancelled = true; };
  }, [clearAuth]);

  // Proactive refresh on user activity: if <30 min remaining, refresh silently
  useEffect(() => {
    const handleActivity = async () => {
      const now = Date.now();
      if (now - lastCheckAt.current < ACTIVITY_DEBOUNCE_MS) return;
      lastCheckAt.current = now;

      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedRefresh = localStorage.getItem(REFRESH_KEY);
      if (!storedToken || !storedRefresh) return;

      const remaining = getTokenRemainingMs(storedToken);

      if (remaining === 0) {
        // Expired while user was on the page — try emergency refresh
        try {
          const result = await refreshAccessTokenFn({ data: { refreshToken: storedRefresh } });
          localStorage.setItem(TOKEN_KEY, result.token);
          localStorage.setItem(REFRESH_KEY, result.refreshToken);
          setToken(result.token);
        } catch {
          clearAuth();
          redirectToLogin();
        }
        return;
      }

      if (remaining < THIRTY_MIN_MS) {
        // Proactively refresh before it expires
        try {
          const result = await refreshAccessTokenFn({ data: { refreshToken: storedRefresh } });
          localStorage.setItem(TOKEN_KEY, result.token);
          localStorage.setItem(REFRESH_KEY, result.refreshToken);
          setToken(result.token);
        } catch {
          // Will retry on next activity; token still valid for now
        }
      }
    };

    const events = ["click", "keydown", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, handleActivity));
  }, [clearAuth]);

  const signIn = (newToken: string, newUser: AppUser, newRefreshToken?: string) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    if (newRefreshToken) localStorage.setItem(REFRESH_KEY, newRefreshToken);
    setToken(newToken);
    setUser(newUser);
  };

  const signOut = () => {
    clearAuth();
  };

  const updateUser = (patch: Partial<AppUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...patch };
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <Ctx.Provider value={{ user, token, loading, signIn, signOut, updateUser }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
