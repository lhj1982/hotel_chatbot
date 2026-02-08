"use client";

import { useEffect, useState } from "react";
import { useTenant } from "@/lib/tenant-context";
import { getStatsOverview, getUnanswered } from "@/lib/apiClient";
import type { StatsOverview, UnansweredTurn } from "@/lib/types";

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}

export default function StatsPage() {
  const { current } = useTenant();
  const tid = current?.tenant_id;

  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [unanswered, setUnanswered] = useState<UnansweredTurn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // date range
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  async function load() {
    if (!tid) return;
    setError(null);
    setLoading(true);
    try {
      const [o, u] = await Promise.all([
        getStatsOverview(tid, fromDate || undefined, toDate || undefined),
        getUnanswered(tid),
      ]);
      setOverview(o);
      setUnanswered(u);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load stats");
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
        <h1 className="text-2xl font-semibold">Analytics</h1>
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
            Apply
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-2">{error}</div>}

      {loading ? (
        <div className="text-gray-400 text-center py-12">Loading stats...</div>
      ) : (
        <>
          {/* Overview cards */}
          {overview && (
            <div className="grid grid-cols-4 gap-4">
              <MetricCard label="Total Conversations" value={overview.total_conversations} />
              <MetricCard label="Total Messages" value={overview.total_messages} />
              <MetricCard label="Fallbacks" value={overview.fallback_count} />
              <MetricCard label="Escalations" value={overview.escalations} />
            </div>
          )}

          {/* Unanswered turns */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-200">
              <h2 className="text-sm font-medium">Unanswered Questions</h2>
            </div>
            {unanswered.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No unanswered questions</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-gray-500">
                    <th className="px-5 py-2 font-medium">Question</th>
                    <th className="px-5 py-2 font-medium">Confidence</th>
                    <th className="px-5 py-2 font-medium">Date</th>
                    <th className="px-5 py-2 font-medium">Conversation</th>
                  </tr>
                </thead>
                <tbody>
                  {unanswered.map((turn) => (
                    <tr key={turn.turn_id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-3">{turn.user_message || "—"}</td>
                      <td className="px-5 py-3 text-gray-500">
                        {turn.confidence != null ? `${(turn.confidence * 100).toFixed(0)}%` : "—"}
                      </td>
                      <td className="px-5 py-3 text-gray-500">{new Date(turn.created_at).toLocaleDateString()}</td>
                      <td className="px-5 py-3">
                        <a
                          href={`/admin/conversations/${turn.conversation_id}`}
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
        </>
      )}
    </div>
  );
}
