import { render } from "preact";
import { setApiBaseUrl } from "./lib/api";
import { useWidgetConfig } from "./hooks/useWidgetConfig";
import { useChat } from "./hooks/useChat";
import { ChatPanel } from "./components/ChatPanel";
import "./styles/standalone.css";

function StandaloneChat() {
  const params = new URLSearchParams(window.location.search);
  const widgetKey = params.get("key") || "";
  const locale = params.get("locale") || "en";
  const apiUrl = params.get("api") || window.location.origin;

  if (!widgetKey) {
    return <div class="hcw-standalone-error">Missing <code>key</code> parameter. Use <code>/chat?key=wk_xxx</code></div>;
  }

  setApiBaseUrl(apiUrl);

  const { config, error: configError } = useWidgetConfig(widgetKey);
  const { messages, sending, error, send, restart } = useChat({
    widgetKey,
    locale,
    channel: "web_url",
    config,
  });

  if (configError) {
    return <div class="hcw-standalone-error">Failed to load widget: {configError}</div>;
  }

  return (
    <ChatPanel
      messages={messages}
      sending={sending}
      error={error}
      onSend={send}
      onRestart={restart}
      title="Chat"
    />
  );
}

render(<StandaloneChat />, document.getElementById("app")!);
