export type Source = { id: string; name: string; kind: string; color: string; last_four: string | null };
export type Category = { id: string; name: string; kind: "income" | "expense"; color: string; parent_id: string | null };
export type Transaction = { id: string; kind: "income" | "expense"; amount_minor: number; currency: string; occurred_on: string; description: string; note: string; source_id: string | null; category_id: string | null; metadata: Record<string, unknown> };
export type Attachment = { id: string; transaction_id: string; file_id: string; file_name: string; content_type: string; size_bytes: number };
export type Tab = "overview" | "transactions" | "categories" | "sources" | "settings";
