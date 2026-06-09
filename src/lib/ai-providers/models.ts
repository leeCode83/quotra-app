/**
 * Supported AI models and provider definitions for Quotra.
 * Replaces src/lib/venice/models.ts
 *
 * All providers (OpenAI, Anthropic, Google) require credit card billing
 * to obtain an API key — which is exactly the barrier Quotra helps bypass
 * for consumers via USDC per-call payments.
 */

export type AIProvider = "openai" | "anthropic" | "google";

export interface SupportedModel {
  id: string;
  name: string;
  provider: AIProvider;
}

export const SUPPORTED_MODELS: SupportedModel[] = [
  // OpenAI — requires credit card for API access
  { id: "gpt-4o",       name: "GPT-4o",        provider: "openai" },
  { id: "gpt-4o-mini",  name: "GPT-4o Mini",   provider: "openai" },
  { id: "gpt-4-turbo",  name: "GPT-4 Turbo",   provider: "openai" },

  // Anthropic — requires credit card for API access
  { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", provider: "anthropic" },
  { id: "claude-3-5-haiku-20241022",  name: "Claude 3.5 Haiku",  provider: "anthropic" },
  { id: "claude-3-opus-20240229",     name: "Claude 3 Opus",     provider: "anthropic" },

  // Google Gemini — requires credit card for API access
  { id: "gemini-1.5-pro",   name: "Gemini 1.5 Pro",   provider: "google" },
  { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash",  provider: "google" },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash",  provider: "google" },
];

/**
 * Returns the full model metadata for a given model ID.
 */
export function getModelInfo(modelId: string): SupportedModel | undefined {
  return SUPPORTED_MODELS.find((m) => m.id === modelId);
}

/**
 * Returns true if the given model ID has no spaces, allowing custom models.
 */
export function isValidModel(modelId: string): boolean {
  return /^\S+$/.test(modelId);
}

/**
 * Returns the AI provider for a given model ID, or undefined if not found.
 */
export function getProviderForModel(modelId: string): AIProvider | undefined {
  if (modelId.startsWith("openai/")) return "openai";
  if (modelId.startsWith("anthropic/")) return "anthropic";
  if (modelId.startsWith("google/")) return "google";

  const exactMatch = getModelInfo(modelId)?.provider;
  if (exactMatch) return exactMatch;

  const lower = modelId.toLowerCase();
  if (lower.startsWith("gpt-") || lower.startsWith("o1") || lower.startsWith("o3")) return "openai";
  if (lower.startsWith("claude-")) return "anthropic";
  if (lower.startsWith("gemini-") || lower.startsWith("learnlm-")) return "google";
  
  return undefined;
}

/**
 * Returns the full list of supported models (for use in UI dropdowns etc).
 */
export function getSupportedModels(): SupportedModel[] {
  return SUPPORTED_MODELS;
}
