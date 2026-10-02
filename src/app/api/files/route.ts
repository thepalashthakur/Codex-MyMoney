import { NextRequest, NextResponse } from "next/server";
import { apiError, identity, noStore, sameOrigin } from "@/lib/auth";
import { s3SyncUrl } from "@/lib/config";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return apiError("Invalid request origin", 403);
  try {
    const auth = await identity(request);
    if (!auth) return apiError("Sign in required", 401);
    if ((Number(request.headers.get("content-length")) || 0) > 16384) return apiError("Body too large", 413);
    const body = await request.json();
    if (!["upload", "finalize", "download", "delete"].includes(body.action)) return apiError("Invalid file action", 400);
    const upstream = await fetch(`${s3SyncUrl()}/api/s3/sign`, { method: "POST", headers: { "Authorization": `Bearer ${auth.token}`, "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
    const result = await upstream.json();
    if (!upstream.ok) return apiError(result.error || "File service failed", upstream.status);
    return NextResponse.json(result, { headers: noStore });
  } catch { return apiError("File service unavailable", 503); }
}
