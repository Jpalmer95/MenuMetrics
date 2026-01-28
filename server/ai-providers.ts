import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import pRetry from "p-retry";

// AI Provider Integration using Replit AI Integrations
// OpenAI, Gemini, and OpenRouter (for various models) are available via Replit AI Integrations
// No API keys required - charges billed to Replit credits

export type AIProvider = "openai" | "gemini" | "grok" | "claude" | "llama" | "mistral" | "deepseek" | "huggingface" | "ollama";

// OpenRouter model mappings for different providers (verified from OpenRouter API)
export const openRouterModels: Record<string, string> = {
  "grok": "x-ai/grok-4.1-fast",
  "claude": "anthropic/claude-haiku-4.5",
  "llama": "meta-llama/llama-3.3-70b-instruct",
  "mistral": "mistralai/mistral-large-2512",
  "deepseek": "deepseek/deepseek-v3.2",
};

export const providerDisplayNames: Record<string, string> = {
  "openai": "OpenAI GPT-5",
  "gemini": "Google Gemini 2.5 Flash",
  "grok": "Grok (xAI)",
  "claude": "Claude Haiku (Anthropic)",
  "llama": "Llama 3.3 70B (Meta)",
  "mistral": "Mistral Large",
  "deepseek": "DeepSeek V3",
  "huggingface": "HuggingFace (Custom)",
  "ollama": "Ollama (Local)",
};

interface AIRequest {
  provider: AIProvider;
  prompt: string;
  systemPrompt?: string;
  customApiKey?: string;
  imageUrl?: string; // Optional image URL for vision requests
  // Ollama-specific settings
  ollamaUrl?: string;
  ollamaModel?: string;
}

function isRateLimitError(error: any): boolean {
  const errorMsg = error?.message || String(error);
  return (
    errorMsg.includes("429") ||
    errorMsg.includes("RATELIMIT_EXCEEDED") ||
    errorMsg.toLowerCase().includes("quota") ||
    errorMsg.toLowerCase().includes("rate limit")
  );
}

export async function callAI(request: AIRequest): Promise<string> {
  return pRetry(
    async () => {
      try {
        switch (request.provider) {
          case "openai":
            return await callOpenAI(request);
          case "gemini":
            return await callGemini(request);
          case "grok":
          case "claude":
          case "llama":
          case "mistral":
          case "deepseek":
            return await callOpenRouter(request);
          case "huggingface":
            return await callHuggingFace(request);
          case "ollama":
            return await callOllama(request);
          default:
            throw new Error(`Unsupported provider: ${request.provider}`);
        }
      } catch (error: any) {
        console.error(`AI provider ${request.provider} error:`, error);
        if (isRateLimitError(error)) {
          throw error;
        }
        const abortError: any = new Error(error.message || "Non-retryable error");
        abortError.name = "AbortError";
        abortError.originalError = error;
        throw abortError;
      }
    },
    {
      retries: 7,
      minTimeout: 2000,
      maxTimeout: 128000,
      factor: 2,
    }
  );
}

async function callOpenAI(request: AIRequest): Promise<string> {
  // Using Replit AI Integrations for OpenAI - no API key required
  const client = new OpenAI({
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  });

  const messages: any[] = [];
  if (request.systemPrompt) {
    messages.push({ role: "system", content: request.systemPrompt });
  }
  
  // Support vision if image URL provided
  if (request.imageUrl) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: request.prompt },
        { type: "image_url", image_url: { url: request.imageUrl } }
      ]
    });
  } else {
    messages.push({ role: "user", content: request.prompt });
  }

  const response = await client.chat.completions.create({
    model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
    messages,
    max_completion_tokens: 8192,
  });

  return response.choices[0]?.message?.content || "";
}

async function callGemini(request: AIRequest): Promise<string> {
  // Using Replit AI Integrations for Gemini - no API key required
  const ai = new GoogleGenAI({
    apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
    httpOptions: {
      apiVersion: "",
      baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
    },
  });

  let prompt = request.prompt;
  if (request.systemPrompt) {
    prompt = `${request.systemPrompt}\n\n${request.prompt}`;
  }

  // Support vision if image URL provided
  if (request.imageUrl) {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { text: prompt },
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: request.imageUrl.split(",")[1] || request.imageUrl, // Handle base64 data URLs
          },
        },
      ],
    });
    return response.text || "";
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  return response.text || "";
}

async function callOpenRouter(request: AIRequest): Promise<string> {
  // Using Replit AI Integrations for OpenRouter - no API key required
  // Supports: Grok, Claude, Llama, Mistral, DeepSeek and more
  const client = new OpenAI({
    baseURL: process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL,
    apiKey: process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY,
  });

  const messages: any[] = [];
  if (request.systemPrompt) {
    messages.push({ role: "system", content: request.systemPrompt });
  }
  messages.push({ role: "user", content: request.prompt });

  // Get the correct model for this provider
  const model = openRouterModels[request.provider] || "x-ai/grok-2-1212";

  const response = await client.chat.completions.create({
    model,
    messages,
    max_tokens: 8192,
  });

  return response.choices[0]?.message?.content || "";
}

async function callHuggingFace(request: AIRequest): Promise<string> {
  if (!request.customApiKey) {
    throw new Error("HuggingFace requires an API key. Please provide your HuggingFace Access Token.");
  }

  const response = await fetch(
    "https://router.huggingface.co/hf-inference/models/meta-llama/Llama-3.3-70B-Instruct",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${request.customApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: request.systemPrompt
          ? `${request.systemPrompt}\n\n${request.prompt}`
          : request.prompt,
        parameters: {
          max_new_tokens: 8192,
          temperature: 0.7,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HuggingFace API error: ${error}`);
  }

  const data = await response.json();
  return data[0]?.generated_text || "";
}

async function callOllama(request: AIRequest): Promise<string> {
  const baseUrl = request.ollamaUrl || "http://localhost:11434";
  const model = request.ollamaModel || "llama3";

  if (!baseUrl) {
    throw new Error("Ollama requires a URL. Please configure your Ollama server URL in settings.");
  }

  // Validate URL for SSRF protection
  const validation = isValidOllamaUrl(baseUrl);
  if (!validation.valid) {
    throw new Error(validation.error || "Invalid Ollama URL");
  }

  const messages: Array<{ role: string; content: string }> = [];
  if (request.systemPrompt) {
    messages.push({ role: "system", content: request.systemPrompt });
  }
  messages.push({ role: "user", content: request.prompt });

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error("Ollama API error: Check that the model is installed and Ollama is running.");
  }

  const data = await response.json();
  return data.message?.content || "";
}

// Validate Ollama URL to prevent SSRF - only allow localhost/127.0.0.1/::1
export function isValidOllamaUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);
    
    // Only allow http or https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: "Only HTTP and HTTPS protocols are allowed" };
    }
    
    // Only allow localhost addresses for security (SSRF protection)
    const allowedHosts = ['localhost', '127.0.0.1', '::1', '[::1]'];
    const hostname = parsed.hostname.toLowerCase();
    
    if (!allowedHosts.includes(hostname)) {
      return { 
        valid: false, 
        error: "For security reasons, Ollama URL must be localhost (127.0.0.1, ::1, or localhost)" 
      };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: "Invalid URL format" };
  }
}

// Test Ollama connection - exported for use in routes
export async function testOllamaConnection(url: string, model?: string): Promise<{ success: boolean; models?: string[]; error?: string }> {
  // Validate URL for SSRF protection
  const validation = isValidOllamaUrl(url);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  try {
    // First, try to list available models
    const tagsResponse = await fetch(`${url}/api/tags`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!tagsResponse.ok) {
      return { success: false, error: "Cannot connect to Ollama server. Make sure Ollama is running." };
    }

    const tagsData = await tagsResponse.json();
    const availableModels = tagsData.models?.map((m: any) => m.name) || [];

    // If a model is specified, check if it exists
    if (model && !availableModels.some((m: string) => m.startsWith(model))) {
      return { 
        success: false, 
        models: availableModels, 
        error: `Model "${model}" not found. Available models: ${availableModels.join(", ")}` 
      };
    }

    return { success: true, models: availableModels };
  } catch (error: any) {
    // Don't expose internal error details
    return { success: false, error: "Failed to connect to Ollama. Check that the server is running and accessible." };
  }
}
