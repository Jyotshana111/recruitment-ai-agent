export class AppError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  // Next.js can normalize request.url to localhost even when the browser uses
  // 127.0.0.1. Match the incoming Host header rather than that internal URL.
  const host = request.headers.get("host") || new URL(request.url).host;
  if (origin && new URL(origin).host !== host) throw new AppError("This request must come from the app.", 403);
}
export async function readLimited(request: Request, maxBytes: number) {
  if (Number(request.headers.get("content-length")) > maxBytes) throw new AppError("The upload is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("The request is empty.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new AppError("The upload is too large.", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
export function errorResponse(error: unknown) {
  return Response.json({ error: error instanceof AppError ? error.message : "The request could not be processed. Please try again." }, {
    status: error instanceof AppError ? error.status : 500, headers: { "Cache-Control": "no-store" },
  });
}
