import { useRef, useEffect } from "preact/hooks";
import type { ChatMessage } from "../lib/types";
import { MessageBubble } from "./MessageBubble";
import { EscalationCard } from "./EscalationCard";
import { TypingIndicator } from "./TypingIndicator";

interface Props {
  messages: ChatMessage[];
  sending: boolean;
}

export function MessageList({ messages, sending }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, sending]);

  return (
    <div class="hcw-messages">
      {messages.map((msg) => (
        <div key={msg.id}>
          <MessageBubble message={msg} />
          {msg.escalation && <EscalationCard escalation={msg.escalation} />}
        </div>
      ))}
      {sending && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
}
