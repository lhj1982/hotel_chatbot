import { useState } from "preact/hooks";
import type { ChatMessage } from "../lib/types";
import { MessageList } from "./MessageList";
import { ErrorBanner } from "./ErrorBanner";

interface Props {
  messages: ChatMessage[];
  sending: boolean;
  error: string | null;
  onSend: (text: string) => void;
  onClose?: () => void;
  onRestart: () => void;
  title?: string;
}

export function ChatPanel({ messages, sending, error, onSend, onClose, onRestart, title }: Props) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSend(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div class="hcw-panel">
      <div class="hcw-header">
        <span class="hcw-header__title">{title || "Chat"}</span>
        <div class="hcw-header__actions">
          <button class="hcw-header__btn" onClick={onRestart} title="New conversation" aria-label="New conversation">
            <RestartIcon />
          </button>
          {onClose && (
            <button class="hcw-header__btn" onClick={onClose} title="Close" aria-label="Close chat">
              <CloseIcon />
            </button>
          )}
        </div>
      </div>

      <MessageList messages={messages} sending={sending} />

      {error && <ErrorBanner message={error} />}

      <form class="hcw-input" onSubmit={handleSubmit}>
        <input
          type="text"
          class="hcw-input__field"
          value={input}
          onInput={(e) => setInput((e.target as HTMLInputElement).value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={sending}
          aria-label="Message input"
        />
        <button type="submit" class="hcw-input__send" disabled={sending || !input.trim()} aria-label="Send message">
          <SendIcon />
        </button>
      </form>
    </div>
  );
}

function RestartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M3 12a9 9 0 1 1 9 9" />
      <path d="M3 21v-6h6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="m22 2-7 20-4-9-9-4z" />
      <path d="m22 2-11 11" />
    </svg>
  );
}
