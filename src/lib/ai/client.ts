/**
 * Shared Perplexity AI client helpers.
 *
 * Server-side only — reads PERPLEXITY_API_KEY / AI_MODEL from the environment and
 * must never run in the browser. Uses Perplexity's OpenAI-compatible API.
 */

/** Thrown when the Perplexity API key isn't configured. Lets callers no-op cleanly. */
export class AiConfigError extends Error {}

/** Default model — override with PERPLEXITY_MODEL or AI_MODEL. */
const DEFAULT_MODEL = "sonar";

/** Resolve the configured model, preferring PERPLEXITY_MODEL or AI_MODEL (ignoring legacy claude-* names). */
export function resolveModel(): string {
  if (process.env.PERPLEXITY_MODEL) return process.env.PERPLEXITY_MODEL;
  if (process.env.AI_MODEL && !process.env.AI_MODEL.startsWith("claude")) {
    return process.env.AI_MODEL;
  }
  return DEFAULT_MODEL;
}

/** Get configured API key (supports PERPLEXITY_API_KEY with fallbacks). */
export function getApiKey(): string | undefined {
  return (
    process.env.PERPLEXITY_API_KEY ||
    process.env.AI_API_KEY ||
    process.env.ANTHROPIC_API_KEY
  );
}

/** True when AI generation is available (key present). Safe to call anywhere. */
export function isAiConfigured(): boolean {
  return Boolean(getApiKey());
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface PerplexityCompletionOptions {
  model?: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
  jsonSchema?: Record<string, any>;
}

/**
 * Calls Perplexity AI Chat Completions API via standard fetch.
 */
export async function callPerplexity(
  options: PerplexityCompletionOptions,
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new AiConfigError(
      "Missing PERPLEXITY_API_KEY. Set it in your environment to enable AI generation.",
    );
  }

  const model = options.model || resolveModel();
  const payload: Record<string, any> = {
    model,
    messages: options.messages,
    max_tokens: options.maxTokens || 2048,
    temperature: options.temperature ?? 0.2,
  };

  if (options.jsonSchema) {
    payload.response_format = {
      type: "json_schema",
      json_schema: { schema: options.jsonSchema },
    };
  }

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 429 && attempt < maxRetries) {
      console.warn(`[perplexity] Rate limit 429 hit. Retrying in ${attempt * 1.5}s (attempt ${attempt}/${maxRetries})...`);
      await sleep(attempt * 1500);
      continue;
    }

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      throw new Error(
        `Perplexity API error (HTTP ${res.status}): ${errorBody || res.statusText}`,
      );
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== "string") {
      throw new Error("Perplexity API returned empty response content.");
    }

    return text;
  }

  throw new Error("Perplexity API request failed after retries.");
}

/**
 * Tolerant JSON parser for AI outputs: parses raw strings, markdown fenced JSON,
 * or outermost object/array spans.
 */
export function parseJsonResponse<T>(rawOrResponse: any): T {
  let raw = "";
  if (typeof rawOrResponse === "string") {
    raw = rawOrResponse;
  } else if (rawOrResponse && typeof rawOrResponse === "object") {
    const textBlock = rawOrResponse.content?.find?.((b: any) => b.type === "text");
    raw =
      textBlock?.text ||
      rawOrResponse.choices?.[0]?.message?.content ||
      JSON.stringify(rawOrResponse);
  }

  const candidates: string[] = [];
  const trimmed = raw.trim();
  candidates.push(trimmed);

  // ```json ... ``` or ``` ... ``` fenced block
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) candidates.push(fence[1].trim());

  // Outermost object or array span
  const objStart = trimmed.indexOf("{");
  const objEnd = trimmed.lastIndexOf("}");
  if (objStart !== -1 && objEnd > objStart) {
    candidates.push(trimmed.slice(objStart, objEnd + 1));
  }
  const arrStart = trimmed.indexOf("[");
  const arrEnd = trimmed.lastIndexOf("]");
  if (arrStart !== -1 && arrEnd > arrStart) {
    candidates.push(trimmed.slice(arrStart, arrEnd + 1));
  }

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate) as T;
    } catch {
      /* try next candidate */
    }
  }

  throw new Error(`AI returned non-JSON output: ${raw.slice(0, 200)}`);
}
