export function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

export function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

export async function readJsonBody(req, maximum = 64_000) {
  if (req.body && typeof req.body === 'object') return req.body;
  let bytes = 0;
  const chunks = [];
  for await (const chunk of req) {
    bytes += Buffer.byteLength(chunk);
    if (bytes > maximum) fail(413, 'Request body is too large');
    chunks.push(Buffer.from(chunk));
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'A JSON object is required');
    return value;
  } catch {
    return fail(400, 'Invalid JSON request');
  }
}
