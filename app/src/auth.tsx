import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, SignupBody, tokenStore, User } from './api';

type AuthState = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (b: SignupBody) => Promise<void>;
  /** Signs in (or creates the account) with a Google ID token. Resolves true when the account is brand new. */
  googleSignIn: (idToken: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  setUser: (u: User) => void;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const t = await tokenStore.load();
        if (t) setUser((await api.me()).user);
      } catch {
        // expired token or offline: treat as signed out, token is cleared only if the server rejected it
        await tokenStore.set(null).catch(() => {});
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const r = await api.login({ email, password });
    await tokenStore.set(r.token);
    setUser(r.user);
  }, []);

  const signUp = useCallback(async (b: SignupBody) => {
    const r = await api.signup(b);
    await tokenStore.set(r.token);
    setUser(r.user);
  }, []);

  const googleSignIn = useCallback(async (idToken: string) => {
    const r = await api.google(idToken);
    await tokenStore.set(r.token);
    setUser(r.user);
    return r.isNew;
  }, []);

  const signOut = useCallback(async () => {
    await tokenStore.set(null);
    setUser(null);
  }, []);

  return <Ctx.Provider value={{ user, loading, signIn, signUp, googleSignIn, signOut, setUser }}>{children}</Ctx.Provider>;
}

export const useAuth = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
};
