import { MODEL, OLLAMA_URL } from "@/lib/ollama";
export const dynamic = "force-dynamic";
export async function GET() {
  let status: "ready" | "missing" | "offline" = "offline";
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(4000), cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      status = data.models?.some((item: { name: string }) => item.name === MODEL) ? "ready" : "missing";
    }
  } catch { /* A stopped Ollama server is a normal status. */ }
  return Response.json({ status, model: MODEL }, { headers: { "Cache-Control": "no-store" } });
}
