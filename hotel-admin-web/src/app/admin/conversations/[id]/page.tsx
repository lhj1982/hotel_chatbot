"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTenant } from "@/lib/tenant-context";
import { getConversation } from "@/lib/apiClient";
import type { ConversationDetail } from "@/lib/types";

const statusColor: Record<string, string> = {
  active: "bg-blue-100 text-blue-700",
  closed: "bg-gray-100 text-gray-600",
  escalated: "bg-orange-100 text-orange-700",
};

const outcomeColor: Record<string, string> = {
  answered: "bg-green-100 text-green-700",
  fallback: "bg-yellow-100 text-yellow-700",
  escalate: "bg-red-100 text-red-700",
};

export default function ConversationDetailPage() {
  const params = useParams();
  const cid = params.id as string;
  const { current } = useTenant();
  const tid = current?.tenant_id;

  const [conv, setConv] = useState<ConversationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tid || !cid) return;
    setError(null);
    getConversation(tid, cid)
      .then(setConv)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load conversation"))
      .finally(() => setLoading(false));
  }, [tid, cid]);

  if (!current) return <div className="text-gray-400">No tenant selected</div>;
  if (loading) return <div className="text-gray-400 py-12 text-center">Loading...</div>;
  if (error) return <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-2">{error}</div>;
  if (!conv) return <div className="text-gray-400">Conversation not found</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <a href="/admin/conversations" className="text-sm text-gray-500 hover:text-gray-900">
          &larr; Back
        </a>
        <h1 className="text-2xl font-semibold">Conversation</h1>
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColor[conv.status] || "bg-gray-100"}`}>
          {conv.status}
        </span>
      </div>

      {/* Meta */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <dl className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">ID</dt>
            <dd className="font-mono text-xs mt-0.5">{conv.id}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Channel</dt>
            <dd className="mt-0.5">{conv.channel}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Started</dt>
            <dd className="mt-0.5">{new Date(conv.started_at).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Ended</dt>
            <dd className="mt-0.5">{conv.ended_at ? new Date(conv.ended_at).toLocaleString() : "Ongoing"}</dd>
          </div>
        </dl>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Transcript */}
        <div className="col-span-2 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200">
            <h2 className="text-sm font-medium">Transcript</h2>
          </div>
          <div className="p-5 space-y-3 max-h-[600px] overflow-y-auto">
            {conv.messages.length === 0 ? (
              <div className="text-gray-400 text-center py-8">No messages</div>
            ) : (
              conv.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm ${
                      msg.role === "user"
                        ? "bg-gray-900 text-white"
                        : msg.role === "system"
                        ? "bg-yellow-50 text-yellow-800 border border-yellow-200"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium opacity-70 capitalize">{msg.role}</span>
                      <span className="text-xs opacity-50">{new Date(msg.created_at).toLocaleTimeString()}</span>
                    </div>
                    <p className="whitespace-pre-wrap">{msg.content || "—"}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Turns sidebar */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200">
            <h2 className="text-sm font-medium">Turns</h2>
          </div>
          <div className="p-3 space-y-2 max-h-[600px] overflow-y-auto">
            {conv.turns.length === 0 ? (
              <div className="text-gray-400 text-center py-8 text-sm">No turns</div>
            ) : (
              conv.turns.map((turn) => (
                <div key={turn.id} className="border border-gray-100 rounded-md p-3 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${outcomeColor[turn.outcome] || "bg-gray-100"}`}>
                      {turn.outcome}
                    </span>
                    <span className="text-xs text-gray-400">{new Date(turn.created_at).toLocaleTimeString()}</span>
                  </div>
                  {turn.confidence != null && (
                    <p className="text-xs text-gray-500">Confidence: {(turn.confidence * 100).toFixed(0)}%</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
