export interface TenantRole {
  tenant_id: string;
  name: string;
  role: "owner" | "editor" | "viewer";
}

export interface CurrentUser {
  id: string;
  email: string;
  tenants: TenantRole[];
}

export interface TenantSettings {
  greeting_message: string | null;
  escalation_phone: string | null;
  escalation_email: string | null;
  retention_days: number | null;
  allowed_domains: string[] | null;
}

export interface WidgetKey {
  id: string;
  key: string;
  status: "active" | "disabled";
  created_at?: string;
}

export interface KBDocument {
  id: string;
  title: string;
  source_type: "pdf" | "text" | "url";
  status: "processing" | "ready" | "failed";
  created_at: string;
}

export interface ConversationSummary {
  id: string;
  channel: string;
  status: "active" | "closed" | "escalated";
  started_at: string;
  ended_at: string | null;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string | null;
  created_at: string;
}

export interface ConversationTurn {
  id: string;
  outcome: "answered" | "fallback" | "escalate";
  confidence: number | null;
  created_at: string;
}

export interface ConversationDetail extends ConversationSummary {
  messages: ConversationMessage[];
  turns: ConversationTurn[];
}

export interface StatsOverview {
  total_conversations: number;
  total_messages: number;
  fallback_count: number;
  escalations: number;
}

export interface UnansweredTurn {
  turn_id: string;
  conversation_id: string;
  user_message: string | null;
  confidence: number | null;
  created_at: string;
}
