export function configured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY);
}
export function authServiceUrl() {
  const value = process.env.AUTH_SERVICE_URL || "https://use-auth-rosy.vercel.app";
  return new URL(value).origin;
}
export function s3SyncUrl() {
  const value = process.env.S3_SYNC_URL || "https://s3-sync.vercel.app";
  return new URL(value).origin;
}
