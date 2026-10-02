import { z } from "zod";

export const resourceMap = {
  sources: "finance_sources",
  categories: "finance_categories",
  transactions: "finance_transactions",
  attachments: "finance_attachments",
} as const;
export type Resource = keyof typeof resourceMap;
export function isResource(value: string): value is Resource { return value in resourceMap; }
const uuid = z.uuid();
const color = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const kind = z.enum(["income", "expense"]);
const source = z.object({ name: z.string().trim().min(1).max(80), kind: z.string().trim().min(1).max(40), color: color.default("#8192b2"), last_four: z.string().regex(/^\d{4}$/).nullable().optional() }).strict();
const category = z.object({ name: z.string().trim().min(1).max(80), kind, color: color.default("#8192b2"), parent_id: uuid.nullable().optional() }).strict();
const transaction = z.object({ kind, amount_minor: z.number().int().positive().safe(), currency: z.string().regex(/^[A-Z]{3}$/).default("INR"), occurred_on: z.iso.date(), description: z.string().trim().min(1).max(200), note: z.string().max(4000).default(""), source_id: uuid.nullable().optional(), category_id: uuid.nullable().optional(), metadata: z.record(z.string(), z.unknown()).default({}) }).strict();
const attachment = z.object({ transaction_id: uuid, file_id: uuid }).strict();
export const schemas = { sources: source, categories: category, transactions: transaction, attachments: attachment };
export function parseInput(resource: Resource, input: unknown, partial = false) {
  const schema = schemas[resource];
  return partial ? schema.partial().safeParse(input) : schema.safeParse(input);
}
export function dbMessage(code?: string) {
  if (code === "23503") return "The selected source, category, or transaction was not found.";
  if (code === "23505") return "This record already exists.";
  if (code === "23514" || code === "P0001") return "The record violates a finance rule.";
  return "Database request failed.";
}
