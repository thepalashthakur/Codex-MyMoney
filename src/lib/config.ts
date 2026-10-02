export function configured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY && process.env.AUTH_SERVICE_URL);
}
export function authServiceUrl() {
  const value = process.env.AUTH_SERVICE_URL;
  if (!value) throw new Error("AUTH_SERVICE_URL is missing");
  return new URL(value).origin;
}
export function s3SyncUrl() {
  const value = process.env.S3_SYNC_URL;
  if (!value) throw new Error("S3_SYNC_URL is missing");
  return new URL(value).origin;
}
