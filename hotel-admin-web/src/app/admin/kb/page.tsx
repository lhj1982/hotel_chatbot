"use client";

import { useEffect, useState, useRef } from "react";
import { useTenant } from "@/lib/tenant-context";
import { listDocuments, uploadFile, addText, reindexAll, reindexDoc } from "@/lib/apiClient";
import type { KBDocument } from "@/lib/types";

const statusColor: Record<string, string> = {
  ready: "bg-green-100 text-green-700",
  processing: "bg-yellow-100 text-yellow-700",
  failed: "bg-red-100 text-red-700",
};

export default function KBPage() {
  const { current, canEdit } = useTenant();
  const [docs, setDocs] = useState<KBDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // text snippet form
  const [title, setTitle] = useState("FAQ");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  // file upload
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // reindex
  const [reindexing, setReindexing] = useState(false);

  const tid = current?.tenant_id;

  async function refresh() {
    if (!tid) return;
    setError(null);
    try {
      const d = await listDocuments(tid);
      setDocs(d);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tid]);

  async function handleAddText() {
    if (!tid || !text.trim()) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await addText(tid, title, text);
      setText("");
      setSuccess("Text snippet added");
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add text");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !tid) return;
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      await uploadFile(tid, file);
      setSuccess(`"${file.name}" uploaded`);
      if (fileRef.current) fileRef.current.value = "";
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleReindexAll() {
    if (!tid) return;
    setReindexing(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await reindexAll(tid);
      setSuccess(`Reindex started for ${result.document_count} documents`);
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Reindex failed");
    } finally {
      setReindexing(false);
    }
  }

  async function handleReindexDoc(docId: string) {
    if (!tid) return;
    setError(null);
    setSuccess(null);
    try {
      await reindexDoc(tid, docId);
      setSuccess("Document reindex started");
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Reindex failed");
    }
  }

  if (!current) return <div className="text-gray-400">No tenant selected</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Knowledge Base</h1>
        {canEdit && (
          <button
            onClick={handleReindexAll}
            disabled={reindexing}
            className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            {reindexing ? "Reindexing..." : "Reindex All"}
          </button>
        )}
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-2">{error}</div>}
      {success && <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-4 py-2">{success}</div>}

      {canEdit && (
        <div className="grid grid-cols-2 gap-4">
          {/* File upload */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
            <h2 className="text-sm font-medium">Upload File</h2>
            <p className="text-xs text-gray-500">PDF, TXT, or other supported document formats</p>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.md,.doc,.docx"
              onChange={handleUpload}
              disabled={uploading}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-gray-300 file:text-sm file:font-medium file:bg-white hover:file:bg-gray-50 file:cursor-pointer disabled:opacity-50"
            />
            {uploading && <p className="text-xs text-gray-500">Uploading...</p>}
          </div>

          {/* Text snippet */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
            <h2 className="text-sm font-medium">Add Text Snippet</h2>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste hotel info, FAQ, policies..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-y"
            />
            <button
              onClick={handleAddText}
              disabled={saving || !text.trim()}
              className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Add Snippet"}
            </button>
          </div>
        </div>
      )}

      {/* Documents table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200">
          <h2 className="text-sm font-medium">Documents</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : docs.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No documents yet. Upload a file or add a text snippet above.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="px-5 py-2 font-medium">Title</th>
                <th className="px-5 py-2 font-medium">Source</th>
                <th className="px-5 py-2 font-medium">Status</th>
                <th className="px-5 py-2 font-medium">Created</th>
                {canEdit && <th className="px-5 py-2 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {docs.map((doc) => (
                <tr key={doc.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium">{doc.title}</td>
                  <td className="px-5 py-3 text-gray-500">{doc.source_type}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColor[doc.status] || "bg-gray-100 text-gray-600"}`}>
                      {doc.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{new Date(doc.created_at).toLocaleDateString()}</td>
                  {canEdit && (
                    <td className="px-5 py-3">
                      <button
                        onClick={() => handleReindexDoc(doc.id)}
                        className="text-xs text-gray-600 hover:text-gray-900 underline"
                      >
                        Reindex
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
