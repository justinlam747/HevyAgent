import fs from "fs";
import path from "path";

interface RateLimitEntry {
  tokens: number;
  requests: number;
  windowStart: number;
}

interface RateLimitStore {
  [key: string]: RateLimitEntry;
}

const STORE_PATH = path.join(process.cwd(), ".vectordb", "ratelimit.json");
const WINDOW_MS = 60 * 60 * 1000; // 1 hour window

const LIMITS = {
  maxRequestsPerHour: 30,
  maxTokensPerHour: 50_000,
  maxInputLength: 2000,
  maxMessagesPerConversation: 20,
};

// File-based mutex to prevent race conditions on the store
let writeLock = false;

function loadStore(): RateLimitStore {
  try {
    if (fs.existsSync(STORE_PATH)) {
      return JSON.parse(fs.readFileSync(STORE_PATH, "utf-8"));
    }
  } catch { /* fresh start */ }
  return {};
}

function saveStore(store: RateLimitStore) {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store));
}

function getUserKey(apiKeyHash: string): string {
  // Hash the API key so we don't store it raw
  let hash = 0;
  for (let i = 0; i < apiKeyHash.length; i++) {
    const char = apiKeyHash.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `user_${Math.abs(hash).toString(36)}`;
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  remaining?: { requests: number; tokens: number };
}

export async function checkRateLimit(
  apiKey: string,
  estimatedTokens: number
): Promise<RateLimitResult> {
  // Simple spinlock for file-level race condition prevention
  while (writeLock) {
    await new Promise((r) => setTimeout(r, 10));
  }
  writeLock = true;

  try {
    const store = loadStore();
    const key = getUserKey(apiKey);
    const now = Date.now();

    let entry = store[key];

    // Reset window if expired
    if (!entry || now - entry.windowStart > WINDOW_MS) {
      entry = { tokens: 0, requests: 0, windowStart: now };
    }

    // Check limits
    if (entry.requests >= LIMITS.maxRequestsPerHour) {
      const resetIn = Math.ceil((entry.windowStart + WINDOW_MS - now) / 60000);
      return {
        allowed: false,
        reason: `Rate limit: ${LIMITS.maxRequestsPerHour} requests/hour. Resets in ${resetIn}m.`,
      };
    }

    if (entry.tokens + estimatedTokens > LIMITS.maxTokensPerHour) {
      const resetIn = Math.ceil((entry.windowStart + WINDOW_MS - now) / 60000);
      return {
        allowed: false,
        reason: `Token budget exceeded (${LIMITS.maxTokensPerHour.toLocaleString()}/hour). Resets in ${resetIn}m.`,
      };
    }

    // Record usage
    entry.requests++;
    entry.tokens += estimatedTokens;
    store[key] = entry;
    saveStore(store);

    return {
      allowed: true,
      remaining: {
        requests: LIMITS.maxRequestsPerHour - entry.requests,
        tokens: LIMITS.maxTokensPerHour - entry.tokens,
      },
    };
  } finally {
    writeLock = false;
  }
}

export function validateInput(
  input: string,
  messageCount: number
): { valid: boolean; reason?: string } {
  if (!input || input.trim().length === 0) {
    return { valid: false, reason: "Empty input." };
  }

  if (input.length > LIMITS.maxInputLength) {
    return {
      valid: false,
      reason: `Input too long (${input.length}/${LIMITS.maxInputLength} chars).`,
    };
  }

  if (messageCount > LIMITS.maxMessagesPerConversation) {
    return {
      valid: false,
      reason: `Conversation too long. Start a new chat (max ${LIMITS.maxMessagesPerConversation} messages).`,
    };
  }

  return { valid: true };
}

export { LIMITS };
// commit-marker-7
// commit-marker-18
// commit-marker-48
// commit-marker-59
