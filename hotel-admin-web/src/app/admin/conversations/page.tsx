"use client";

import { useEffect, useState } from "react";
import { useTenant } from "@/lib/tenant-context";
import { listConversations } from "@/lib/apiClient";
import type { ConversationSummary } from "@/lib/types";

const statusColor: Record<string, string> = {
  active: "bg-blue-100 text-blue-700",
  closed: "bg-gray-100 text-gray-600",
  escalated: "bg-orange-100 text-orange-700",
};

export default function ConversationsPage() {
  const { current } = useTenant();
  const tid = current?.tenant_id;

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // date filter
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  async function load() {
    if (!tid) return;
    setError(null);
    setLoading(true);
    try {
      const data = await listConversations(tid, fromDate || undefined, toDate || undefined);
      setConversations(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load conversations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tid]);

  if (!current) return <div className="text-gray-400">No tenant selected</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Conversations</h1>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
          />
          <span className="text-gray-400">to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
          />
          <button
            onClick={load}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Filter
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-2">{error}</div>}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : conversations.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No conversations found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="px-5 py-2 font-medium">ID</th>
                <th className="px-5 py-2 font-medium">Channel</th>
                <th className="px-5 py-2 font-medium">Status</th>
                <th className="px-5 py-2 font-medium">Started</th>
                <th className="px-5 py-2 font-medium">Ended</th>
                <th className="px-5 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {conversations.map((conv) => (
                <tr key={conv.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 font-mono text-xs">{conv.id.slice(0, 8)}...</td>
                  <td className="px-5 py-3">{conv.channel}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColor[conv.status] || "bg-gray-100"}`}>
                      {conv.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{new Date(conv.started_at).toLocaleString()}</td>
                  <td className="px-5 py-3 text-gray-500">{conv.ended_at ? new Date(conv.ended_at).toLocaleString() : "—"}</td>
                  <td className="px-5 py-3">
                    <a
                      href={`/admin/conversations/${conv.id}`}
                      className="text-xs text-gray-600 hover:text-gray-900 underline"
                    >
                      View
                    </a>
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
