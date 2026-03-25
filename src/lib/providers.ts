export type Provider = "claude" | "openai" | "gemini";

export interface ProviderConfig {
  id: Provider;
  name: string;
  placeholder: string;
  models: string[];
  defaultModel: string;
}

export const PROVIDERS: Record<Provider, ProviderConfig> = {
  claude: {
    id: "claude",
    name: "Claude",
    placeholder: "sk-ant-...",
    models: ["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"],
    defaultModel: "claude-sonnet-4-20250514",
  },
  openai: {
    id: "openai",
    name: "ChatGPT",
    placeholder: "sk-...",
    models: ["gpt-4o", "gpt-4o-mini"],
    defaultModel: "gpt-4o",
  },
  gemini: {
    id: "gemini",
    name: "Gemini",
    placeholder: "AIza...",
    models: ["gemini-2.5-flash", "gemini-2.5-pro"],
    defaultModel: "gemini-2.5-flash",
  },
};

const STORAGE_KEY = "chevy_provider";

export function getSavedProvider(): { provider: Provider; apiKey: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveProvider(provider: Provider, apiKey: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ provider, apiKey }));
}

export function clearProvider() {
  localStorage.removeItem(STORAGE_KEY);
}
