import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import pLimit from "p-limit";
import pRetry from "p-retry";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

const gemini = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL!,
  },
});

function isRateLimitError(error: any): boolean {
  const errorMsg = error?.message || String(error);
  return (
    errorMsg.includes("429") ||
    errorMsg.includes("RATELIMIT_EXCEEDED") ||
    errorMsg.toLowerCase().includes("quota") ||
    errorMsg.toLowerCase().includes("rate limit")
  );
}

export async function generateRecipeRecommendations(
  availableIngredients: string[],
  costConstraint?: number
): Promise<string> {
  try {
    const response = await pRetry(
      async () => {
        try {
          const completion = await openai.chat.completions.create({
            model: "gpt-5",
            messages: [
              {
                role: "user",
                content: `Given these available ingredients: ${availableIngredients.join(", ")}, suggest 3 creative coffee shop recipes${costConstraint ? ` with an estimated cost under $${costConstraint}` : ""}. Focus on popular cafe items like lattes, pastries, and light meals.`
              }
            ],
            max_completion_tokens: 8192,
          });
          return completion.choices[0]?.message?.content || "";
        } catch (error: any) {
          if (isRateLimitError(error)) {
            throw error;
          }
          throw new pRetry.AbortError(error);
        }
      },
      {
        retries: 7,
        minTimeout: 2000,
        maxTimeout: 128000,
        factor: 2,
      }
    );
    return response;
  } catch (error) {
    console.error("Error generating recipe recommendations:", error);
    throw error;
  }
}

export async function analyzePricingStrategy(
  recipeName: string,
  totalCost: number,
  currentPrice?: number
): Promise<string> {
  try {
    const response = await pRetry(
      async () => {
        try {
          const result = await gemini.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Analyze the pricing strategy for this coffee shop item:
Recipe: ${recipeName}
Cost of Goods Sold (COGS): $${totalCost.toFixed(2)}
${currentPrice ? `Current Price: $${currentPrice.toFixed(2)}` : ""}

Provide pricing recommendations considering:
1. Industry standard markup (2.5x-3.5x for cafes)
2. Competitive positioning
3. Perceived value
4. Target profit margins

Give specific price recommendations and justify them.`
          });
          return result.text || "";
        } catch (error: any) {
          if (isRateLimitError(error)) {
            throw error;
          }
          throw new pRetry.AbortError(error);
        }
      },
      {
        retries: 7,
        minTimeout: 2000,
        maxTimeout: 128000,
        factor: 2,
      }
    );
    return response;
  } catch (error) {
    console.error("Error analyzing pricing strategy:", error);
    throw error;
  }
}

export async function generateCostOptimizationSuggestions(
  recipes: Array<{ name: string; cost: number; ingredients: string[] }>
): Promise<string> {
  try {
    const recipeSummary = recipes
      .map((r) => `${r.name}: $${r.cost.toFixed(2)} (${r.ingredients.join(", ")})`)
      .join("\n");

    const response = await pRetry(
      async () => {
        try {
          const result = await gemini.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Analyze these coffee shop recipes and provide cost optimization suggestions:

${recipeSummary}

Suggest ways to:
1. Reduce costs without sacrificing quality
2. Identify expensive ingredients that could be substituted
3. Recommend bulk purchasing strategies
4. Highlight recipes with best profit margins
5. Suggest seasonal menu adjustments`
          });
          return result.text || "";
        } catch (error: any) {
          if (isRateLimitError(error)) {
            throw error;
          }
          throw new pRetry.AbortError(error);
        }
      },
      {
        retries: 7,
        minTimeout: 2000,
        maxTimeout: 128000,
        factor: 2,
      }
    );
    return response;
  } catch (error) {
    console.error("Error generating cost optimization suggestions:", error);
    throw error;
  }
}
