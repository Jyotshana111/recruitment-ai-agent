import { AppError } from "./server";
export const MODEL = process.env.OLLAMA_MODEL || "gemma3:4b";
export const OLLAMA_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const state = globalThis as typeof globalThis & { recruitmentModelBusy?: boolean };
// Limit expensive inference to one operation per server process.
export async function withModel<T>(operation: () => Promise<T>) {
  if (state.recruitmentModelBusy) throw new AppError("Another analysis or scan is running. Please wait and retry.", 429);
  state.recruitmentModelBusy = true;
  try { return await operation(); } finally { state.recruitmentModelBusy = false; }
}
export async function chat(body: Record<string, unknown>, signal?: AbortSignal) {
  let response: Response;
  try {
    response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, stream: false, ...body }),
      signal: AbortSignal.any([AbortSignal.timeout(180000), ...(signal ? [signal] : [])]),
    });
  } catch (error) {
    if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)) throw new AppError("Local processing was cancelled or timed out. Try a shorter document.", 504);
    throw new AppError("Cannot reach Ollama. Open Ollama on this computer and retry.", 503);
  }
  if (!response.ok) throw new AppError(response.status === 404 ? `Model ${MODEL} is not installed. Run: ollama pull ${MODEL}` : "Ollama could not process the request. Check its available memory and retry.", 503);
  const result = await response.json();
  if (result.done_reason === "length") throw new AppError("The model ran out of output space. Try a shorter document.", 422);
  if (typeof result.message?.content !== "string") throw new AppError("Ollama returned an unexpected response.", 502);
  return result.message.content as string;
}
