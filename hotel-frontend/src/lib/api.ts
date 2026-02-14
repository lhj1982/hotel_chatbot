import type { WidgetConfig, ChatResponse } from "./types";

let _baseUrl = "";

export function setApiBaseUrl(url: string) {
  _baseUrl = url.replace(/\/$/, "");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${_baseUrl}${path}`, options);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.detail || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function getWidgetConfig(widgetKey: string): Promise<WidgetConfig> {
  return request(`/public/widget-config?widget_key=${encodeURIComponent(widgetKey)}`);
}

export function startConversation(
  widgetKey: string,
  channel: "web_widget" | "web_url" = "web_widget",
  locale?: string,
): Promise<{ conversation_id: string }> {
  return request("/public/conversation/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      widget_key: widgetKey,
      channel,
      locale,
      page_url: window.location.href,
    }),
  });
}

export function sendMessage(
  widgetKey: string,
  conversationId: string,
  message: string,
  locale?: string,
): Promise<ChatResponse> {
  return request("/public/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      widget_key: widgetKey,
      conversation_id: conversationId,
      message,
      locale,
    }),
  });
}
