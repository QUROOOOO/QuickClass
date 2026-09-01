"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createAuthAdapter, type AuthAdapter, type User } from "@/lib/auth/adapter";

interface AuthContextValue {
  user: User | null;
  adapter: AuthAdapter;
}

const adapter: AuthAdapter = createAuthAdapter();

const AuthContext = createContext<AuthContextValue>({ user: null, adapter });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => adapter.onStateChange(setUser), []);

  return <AuthContext.Provider value={{ user, adapter }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}