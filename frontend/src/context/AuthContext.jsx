import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api, { tokenStore } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    async function boot() {
      if (!tokenStore.access) {
        if (active) setReady(true);
        return;
      }
      try {
        const { data } = await api.get("/auth/me/");
        if (active) setUser(data);
      } catch {
        tokenStore.clear();
        if (active) setUser(null);
      } finally {
        if (active) setReady(true);
      }
    }
    boot();
    return () => {
      active = false;
    };
  }, []);

  async function login(email, password) {
    tokenStore.clear();
    const { data } = await api.post("/auth/token/", { email, password });
    tokenStore.set(data.access, data.refresh);
    setUser(data.user);
    return data.user;
  }

  async function requestCode(payload) {
    const { data } = await api.post("/auth/phone/request/", payload);
    return data;
  }

  async function verifyCode(payload) {
    tokenStore.clear();
    const { data } = await api.post("/auth/phone/verify/", payload);
    tokenStore.set(data.access, data.refresh);
    setUser(data.user);
    return data;
  }

  function logout() {
    tokenStore.clear();
    setUser(null);
  }

  const value = useMemo(() => ({ user, ready, login, requestCode, verifyCode, logout }), [user, ready]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth duhet brenda AuthProvider.");
  }
  return context;
}
