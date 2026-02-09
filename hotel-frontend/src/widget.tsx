import { render, h } from "preact";
import { useState } from "preact/hooks";
import { parseScriptAttributes } from "./lib/config";
import { setApiBaseUrl } from "./lib/api";
import { useWidgetConfig } from "./hooks/useWidgetConfig";
import { useChat } from "./hooks/useChat";
import { ChatBubble } from "./components/ChatBubble";
import { ChatPanel } from "./components/ChatPanel";
import widgetCss from "./styles/widget.css?inline";

function Widget({ widgetKey, position, locale, apiUrl }: { widgetKey: string; position: "bottom-right" | "bottom-left"; locale: string; apiUrl: string }) {
  setApiBaseUrl(apiUrl);

  const [open, setOpen] = useState(false);
  const { config } = useWidgetConfig(widgetKey);
  const { messages, sending, error, send, restart } = useChat({
    widgetKey,
    locale,
    channel: "web_widget",
    config,
  });

  return (
    <>
      {open && (
        <ChatPanel
          messages={messages}
          sending={sending}
          error={error}
          onSend={send}
          onClose={() => setOpen(false)}
          onRestart={restart}
          title="Chat"
        />
      )}
      <ChatBubble open={open} onClick={() => setOpen(!open)} position={position} />
    </>
  );
}

(function init() {
  const opts = parseScriptAttributes();
  if (!opts.key) {
    console.warn("[HotelChatWidget] Missing data-key attribute on script tag");
    return;
  }

  // Create shadow DOM container
  const host = document.createElement("div");
  host.id = "hotel-chat-widget";
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  // Inject styles into shadow DOM
  const style = document.createElement("style");
  style.textContent = widgetCss;
  shadow.appendChild(style);

  // Add position class to shadow host
  host.className = opts.position === "bottom-left" ? "hcw-pos-left" : "hcw-pos-right";

  // Mount Preact app inside shadow DOM
  const mountPoint = document.createElement("div");
  shadow.appendChild(mountPoint);

  render(
    h(Widget, {
      widgetKey: opts.key,
      position: opts.position,
      locale: opts.locale,
      apiUrl: opts.apiUrl,
    }),
    mountPoint,
  );
})();
