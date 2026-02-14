export interface WidgetConfig {
  greeting_message: string | null;
  escalation_phone: string | null;
  escalation_email: string | null;
  supported_languages: string[];
}

export interface ChatResponse {
  outcome: "answered" | "fallback" | "escalate";
  answer_text: string | null;
  citations: Citation[];
  confidence: number;
  escalation: Escalation | null;
}

export interface Citation {
  document_id: string;
  title: string;
  chunk_id: string;
}

export interface Escalation {
  phone: string | null;
  email: string | null;
  message: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  escalation?: Escalation | null;
  citations?: Citation[];
  timestamp: number;
}

export interface WidgetOptions {
  key: string;
  position: "bottom-right" | "bottom-left";
  locale: string;
  apiUrl: string;
}
