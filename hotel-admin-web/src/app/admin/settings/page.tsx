"use client";

import { useEffect, useState } from "react";
import { useTenant } from "@/lib/tenant-context";
import {
  getTenantSettings,
  updateTenantSettings,
  listWidgetKeys,
  createWidgetKey,
  disableWidgetKey,
} from "@/lib/apiClient";
import type { TenantSettings, WidgetKey } from "@/lib/types";

export default function SettingsPage() {
  const { current, canEdit } = useTenant();
  const tid = current?.tenant_id;

  // settings form
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // widget keys
  const [keys, setKeys] = useState<WidgetKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!tid) return;
    setError(null);
    getTenantSettings(tid).then(setSettings).catch((e) => setError(e.message));
    listWidgetKeys(tid)
      .then(setKeys)
      .catch(() => setKeys([]))
      .finally(() => setKeysLoading(false));
  }, [tid]);

  async function handleSave() {
    if (!tid || !settings) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await updateTenantSettings(tid, settings);
      setSuccess("Settings saved");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateKey() {
    if (!tid) return;
    setError(null);
    try {
      const key = await createWidgetKey(tid);
      setKeys((prev) => [key, ...prev]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create key");
    }
  }

  async function handleDisableKey(id: string) {
    setError(null);
    try {
      await disableWidgetKey(id);
      setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, status: "disabled" } : k)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to disable key");
    }
  }

  function copySnippet(key: string) {
    const snippet = `<script src="https://your-cdn.com/widget.js" data-key="${key}"></script>`;
    navigator.clipboard.writeText(snippet);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  function updateField<K extends keyof TenantSettings>(field: K, value: TenantSettings[K]) {
    setSettings((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  if (!current) return <div className="text-gray-400">No tenant selected</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-2">{error}</div>}
      {success && <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-4 py-2">{success}</div>}

      {/* Tenant Settings Form */}
      {settings ? (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-medium">Tenant Configuration</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Greeting Message</label>
            <input
              value={settings.greeting_message || ""}
              onChange={(e) => updateField("greeting_message", e.target.value)}
              disabled={!canEdit}
              placeholder="Welcome! How can I help you?"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Escalation Phone</label>
              <input
                value={settings.escalation_phone || ""}
                onChange={(e) => updateField("escalation_phone", e.target.value)}
                disabled={!canEdit}
                placeholder="+1 555-0100"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Escalation Email</label>
              <input
                value={settings.escalation_email || ""}
                onChange={(e) => updateField("escalation_email", e.target.value)}
                disabled={!canEdit}
                placeholder="support@hotel.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Retention Days</label>
              <input
                type="number"
                value={settings.retention_days ?? 30}
                onChange={(e) => updateField("retention_days", Number(e.target.value))}
                disabled={!canEdit}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Allowed Domains</label>
              <input
                value={(settings.allowed_domains || []).join(", ")}
                onChange={(e) =>
                  updateField(
                    "allowed_domains",
                    e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                  )
                }
                disabled={!canEdit}
                placeholder="example.com, hotel.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>
          </div>

          {canEdit && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-400">Loading settings...</div>
      )}

      {/* Widget Keys */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-medium">Widget Keys</h2>
          {canEdit && (
            <button
              onClick={handleCreateKey}
              className="text-sm px-3 py-1.5 bg-gray-900 text-white rounded-md hover:bg-gray-800"
            >
              Create Key
            </button>
          )}
        </div>
        {keysLoading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : keys.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No widget keys yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="px-5 py-2 font-medium">Key</th>
                <th className="px-5 py-2 font-medium">Status</th>
                <th className="px-5 py-2 font-medium">Created</th>
                <th className="px-5 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((wk) => (
                <tr key={wk.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 font-mono text-xs">{wk.key}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        wk.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {wk.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{wk.created_at ? new Date(wk.created_at).toLocaleDateString() : "—"}</td>
                  <td className="px-5 py-3 space-x-3">
                    <button onClick={() => copySnippet(wk.key)} className="text-xs text-gray-600 hover:text-gray-900 underline">
                      {copied === wk.key ? "Copied!" : "Copy Snippet"}
                    </button>
                    {canEdit && wk.status === "active" && (
                      <button onClick={() => handleDisableKey(wk.id)} className="text-xs text-red-600 hover:text-red-800 underline">
                        Disable
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
