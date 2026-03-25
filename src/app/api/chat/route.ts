import { NextRequest } from "next/server";
import { runAgentStream } from "@/lib/agent";
import { checkRateLimit, validateInput } from "@/lib/ratelimit";
import { guardInput, sanitizeOutput, estimateTokens } from "@/lib/guard";
import { prefetchContext, buildMinimalContext } from "@/lib/prefetch";
import { getCachedSession } from "@/lib/server-cache";

// Request-level deduplication
const inflightRequests = new Map<string, boolean>();

function requestKey(apiKey: string, lastMessage: string): string {
  let hash = 0;
  const str = apiKey.slice(-8) + lastMessage;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      messages,
      hevyApiKey,
    }: {
      messages: { role: "user" | "assistant"; content: string }[];
      hevyApiKey: string;
    } = body;

    if (!hevyApiKey) {
      return new Response(JSON.stringify({ error: "Hevy API key required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!anthropicKey || !openaiKey) {
      return new Response(JSON.stringify({ error: "API keys not configured on server" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // --- LAYER 1: Input validation ---
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "user") {
      return new Response(JSON.stringify({ error: "No user message found" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const inputValidation = validateInput(lastMessage.content, messages.length);
    if (!inputValidation.valid) {
      return new Response(JSON.stringify({ error: inputValidation.reason }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // --- LAYER 2: Prompt injection guard ---
    const guardResult = guardInput(lastMessage.content);
    if (guardResult.blocked) {
      console.warn("[guard] Blocked input:", guardResult.flags, lastMessage.content.slice(0, 100));
      return new Response(
        JSON.stringify({ error: "Your message was flagged. Please rephrase your question about workouts." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // --- LAYER 3: Rate limiting ---
    const tokenEstimate = estimateTokens(messages);
    const rateCheck = await checkRateLimit(hevyApiKey, tokenEstimate);
    if (!rateCheck.allowed) {
      return new Response(JSON.stringify({ error: rateCheck.reason }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      });
    }

    // --- LAYER 4: Request deduplication ---
    const dedupeKey = requestKey(hevyApiKey, lastMessage.content);
    if (inflightRequests.get(dedupeKey)) {
      return new Response(JSON.stringify({ error: "Request already in progress" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      });
    }

    // --- LAYER 5: Load cached session ---
    const session = getCachedSession(hevyApiKey);
    if (!session) {
      return new Response(
        JSON.stringify({ error: "Session expired. Please refresh the page to re-index your workouts." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { workouts, templates, vectorDb } = session;

    inflightRequests.set(dedupeKey, true);

    try {
      // --- LAYER 6: Prefetch context ---
      const prefetch = await prefetchContext(
        lastMessage.content,
        workouts,
        templates,
        vectorDb
      );

      console.log(`[prefetch] Intent: ${prefetch.intent}, Context tokens: ~${prefetch.tokenEstimate}, Tools: ${prefetch.toolHints.join(",")}`);

      const minimalContext = buildMinimalContext(prefetch, workouts.length);

      // --- LAYER 7: Stream agent response via SSE ---
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Send rate limit metadata first
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ meta: { remaining: rateCheck.remaining } })}\n\n`)
            );

            let fullText = "";
            for await (const chunk of runAgentStream(messages, {
              anthropicKey,
              openaiKey,
              workouts,
              templates,
              vectorDb,
            }, minimalContext)) {
              fullText += chunk;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`)
              );
            }

            // Sanitize and send final (in case sanitization changed something)
            const sanitized = sanitizeOutput(fullText);
            if (sanitized !== fullText) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ replace: sanitized })}\n\n`)
              );
            }

            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          } catch (e) {
            console.error("[chat stream]", e);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: e instanceof Error ? e.message : "Agent error" })}\n\n`)
            );
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    } finally {
      setTimeout(() => inflightRequests.delete(dedupeKey), 5000);
    }
  } catch (error) {
    console.error("[chat]", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Agent error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
