import { NextRequest, NextResponse } from "next/server";
import { apiError, identity, noStore } from "@/lib/auth";
import { parseInput } from "@/lib/finance";

export const runtime = "nodejs";
const tools = [
  { name: "list_transactions", description: "List recent income and expense transactions, optionally filtered by date and kind.", inputSchema: { type: "object", properties: { kind: { type: "string", enum: ["income", "expense"] }, from: { type: "string", description: "YYYY-MM-DD" }, to: { type: "string", description: "YYYY-MM-DD" }, limit: { type: "integer", minimum: 1, maximum: 100 } } } },
  { name: "create_transaction", description: "Record an income or expense. Amount is in minor currency units, e.g. paise or cents.", inputSchema: { type: "object", properties: { kind: { type: "string", enum: ["income", "expense"] }, amount_minor: { type: "integer" }, currency: { type: "string" }, occurred_on: { type: "string", description: "YYYY-MM-DD" }, description: { type: "string" }, note: { type: "string" }, source_id: { type: "string" }, category_id: { type: "string" }, metadata: { type: "object" } }, required: ["kind", "amount_minor", "occurred_on", "description"] } },
  { name: "list_categories", description: "List income and expense categories with parent IDs for nesting.", inputSchema: { type: "object", properties: {} } },
  { name: "list_sources", description: "List configured accounts, cards, cash, and other sources.", inputSchema: { type: "object", properties: {} } },
  { name: "get_summary", description: "Get income, expense, and balance totals for a date range, in minor currency units.", inputSchema: { type: "object", properties: { from: { type: "string", description: "YYYY-MM-DD" }, to: { type: "string", description: "YYYY-MM-DD" } } } },
];
function rpc(id: unknown, result: unknown) { return NextResponse.json({ jsonrpc: "2.0", id, result }, { headers: noStore }); }
function rpcError(id: unknown, code: number, message: string) { return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } }, { headers: noStore }); }
function content(data: unknown) { return { content: [{ type: "text", text: JSON.stringify(data) }] }; }
export async function GET() { return NextResponse.json({ name: "MyMoney MCP", protocol: "2025-03-26", endpoint: "/api/mcp", authentication: "Bearer token from UseAuth" }, { headers: noStore }); }
export async function POST(request: NextRequest) {
  if (!request.headers.get("authorization")?.startsWith("Bearer ")) return apiError("Bearer token required", 401);
  if ((Number(request.headers.get("content-length")) || 0) > 65536) return apiError("Body too large", 413);
  try {
    const auth = await identity(request);
    if (!auth) return apiError("Invalid bearer token", 401);
    const body = await request.json();
    const id = body.id ?? null;
    if (body.jsonrpc !== "2.0") return rpcError(id, -32600, "Invalid JSON-RPC request");
    if (body.method === "initialize") return rpc(id, { protocolVersion: "2025-03-26", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "mymoney", version: "1.0.0" } });
    if (body.method === "notifications/initialized") return new NextResponse(null, { status: 202, headers: noStore });
    if (body.method === "ping") return rpc(id, {});
    if (body.method === "tools/list") return rpc(id, { tools });
    if (body.method !== "tools/call") return rpcError(id, -32601, "Method not found");
    const name = body.params?.name;
    const args = body.params?.arguments || {};
    const db = auth.db;
    const userId = auth.user.id;
    if (name === "list_sources" || name === "list_categories") {
      const table = name === "list_sources" ? "finance_sources" : "finance_categories";
      const { data, error } = await db.from(table).select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(200);
      return error ? rpcError(id, -32603, "Database request failed") : rpc(id, content(data));
    }
    if (name === "list_transactions" || name === "get_summary") {
      let query = db.from("finance_transactions").select("*").eq("user_id", userId);
      if (args.kind === "income" || args.kind === "expense") query = query.eq("kind", args.kind);
      if (args.from) query = query.gte("occurred_on", args.from);
      if (args.to) query = query.lte("occurred_on", args.to);
      if (name === "list_transactions") query = query.order("occurred_on", { ascending: false }).limit(Math.min(Math.max(Number(args.limit) || 50, 1), 100));
      else query = query.limit(10000);
      const { data, error } = await query;
      if (error) return rpcError(id, -32603, "Database request failed");
      if (name === "list_transactions") return rpc(id, content(data));
      const totals: Record<string, { income_minor: number; expense_minor: number; balance_minor: number }> = {};
      for (const item of data || []) {
        const row = totals[item.currency] ||= { income_minor: 0, expense_minor: 0, balance_minor: 0 };
        if (item.kind === "income") row.income_minor += Number(item.amount_minor);
        else row.expense_minor += Number(item.amount_minor);
        row.balance_minor = row.income_minor - row.expense_minor;
      }
      return rpc(id, content({ totals, truncated: (data?.length || 0) === 10000 }));
    }
    if (name === "create_transaction") {
      const parsed = parseInput("transactions", args);
      if (!parsed.success) return rpcError(id, -32602, parsed.error.issues[0].message);
      const { data, error } = await db.from("finance_transactions").insert({ ...parsed.data, user_id: userId }).select("*").single();
      return error ? rpcError(id, -32602, "Could not create transaction; check source and category ownership") : rpc(id, content(data));
    }
    return rpcError(id, -32602, "Unknown tool");
  } catch { return rpcError(null, -32700, "Invalid request or service unavailable"); }
}
