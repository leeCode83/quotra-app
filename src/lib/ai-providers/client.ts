/**
 * Unified AI provider client for Quotra using Vercel AI SDK.
 * Replaces src/lib/venice/client.ts
 *
 * Supports OpenAI, Anthropic, and Google Gemini via dynamic
 * provider factory — API key is injected per-request from the
 * listing's decrypted key (never stored in env).
 */

import { generateText } from "ai";
import type { ModelMessage, LanguageModelUsage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { getProviderForModel } from "./models";

// Default max output tokens if not specified by consumer or listing
const DEFAULT_MAX_OUTPUT_TOKENS = 1500;

export class AIProviderError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}

export interface AICallRequest {
  /** Model ID from listing (e.g. "gpt-4o-mini", "claude-3-5-haiku-20241022") */
  modelId: string;
  /** Decrypted API key from listing's AES-256-GCM encrypted key */
  apiKey: string;
  /** Main user message (required) */
  chat: string;
  /** Optional system prompt to prepend */
  systemPrompt?: string;
  /** Max completion tokens. Capped by listing.max_completion_tokens upstream. Default: 1500 */
  maxOutputTokens?: number;
}

export interface AICallResponse {
  /** The text completion returned by the AI */
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Calls the appropriate AI provider using Vercel AI SDK generateText.
 * Provider is determined automatically from the model ID.
 * API key is injected dynamically — no global env vars used for the key.
 */
export async function callAIProvider(req: AICallRequest): Promise<AICallResponse> {
  const { modelId, apiKey, chat, systemPrompt, maxOutputTokens } = req;

  const provider = getProviderForModel(modelId);
  if (!provider) {
    throw new AIProviderError(`Unsupported model: ${modelId}`, 400, "UNSUPPORTED_MODEL");
  }

  // Build messages array — system prompt first if provided
  const messages: ModelMessage[] = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: chat });

  const maxTokens = maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;

  try {
    // Dynamic provider factory: instantiated per-request with consumer's decrypted key
    let model;
    if (provider === "openai") {
      model = createOpenAI({ apiKey })(modelId);
    } else if (provider === "anthropic") {
      model = createAnthropic({ apiKey })(modelId);
    } else {
      // provider === "google"
      model = createGoogleGenerativeAI({ apiKey })(modelId);
    }

    const result = await generateText({
      model,
      messages,
      maxOutputTokens: maxTokens,
      abortSignal: AbortSignal.timeout(30_000), // 30s hard timeout
    });

    // AI SDK v6: usage fields are input_tokens / output_tokens (or may vary by provider)
    const usage = result.usage as LanguageModelUsage & Record<string, number | undefined>;
    const promptTokens = usage.inputTokens ?? usage.promptTokens ?? 0;
    const completionTokens = usage.outputTokens ?? usage.completionTokens ?? 0;

    return {
      text: result.text,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
    };
  } catch (error) {
    // Re-throw if already our error type
    if (error instanceof AIProviderError) throw error;

    const err = error as Error & { status?: number; statusCode?: number };

    // Handle timeout from AbortSignal
    if (err.name === "AbortError" || err.name === "TimeoutError") {
      throw new AIProviderError("AI provider request timed out", 504, "AI_TIMEOUT");
    }

    // Map HTTP status codes from provider responses
    const status = err.status ?? err.statusCode ?? 502;
    let code = "AI_PROVIDER_ERROR";
    if (status === 401 || status === 403) code = "AI_KEY_INVALID";
    if (status === 429) code = "AI_RATE_LIMITED";

    throw new AIProviderError(err.message || "AI provider error", status, code);
  }
}
