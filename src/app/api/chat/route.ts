import { NextRequest } from "next/server";
import { guardInput } from "@/lib/guard";

export const runtime = "edge";

interface ChatRequest {
  provider: "claude" | "openai" | "gemini";
  apiKey: string;
  model: string;
  messages: { role: "user" | "assistant"; content: string }[];
  system: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json();
    const { provider, apiKey, model, messages, system } = body;

    if (!apiKey || !provider || !messages?.length || !system) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Guard input
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === "user") {
      const guard = guardInput(lastMsg.content);
      if (guard.blocked) {
        return Response.json({ error: guard.reason ?? "Input blocked" }, { status: 400 });
      }
    }

    // Token estimate check
    const totalChars = messages.reduce((s, m) => s + m.content.length, 0) + system.length;
    if (totalChars > 200000) {
      return Response.json({ error: "Request too large" }, { status: 400 });
    }

    switch (provider) {
      case "claude":
        return streamClaude(apiKey, model, messages, system);
      case "openai":
        return streamOpenAI(apiKey, model, messages, system);
      case "gemini":
        return streamGemini(apiKey, model, messages, system);
      default:
        return Response.json({ error: "Unknown provider" }, { status: 400 });
    }
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}

// ═══ Claude ═══

async function streamClaude(
  apiKey: string, model: string,
  messages: { role: string; content: string }[], system: string
) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model, max_tokens: 2048, system, stream: true,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return Response.json({ error: `Claude: ${res.status} ${err}` }, { status: res.status });
  }

  return transformSSE(res, (parsed) => {
    if (parsed.type === "content_block_delta" && parsed.delta?.text) return parsed.delta.text;
    return null;
  });
}

// ═══ OpenAI ═══

async function streamOpenAI(
  apiKey: string, model: string,
  messages: { role: string; content: string }[], system: string
) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model, max_tokens: 2048, stream: true,
      messages: [{ role: "system", content: system }, ...messages.map((m) => ({ role: m.role, content: m.content }))],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return Response.json({ error: `OpenAI: ${res.status} ${err}` }, { status: res.status });
  }

  return transformSSE(res, (parsed) => parsed.choices?.[0]?.delta?.content ?? null);
}

// ═══ Gemini ═══

async function streamGemini(
  apiKey: string, model: string,
  messages: { role: string; content: string }[], system: string
) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: { maxOutputTokens: 2048 },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    return Response.json({ error: `Gemini: ${res.status} ${err}` }, { status: res.status });
  }

  return transformSSE(res, (parsed) => parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? null);
}

// ═══ Shared SSE transform ═══

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformSSE(
  upstream: Response,
  extractText: (parsed: any) => string | null
) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const readable = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]" || !data) continue;
            try {
              const parsed = JSON.parse(data);
              const text = extractText(parsed);
              if (text) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            } catch { /* skip */ }
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}
