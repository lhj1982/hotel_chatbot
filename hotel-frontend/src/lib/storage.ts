import type { ChatMessage } from "./types";

interface StoredChat {
  conversation_id: string;
  messages: ChatMessage[];
  updated_at: number;
}

const MAX_MESSAGES = 50;
const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

function storageKey(widgetKey: string): string {
  return `hotel_chat_${widgetKey}`;
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage unavailable (private browsing, quota exceeded)
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function loadChat(widgetKey: string): StoredChat | null {
  const raw = safeGet(storageKey(widgetKey));
  if (!raw) return null;
  try {
    const data: StoredChat = JSON.parse(raw);
    if (Date.now() - data.updated_at > EXPIRY_MS) {
      safeRemove(storageKey(widgetKey));
      return null;
    }
    return data;
  } catch {
    safeRemove(storageKey(widgetKey));
    return null;
  }
}

export function saveChat(widgetKey: string, conversationId: string, messages: ChatMessage[]): void {
  const data: StoredChat = {
    conversation_id: conversationId,
    messages: messages.slice(-MAX_MESSAGES),
    updated_at: Date.now(),
  };
  safeSet(storageKey(widgetKey), JSON.stringify(data));
}

export function clearChat(widgetKey: string): void {
  safeRemove(storageKey(widgetKey));
}
