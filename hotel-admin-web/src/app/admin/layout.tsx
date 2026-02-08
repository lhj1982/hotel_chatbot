"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { TenantProvider, useTenant } from "@/lib/tenant-context";
import { getMe } from "@/lib/apiClient";
import type { CurrentUser } from "@/lib/types";

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const path = usePathname();
  const active = path === href;
  return (
    <Link
      href={href}
      className={`block px-3 py-2 rounded-md text-sm transition-colors ${
        active ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      {children}
    </Link>
  );
}

function TenantSwitcher() {
  const { tenants, current, setCurrent } = useTenant();
  if (tenants.length <= 1) return null;
  return (
    <select
      value={current?.tenant_id || ""}
      onChange={(e) => {
        const t = tenants.find((t) => t.tenant_id === e.target.value);
        if (t) {
          setCurrent(t);
          window.location.reload();
        }
      }}
      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
    >
      {tenants.map((t) => (
        <option key={t.tenant_id} value={t.tenant_id}>
          {t.name} ({t.role})
        </option>
      ))}
    </select>
  );
}

function Header({ user }: { user: CurrentUser }) {
  const router = useRouter();
  const { current } = useTenant();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6">
      <div className="text-sm text-gray-500">
        {current && (
          <>
            {current.name}
            <span className="ml-2 text-xs bg-gray-100 px-2 py-0.5 rounded">{current.role}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">{user.email}</span>
        <button onClick={logout} className="text-sm px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50">
          Logout
        </button>
      </div>
    </header>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => {
        setError("Session expired");
        router.push("/login");
      });
  }, [router]);

  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!user) return <div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>;

  return (
    <TenantProvider tenants={user.tenants}>
      <div className="flex min-h-screen">
        <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
          <div className="p-4 border-b border-gray-200">
            <h1 className="text-lg font-semibold">Hotel Admin</h1>
          </div>
          <nav className="flex-1 p-3 space-y-1">
            <NavLink href="/admin">Dashboard</NavLink>
            <NavLink href="/admin/kb">Knowledge Base</NavLink>
            <NavLink href="/admin/settings">Settings</NavLink>
            <NavLink href="/admin/stats">Analytics</NavLink>
            <NavLink href="/admin/conversations">Conversations</NavLink>
          </nav>
          <div className="p-3 border-t border-gray-200">
            <TenantSwitcher />
          </div>
        </aside>
        <div className="flex-1 flex flex-col min-w-0">
          <Header user={user} />
          <main className="flex-1 p-6 overflow-y-auto">{children}</main>
        </div>
      </div>
    </TenantProvider>
  );
}
