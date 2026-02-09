import { useState, useCallback, useRef } from "preact/hooks";
import { startConversation, sendMessage } from "../lib/api";
import { loadChat, saveChat, clearChat } from "../lib/storage";
import type { ChatMessage, WidgetConfig } from "../lib/types";

interface UseChatOptions {
  widgetKey: string;
  locale: string;
  channel?: "web_widget" | "web_url";
  config: WidgetConfig | null;
}

export function useChat({ widgetKey, locale, channel = "web_widget", config }: UseChatOptions) {
  const stored = useRef(loadChat(widgetKey));
  const [conversationId, setConversationId] = useState<string | null>(stored.current?.conversation_id || null);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const initial: ChatMessage[] = stored.current?.messages || [];
    return initial;
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addGreeting = useCallback(
    (greeting: string) => {
      setMessages((prev) => {
        if (prev.length > 0) return prev;
        return [
          {
            id: "greeting",
            role: "assistant",
            content: greeting,
            timestamp: Date.now(),
          },
        ];
      });
    },
    [],
  );

  // Show greeting when config loads and there are no existing messages
  if (config?.greeting_message && messages.length === 0) {
    addGreeting(config.greeting_message);
  }

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || sending) return;
      setError(null);
      setSending(true);

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);

      try {
        let cid = conversationId;
        if (!cid) {
          const res = await startConversation(widgetKey, channel, locale);
          cid = res.conversation_id;
          setConversationId(cid);
        }

        const response = await sendMessage(widgetKey, cid!, text, locale);

        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content:
            response.answer_text ||
            response.escalation?.message ||
            "I'm sorry, I couldn't find an answer.",
          escalation: response.escalation,
          citations: response.citations,
          timestamp: Date.now(),
        };

        setMessages((prev) => {
          const updated = [...prev, assistantMsg];
          saveChat(widgetKey, cid!, updated);
          return updated;
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Something went wrong";
        if (msg.includes("not found") || msg.includes("404")) {
          // Conversation expired — restart
          setConversationId(null);
          clearChat(widgetKey);
          setError("Session expired. Please send your message again.");
        } else {
          setError(msg);
        }
      } finally {
        setSending(false);
      }
    },
    [conversationId, widgetKey, locale, channel, sending],
  );

  const restart = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    clearChat(widgetKey);
    setError(null);
    if (config?.greeting_message) {
      addGreeting(config.greeting_message);
    }
  }, [widgetKey, config, addGreeting]);

  return { messages, sending, error, send, restart };
}
