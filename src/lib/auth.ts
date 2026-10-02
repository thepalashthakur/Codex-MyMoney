import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const accessCookie = "mymoney_access";
export const refreshCookie = "mymoney_refresh";
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };

export function tokenFrom(request: NextRequest) {
  return request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1] || request.cookies.get(accessCookie)?.value || null;
}
export function sameOrigin(request: NextRequest) {
  if (request.headers.get("authorization")) return true;
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin && request.headers.get("sec-fetch-site") !== "cross-site";
}
export function setSession(response: NextResponse, session: { access_token: string; refresh_token: string; expires_in?: number }) {
  response.cookies.set(accessCookie, session.access_token, { ...cookieOptions, maxAge: session.expires_in || 3600 });
  response.cookies.set(refreshCookie, session.refresh_token, { ...cookieOptions, maxAge: 60 * 60 * 24 * 30 });
  return response;
}
export function clearSession(response: NextResponse) {
  response.cookies.set(accessCookie, "", { ...cookieOptions, maxAge: 0 });
  response.cookies.set(refreshCookie, "", { ...cookieOptions, maxAge: 0 });
  return response;
}
export function supabaseFor(token: string): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured");
  return createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
export async function identity(request: NextRequest) {
  const token = tokenFrom(request);
  if (!token) return null;
  const db = supabaseFor(token);
  const { data, error } = await db.auth.getUser(token);
  return error || !data.user ? null : { user: data.user, db, token };
}
export const noStore = { "Cache-Control": "private, no-store" };
export function apiError(message: string, status: number) {
  return NextResponse.json({ error: { message } }, { status, headers: noStore });
}
