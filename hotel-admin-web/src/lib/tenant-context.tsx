"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { TenantRole } from "./types";

interface TenantContextValue {
  tenants: TenantRole[];
  current: TenantRole | null;
  setCurrent: (t: TenantRole) => void;
  canEdit: boolean;
}

const TenantContext = createContext<TenantContextValue>({
  tenants: [],
  current: null,
  setCurrent: () => {},
  canEdit: false,
});

export function TenantProvider({ tenants, children }: { tenants: TenantRole[]; children: ReactNode }) {
  const [current, setCurrentState] = useState<TenantRole | null>(null);

  useEffect(() => {
    // Read saved tenant from cookie
    const saved = document.cookie
      .split("; ")
      .find((c) => c.startsWith("selected_tenant="))
      ?.split("=")[1];

    const found = tenants.find((t) => t.tenant_id === saved);
    setCurrentState(found || tenants[0] || null);
  }, [tenants]);

  function setCurrent(t: TenantRole) {
    setCurrentState(t);
    document.cookie = `selected_tenant=${t.tenant_id};path=/;max-age=${60 * 60 * 24 * 30}`;
  }

  const canEdit = current?.role === "owner" || current?.role === "editor";

  return (
    <TenantContext.Provider value={{ tenants, current, setCurrent, canEdit }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
