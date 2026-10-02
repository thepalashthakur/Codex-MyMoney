import { NextRequest, NextResponse } from "next/server";
import { apiError, identity, noStore, sameOrigin } from "@/lib/auth";
import { dbMessage, isResource, parseInput, resourceMap, type Resource } from "@/lib/finance";

type Db = NonNullable<Awaited<ReturnType<typeof identity>>>["db"];
async function attachmentInput(db: Db, userId: string, value: { transaction_id: string; file_id: string }) {
  const [file, transaction] = await Promise.all([
    db.from("files").select("id, file_name, content_type, size_bytes").eq("id", value.file_id).eq("user_id", userId).maybeSingle(),
    db.from("finance_transactions").select("id").eq("id", value.transaction_id).eq("user_id", userId).maybeSingle(),
  ]);
  if (file.error || transaction.error || !file.data || !transaction.data) return null;
  return { ...value, file_name: file.data.file_name as string, content_type: file.data.content_type as string, size_bytes: file.data.size_bytes as number };
}
export async function handleList(request: NextRequest, resourceName: string) {
  if (!isResource(resourceName)) return apiError("Not found", 404);
  try {
    const auth = await identity(request);
    if (!auth) return apiError("Sign in required", 401);
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 100, 1), 200);
    let query = auth.db.from(resourceMap[resourceName]).select("*").eq("user_id", auth.user.id).limit(limit);
    if (resourceName === "transactions") {
      const kind = url.searchParams.get("kind");
      if (kind === "income" || kind === "expense") query = query.eq("kind", kind);
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      if (from) query = query.gte("occurred_on", from);
      if (to) query = query.lte("occurred_on", to);
      query = query.order("occurred_on", { ascending: false }).order("created_at", { ascending: false });
    } else query = query.order("created_at", { ascending: false });
    if (resourceName === "attachments" && url.searchParams.get("transaction_id")) query = query.eq("transaction_id", url.searchParams.get("transaction_id")!);
    const { data, error } = await query;
    if (error) return apiError(dbMessage(error.code), 500);
    return NextResponse.json({ data }, { headers: noStore });
  } catch { return apiError("Service unavailable", 503); }
}
export async function handleCreate(request: NextRequest, resourceName: string) {
  if (!isResource(resourceName)) return apiError("Not found", 404);
  if (!sameOrigin(request)) return apiError("Invalid request origin", 403);
  try {
    const auth = await identity(request);
    if (!auth) return apiError("Sign in required", 401);
    if ((Number(request.headers.get("content-length")) || 0) > 65536) return apiError("Body too large", 413);
    const parsed = parseInput(resourceName, await request.json());
    if (!parsed.success) return apiError(parsed.error.issues[0].message, 400);
    let value: Record<string, unknown> = parsed.data;
    if (resourceName === "attachments") {
      const attachment = await attachmentInput(auth.db, auth.user.id, parsed.data as { transaction_id: string; file_id: string });
      if (!attachment) return apiError("Owned file or transaction not found", 404);
      value = attachment;
    }
    const { data, error } = await auth.db.from(resourceMap[resourceName]).insert({ ...value, user_id: auth.user.id }).select("*").single();
    if (error) return apiError(dbMessage(error.code), error.code?.startsWith("23") ? 400 : 500);
    return NextResponse.json({ data }, { status: 201, headers: noStore });
  } catch { return apiError("Invalid JSON or service unavailable", 400); }
}
export async function handleOne(request: NextRequest, resourceName: string, id: string, method: "PATCH" | "DELETE") {
  if (!isResource(resourceName) || !/^[0-9a-f-]{36}$/i.test(id)) return apiError("Not found", 404);
  if (!sameOrigin(request)) return apiError("Invalid request origin", 403);
  if (resourceName === "attachments" && method === "PATCH") return apiError("Attachments cannot be edited", 405);
  try {
    const auth = await identity(request);
    if (!auth) return apiError("Sign in required", 401);
    let query;
    if (method === "PATCH") {
      const parsed = parseInput(resourceName as Resource, await request.json(), true);
      if (!parsed.success || !Object.keys(parsed.data || {}).length) return apiError("Invalid changes", 400);
      query = auth.db.from(resourceMap[resourceName]).update(parsed.data).eq("id", id).eq("user_id", auth.user.id);
    } else query = auth.db.from(resourceMap[resourceName]).delete().eq("id", id).eq("user_id", auth.user.id);
    const { data, error } = await query.select("*").maybeSingle();
    if (error) return apiError(dbMessage(error.code), error.code?.startsWith("23") ? 400 : 500);
    if (!data) return apiError("Record not found", 404);
    return NextResponse.json({ data }, { headers: noStore });
  } catch { return apiError("Invalid JSON or service unavailable", 400); }
}
