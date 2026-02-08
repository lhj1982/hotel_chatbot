"use client";

import { useTenant } from "@/lib/tenant-context";

export default function AdminHome() {
  const { current, canEdit } = useTenant();

  if (!current) return <div className="text-gray-400">No tenant selected</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-medium mb-4">Welcome</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Tenant</dt>
            <dd className="font-medium">{current.name}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Your role</dt>
            <dd className="font-medium capitalize">{current.role}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Permissions</dt>
            <dd className="font-medium">{canEdit ? "Read & Write" : "Read only"}</dd>
          </div>
        </dl>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <a href="/admin/kb" className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-400 transition-colors">
          <h3 className="font-medium">Knowledge Base</h3>
          <p className="text-sm text-gray-500 mt-1">Upload documents and manage FAQ content</p>
        </a>
        <a href="/admin/settings" className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-400 transition-colors">
          <h3 className="font-medium">Settings</h3>
          <p className="text-sm text-gray-500 mt-1">Configure greeting, escalation, widget keys</p>
        </a>
        <a href="/admin/stats" className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-400 transition-colors">
          <h3 className="font-medium">Analytics</h3>
          <p className="text-sm text-gray-500 mt-1">View chat stats and unanswered questions</p>
        </a>
        <a href="/admin/conversations" className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-400 transition-colors">
          <h3 className="font-medium">Conversations</h3>
          <p className="text-sm text-gray-500 mt-1">Browse chat transcripts and outcomes</p>
        </a>
      </div>
    </div>
  );
}
