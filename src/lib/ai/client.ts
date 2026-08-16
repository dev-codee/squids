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

/** Read the single text block of a structured-output response and JSON-parse it. */
export function parseJsonResponse<T>(response: Anthropic.Message): T {
  const textBlock = response.content.find((b) => b.type === "text");
  const raw = textBlock && "text" in textBlock ? textBlock.text : "";
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`AI returned non-JSON output: ${raw.slice(0, 200)}`);
  }
}
