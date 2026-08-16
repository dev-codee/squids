/**
 * Shared Anthropic (Claude) client helpers.
 *
 * Server-side only — reads ANTHROPIC_API_KEY / AI_MODEL from the environment and
 * must never run in the browser.
 */

import Anthropic from "@anthropic-ai/sdk";

/** Thrown when the Anthropic API key isn't configured. Lets callers no-op cleanly. */
export class AiConfigError extends Error {}

/** Default model — override with AI_MODEL (or ANTHROPIC_MODEL). */
const DEFAULT_MODEL = "claude-opus-4-8";

/** Resolve the configured model, preferring AI_MODEL. */
export function resolveModel(): string {
  return process.env.AI_MODEL || process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
}

/** True when AI generation is available (key present). Safe to call anywhere. */
export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let cachedClient: Anthropic | null = null;

/** Lazily construct the Anthropic client, throwing AiConfigError if unconfigured. */
export function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AiConfigError(
      "Missing ANTHROPIC_API_KEY. Set it to enable AI generation.",
    );
  }
  if (!cachedClient) cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

/**
 * Read the single text block of a Claude response and JSON-parse it. Tolerant of
 * models that wrap JSON in ```` ```json ```` fences or add surrounding prose:
 * strips fences and falls back to the outermost `{...}` / `[...]` span.
 */
export function parseJsonResponse<T>(response: Anthropic.Message): T {
  const textBlock = response.content.find((b) => b.type === "text");
  const raw = textBlock && "text" in textBlock ? textBlock.text : "";

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
