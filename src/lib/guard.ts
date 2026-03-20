// Prompt injection detection and input sanitization

const INJECTION_PATTERNS = [
  // Direct instruction overrides
  /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions|prompts|rules)/i,
  /disregard\s+(all\s+)?(previous|above|prior)/i,
  /forget\s+(all\s+)?(previous|above|prior)\s+(instructions|context)/i,
  /you\s+are\s+now\s+(?:a|an)\s+/i,
  /new\s+instructions?\s*:/i,
  /system\s*prompt\s*:/i,
  /\bact\s+as\b/i,
  /\brole\s*play\b/i,

  // Delimiter injection
  /```\s*(system|assistant)\b/i,
  /<\s*\/?system\s*>/i,
  /\[INST\]/i,
  /\[\/INST\]/i,
  /<<\s*SYS\s*>>/i,

  // Data exfiltration attempts
  /repeat\s+(the\s+)?(system|initial|original)\s+(prompt|message|instructions)/i,
  /what\s+(are|is)\s+(your|the)\s+(system|initial)\s+(prompt|instructions|message)/i,
  /show\s+(me\s+)?(your|the)\s+prompt/i,
  /reveal\s+(your|the)\s+(system|hidden)/i,
  /output\s+(your|the)\s+(system|initial)\s+prompt/i,

  // Code execution attempts
  /eval\s*\(/i,
  /exec\s*\(/i,
  /import\s+(os|subprocess|sys)\b/i,
  /__import__/i,
];

// Patterns that are suspicious but not blocking (flag for logging)
const SUSPICIOUS_PATTERNS = [
  /\bpretend\b/i,
  /\bjailbreak\b/i,
  /\bbypass\b/i,
  /\bDAN\b/,
  /do\s+anything\s+now/i,
  /\bunfiltered\b/i,
];

export interface GuardResult {
  safe: boolean;
  blocked: boolean;
  reason?: string;
  suspicious: boolean;
  flags: string[];
}

export function guardInput(input: string): GuardResult {
  const flags: string[] = [];

  // Check for injection attempts
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return {
        safe: false,
        blocked: true,
        reason: "Input contains disallowed patterns.",
        suspicious: true,
        flags: ["injection_attempt"],
      };
    }
  }

  // Check for suspicious patterns (allow but flag)
  let suspicious = false;
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(input)) {
      suspicious = true;
      flags.push("suspicious_language");
      break;
    }
  }

  // Check for excessive special characters (encoding attacks)
  const specialRatio = (input.match(/[^\w\s.,!?'"()-]/g) || []).length / input.length;
  if (specialRatio > 0.3 && input.length > 20) {
    return {
      safe: false,
      blocked: true,
      reason: "Input contains too many special characters.",
      suspicious: true,
      flags: ["encoding_attack"],
    };
  }

  // Check for extremely repetitive content (resource waste)
  const words = input.toLowerCase().split(/\s+/);
  if (words.length > 10) {
    const unique = new Set(words);
    if (unique.size / words.length < 0.2) {
      return {
        safe: false,
        blocked: true,
        reason: "Input is too repetitive.",
        suspicious: true,
        flags: ["repetition_attack"],
      };
    }
  }

  return { safe: true, blocked: false, suspicious, flags };
}

// Sanitize output to prevent leaking system context
export function sanitizeOutput(output: string): string {
  // Strip any accidentally leaked system prompt fragments
  let cleaned = output;

  // Remove anything that looks like internal tool output markers
  cleaned = cleaned.replace(/\[hevy\]\s*\/v1\/.*/g, "");

  // Remove any file paths that might leak server structure
  cleaned = cleaned.replace(/[A-Z]:\\[^\s]+/g, "[path]");
  cleaned = cleaned.replace(/\/(?:home|var|usr|etc|tmp)\/[^\s]+/g, "[path]");

  return cleaned;
}

// Estimate token count (rough: 1 token ≈ 4 chars for English)
export function estimateTokens(messages: { content: string }[]): number {
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  // Add overhead for system prompt + tool definitions (~2000 tokens)
  return Math.ceil(totalChars / 4) + 2000;
}
// commit-marker-2
