export const formatMoney = (minor: number, currency = "INR") => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(minor / 100);
export const formatDate = (date: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
export const today = () => new Date().toLocaleDateString("en-CA");

export async function api<T = Record<string, unknown>>(path: string, init?: RequestInit): Promise<T> {
  const send = () => fetch(path, { ...init, headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers }, cache: "no-store" });
  let response = await send();
  if (response.status === 401 && !path.includes("/api/session/")) {
    const refresh = await fetch("/api/session/refresh", { method: "POST" });
    if (refresh.ok) response = await send();
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || data.error || "Request failed");
  return data as T;
}
