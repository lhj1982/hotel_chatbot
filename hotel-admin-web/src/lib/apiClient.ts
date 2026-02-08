import type {
  CurrentUser, TenantSettings, WidgetKey, KBDocument,
  ConversationSummary, ConversationDetail,
  StatsOverview, UnansweredTurn,
} from "./types";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/core${path}`, { ...options, cache: "no-store" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || data?.detail || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

function jsonPost<T>(path: string, body: unknown): Promise<T> {
  return request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Auth
export const getMe = () => request<CurrentUser>("/admin/me");

// Tenant Settings
export const getTenantSettings = (tid: string) =>
  request<TenantSettings>(`/admin/tenant/${tid}/settings`);

export const updateTenantSettings = (tid: string, data: Partial<TenantSettings>) =>
  jsonPost<{ status: string }>(`/admin/tenant/${tid}/settings`, data);

// Widget Keys
export const listWidgetKeys = (tid: string) =>
  request<WidgetKey[]>(`/admin/tenant/${tid}/widget-keys`);

export const createWidgetKey = (tid: string) =>
  jsonPost<WidgetKey>(`/admin/tenant/${tid}/widget-keys`, {});

export const disableWidgetKey = (wkId: string) =>
  jsonPost<{ status: string }>(`/admin/widget-keys/${wkId}/disable`, {});

// KB Documents
export const listDocuments = (tid: string) =>
  request<KBDocument[]>(`/admin/tenant/${tid}/kb/documents`);

export const addText = (tid: string, title: string, content: string) =>
  jsonPost<{ document_id: string; status: string }>(`/admin/tenant/${tid}/kb/text`, { title, content });

export async function uploadFile(tid: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`/api/core/admin/tenant/${tid}/kb/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || data?.detail || "Upload failed");
  }
  return res.json() as Promise<{ document_id: string; status: string }>;
}

export const reindexAll = (tid: string) =>
  jsonPost<{ status: string; document_count: number }>(`/admin/tenant/${tid}/kb/reindex`, {});

export const reindexDoc = (tid: string, docId: string) =>
  request<{ status: string }>(`/admin/tenant/${tid}/kb/reindex?doc_id=${docId}`, { method: "POST" });

// Conversations
export const listConversations = (tid: string, from?: string, to?: string) => {
  const params = new URLSearchParams();
  if (from) params.set("from_date", from);
  if (to) params.set("to_date", to);
  const q = params.toString() ? `?${params}` : "";
  return request<ConversationSummary[]>(`/admin/tenant/${tid}/conversations${q}`);
};

export const getConversation = (tid: string, cid: string) =>
  request<ConversationDetail>(`/admin/tenant/${tid}/conversations/${cid}`);

// Stats
export const getStatsOverview = (tid: string, from?: string, to?: string) => {
  const params = new URLSearchParams();
  if (from) params.set("from_date", from);
  if (to) params.set("to_date", to);
  const q = params.toString() ? `?${params}` : "";
  return request<StatsOverview>(`/admin/tenant/${tid}/stats/overview${q}`);
};

export const getUnanswered = (tid: string) =>
  request<UnansweredTurn[]>(`/admin/tenant/${tid}/stats/unanswered`);
