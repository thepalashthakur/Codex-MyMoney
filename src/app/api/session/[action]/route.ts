import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { accessCookie, apiError, clearSession, identity, noStore, refreshCookie, sameOrigin, setSession } from "@/lib/auth";
import { authServiceUrl, configured } from "@/lib/config";

const credentials = z.object({ email: z.email().max(254), password: z.string().min(1).max(128) }).strict();
type Context = { params: Promise<{ action: string }> };
export async function GET(request: NextRequest, { params }: Context) {
  if ((await params).action !== "me") return apiError("Not found", 404);
  if (!configured()) return apiError("Service is not configured", 503);
  try {
    const auth = await identity(request);
    if (!auth) return apiError("Sign in required", 401);
    return NextResponse.json({ user: { id: auth.user.id, email: auth.user.email } }, { headers: noStore });
  } catch { return apiError("Authentication service unavailable", 503); }
}
export async function POST(request: NextRequest, { params }: Context) {
  if (!sameOrigin(request)) return apiError("Invalid request origin", 403);
  if (!configured()) return apiError("Service is not configured", 503);
  const { action } = await params;
  if (!["sign-in", "sign-up", "refresh", "sign-out"].includes(action)) return apiError("Not found", 404);
  try {
    if (action === "refresh") {
      const refresh_token = request.cookies.get(refreshCookie)?.value;
      if (!refresh_token) return apiError("Sign in required", 401);
      const upstream = await fetch(`${authServiceUrl()}/api/v1/auth/refresh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token }), cache: "no-store" });
      if (!upstream.ok) return clearSession(apiError("Session expired", 401));
      const data = await upstream.json();
      return setSession(NextResponse.json({ user: data.user }, { headers: noStore }), data.session);
    }
    if (action === "sign-out") {
      const access_token = request.cookies.get(accessCookie)?.value;
      const refresh_token = request.cookies.get(refreshCookie)?.value;
      if (access_token && refresh_token) {
        try { await fetch(`${authServiceUrl()}/api/v1/auth/sign-out`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ access_token, refresh_token }), cache: "no-store" }); }
        catch { /* Clear the local session even when the upstream service is unavailable. */ }
      }
      return clearSession(NextResponse.json({ signed_out: true }, { headers: noStore }));
    }
    if ((Number(request.headers.get("content-length")) || 0) > 16384) return apiError("Body too large", 413);
    const input = credentials.safeParse(await request.json());
    if (!input.success) return apiError(input.error.issues[0].message, 400);
    const upstream = await fetch(`${authServiceUrl()}/api/v1/auth/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input.data), cache: "no-store" });
    const data = await upstream.json();
    if (!upstream.ok) return apiError(data.error?.message || "Authentication failed", upstream.status);
    const response = NextResponse.json({ user: data.user, confirmation_required: data.confirmation_required, message: data.message }, { status: upstream.status, headers: noStore });
    return data.session ? setSession(response, data.session) : response;
  } catch { return apiError("Authentication service unavailable", 503); }
}
