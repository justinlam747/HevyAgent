import OpenAI from "openai";
import fs from "fs";
import path from "path";

export interface VectorDocument {
  id: string;
  text: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

interface VectorDBState {
  documents: VectorDocument[];
  version: number;
}

const DB_DIR = path.join(process.cwd(), ".vectordb");
const DB_FILE = path.join(DB_DIR, "store.json");

// Singleton cache — avoid re-reading from disk on every request
let cachedState: VectorDBState | null = null;

function cosine(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

function loadState(): VectorDBState {
  if (cachedState) return cachedState;
  try {
    if (fs.existsSync(DB_FILE)) {
      cachedState = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
      return cachedState!;
    }
  } catch {
    // corrupted file, start fresh
  }
  cachedState = { documents: [], version: 1 };
  return cachedState;
}

function saveState(state: VectorDBState) {
  cachedState = state;
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(state));
  } catch (err) {
    console.error("[vectordb] Failed to persist:", (err as Error).message);
  }
}

export class VectorDB {
  private state: VectorDBState;
  private openai: OpenAI;

  constructor(openaiKey: string) {
    this.state = loadState();
    this.openai = new OpenAI({ apiKey: openaiKey });
  }

  get size(): number {
    return this.state.documents.length;
  }

  private async embed(texts: string[]): Promise<number[][]> {
    const res = await this.openai.embeddings.create({
      model: "text-embedding-3-small",
      input: texts,
    });
    return res.data.map((d) => d.embedding);
  }

  private async embedQuery(text: string): Promise<number[]> {
    const vecs = await this.embed([text]);
    return vecs[0];
  }

  async upsert(docs: { id: string; text: string; metadata: Record<string, unknown> }[]): Promise<number> {
    const ids = new Set(docs.map((d) => d.id));
    this.state.documents = this.state.documents.filter((d) => !ids.has(d.id));

    const texts = docs.map((d) => d.text);
    const vectors = await this.embed(texts);

    for (let i = 0; i < docs.length; i++) {
      this.state.documents.push({
        id: docs[i].id,
        text: docs[i].text,
        embedding: vectors[i],
        metadata: docs[i].metadata,
      });
    }

    this.state.version++;
    saveState(this.state);
    return docs.length;
  }

  async query(
    text: string,
    topK = 5,
    filter?: (meta: Record<string, unknown>) => boolean
  ): Promise<{ document: VectorDocument; score: number }[]> {
    const queryVec = await this.embedQuery(text);

    let candidates = this.state.documents;
    if (filter) {
      candidates = candidates.filter((d) => filter(d.metadata));
    }

    const scored = candidates.map((doc) => ({
      document: doc,
      score: cosine(queryVec, doc.embedding),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  clear() {
    this.state = { documents: [], version: 1 };
    saveState(this.state);
  }

  getByMetadata(key: string, value: unknown): VectorDocument[] {
    return this.state.documents.filter((d) => d.metadata[key] === value);
  }
}
