const VENICE_API_BASE_URL = "https://api.venice.ai/api/v1";

export class VeniceError extends Error {
  constructor(message: string, public status: number, public code: string) {
    super(message);
    this.name = "VeniceError";
  }
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface VeniceChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  venice_parameters?: {
    include_venice_system_prompt?: boolean;
  };
}

export interface VeniceChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function callChatCompletion(
  apiKey: string,
  body: VeniceChatRequest
): Promise<VeniceChatResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const response = await fetch(`${VENICE_API_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        ...body,
        venice_parameters: {
          include_venice_system_prompt: false,
          ...body.venice_parameters,
        }
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.error?.message || response.statusText || "Venice AI API Error";
      let code = "VENICE_AI_ERROR";
      if (response.status === 401) code = "VENICE_KEY_INVALID";
      if (response.status === 429) code = "VENICE_RATE_LIMITED";
      
      throw new VeniceError(message, response.status, code);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new VeniceError("Venice AI request timed out", 504, "VENICE_TIMEOUT");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
