# MyMoney

A private finance tracker built with Next.js for Vercel. It records income and expenses, custom payment sources, nested categories, notes, metadata, and private file attachments. The app also exposes a versioned REST API and an MCP endpoint.

## Architecture

- **Identity:** UseAuth email/password token API. MyMoney proxies sign-in and stores the returned access and refresh tokens in HttpOnly, SameSite cookies. REST and MCP clients can send a UseAuth access token as `Authorization: Bearer …`.
- **Database:** the **same Supabase project** used by UseAuth. Apply [`supabase/migrations/001_finance.sql`](supabase/migrations/001_finance.sql) in its SQL editor. Every finance table has owner RLS. The database also checks that source, category, and transaction relationships stay within the same owner, and that a transaction uses a category of the same kind.
- **Files:** the **same Supabase project** used by S3Sync, with its `public.files` migration already applied. MyMoney proxies the S3Sync signing API; the browser uploads directly to private S3 and links the finalized file to a transaction. S3 bucket CORS must include the MyMoney origin.

UseAuth and MyMoney are configured to use S3Sync's Supabase project. Keep them on the same project: a token from one project cannot authorize another project's files.

## Setup

1. Apply the finance SQL migration to the shared Supabase project. S3Sync's `files` table is already present in that project. In Supabase Authentication → URL Configuration, set the Site URL to `https://use-auth-rosy.vercel.app` and add `https://use-auth-rosy.vercel.app/auth/confirm` to Redirect URLs so email confirmation works.
2. Copy `.env.example` to `.env.local` and set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. MyMoney defaults to `https://use-auth-rosy.vercel.app` and `https://s3-sync.vercel.app`; override `AUTH_SERVICE_URL` or `S3_SYNC_URL` if those domains change. The Supabase URL and publishable key must point to the same project as UseAuth and S3Sync. No service role key is needed in MyMoney.
3. Add the MyMoney browser origin to S3 bucket CORS for `PUT` uploads.
4. Link the MyMoney repository to its Vercel project and set the Supabase environment variables there. Pull them into `.env.local`, verify the keys are present, then run `npm install` and `npm run dev`. Deploy with the Next.js preset. Never expose a Supabase service role key or AWS credentials in this app.

The default transaction currency is INR. Amounts are stored as positive integer minor units (paise) so totals have no floating point rounding drift. Each transaction also records its ISO currency code; the overview currently shows INR totals and is intended for a single currency workspace.

## REST API

All endpoints require a valid UseAuth access token in an HttpOnly MyMoney session cookie or the `Authorization` header. Browser mutations with cookies require a same origin request. Responses are private and uncached.

| Endpoint | Methods | Notes |
| --- | --- | --- |
| `/api/session/sign-in`, `/api/session/sign-up` | POST | `{ "email", "password" }`; sign-up may require email confirmation. |
| `/api/session/refresh`, `/api/session/sign-out` | POST | Cookie session lifecycle. |
| `/api/session/me` | GET | Current user. |
| `/api/v1/sources` | GET, POST | Custom accounts, cards, cash, or any source kind. |
| `/api/v1/categories` | GET, POST | `kind: income\|expense`, optional `parent_id`. |
| `/api/v1/transactions` | GET, POST | Query filters: `kind`, `from`, `to`, `limit` (max 200). |
| `/api/v1/attachments` | GET, POST | Link an S3Sync finalized `file_id` to a transaction. |
| `/api/v1/{resource}/{id}` | PATCH, DELETE | Edit or remove an owned record. Attachment edits are unsupported. |
| `/api/files` | POST | Proxy S3Sync `upload`, `finalize`, `download`, and `delete` actions. |

Example transaction:

```json
{
  "kind": "expense",
  "amount_minor": 129900,
  "currency": "INR",
  "occurred_on": "2026-10-03",
  "description": "Groceries",
  "note": "Weekly shopping",
  "source_id": null,
  "category_id": null,
  "metadata": { "merchant": "Local store" }
}
```

## MCP

`POST /api/mcp` accepts MCP JSON-RPC over HTTP with a UseAuth bearer token. It supports `initialize`, `ping`, `tools/list`, and `tools/call`. Tools: `list_transactions`, `create_transaction`, `list_categories`, `list_sources`, and `get_summary`. MCP writes pass through the same RLS rules as REST writes.

MCP client configuration:

```json
{
  "mcpServers": {
    "mymoney": {
      "url": "https://YOUR-MYMONEY-DOMAIN/api/mcp",
      "headers": { "Authorization": "Bearer YOUR_USEAUTH_ACCESS_TOKEN" }
    }
  }
}
```

UseAuth access tokens expire. Clients must refresh them through UseAuth's `/api/v1/auth/refresh` and update the MCP header. ChatGPT clients that require OAuth discovery and dynamic registration need an OAuth bridge before they can connect without manually supplied tokens; this endpoint does not claim to implement that flow.

## Verification

`npm run lint`, `npm run typecheck`, and `npm run build` validate the project. After environment setup, verify a real sign-in, category/source creation, transaction entry, S3 upload and download, and MCP `tools/list` with a real UseAuth token. These integration checks require the shared Supabase project and deployed services.
