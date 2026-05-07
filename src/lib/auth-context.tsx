import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface AppUser {
  id: string;
  email: string;
  role: string;
}

interface AuthCtx {
  user: AppUser | null;
  token: string | null;
  loading: boolean;
  signIn: (token: string, user: AppUser) => void;
  signOut: () => void;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  token: null,
  loading: true,
  signIn: () => {},
  signOut: () => {},
});

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }
    setLoading(false);
  }, []);

  const signIn = (newToken: string, newUser: AppUser) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const signOut = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  };

  return <Ctx.Provider value={{ user, token, loading, signIn, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
