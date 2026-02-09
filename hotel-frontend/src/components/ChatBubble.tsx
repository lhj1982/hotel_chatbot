interface Props {
  open: boolean;
  onClick: () => void;
  position: "bottom-right" | "bottom-left";
}

export function ChatBubble({ open, onClick, position }: Props) {
  return (
    <button
      class={`hcw-fab ${position === "bottom-left" ? "hcw-fab--left" : "hcw-fab--right"}`}
      onClick={onClick}
      aria-label={open ? "Close chat" : "Open chat"}
    >
      {open ? <CloseIcon /> : <ChatIcon />}
    </button>
  );
}

function ChatIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
