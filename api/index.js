// Vercel Serverless Function Entry Point
// ---------------------------------------------------------------------------
// vercel.json rewrites EVERY /api/... request to this one function, and the Express app from
// server.js handles the route (Express still sees the original URL, e.g. /api/experts/list).
// This keeps production on exactly the same code as `npm run server`.
// ---------------------------------------------------------------------------
import app from '../server.js';

export default app;
