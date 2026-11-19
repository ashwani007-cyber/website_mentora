# Archived code (not used by the app)

Kept only for reference. Nothing here is deployed, bundled or type-checked.

- `legacy-api-server.js`: an old copy of the API that used to live in `api/server.js`.
  Vercel would have exposed it as its own serverless function. It used `select('*')`
  everywhere and is replaced by `server.js` (served through `api/index.js`).
- `kyc/`: an early KYC workflow (`kycService.ts` and pages). No file in `src/` imports
  it. It used tables that don't exist in the database (`profiles`, `kyc_documents`,
  `status_history`).

To bring something back, move it into `src/`, then fix its queries to use explicit
columns and limits (see `src/lib/columns.ts`).
