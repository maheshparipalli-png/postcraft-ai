import { GoogleGenAI } from "@google/genai";
import type { AIGenerateOptions, AIProvider } from "./types";

function getGeminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  return {
    apiKey,
    model: process.env.GEMINI_MODEL ?? "gemini-3.6-flash",
  };
}

export const geminiProvider: AIProvider = {
  async generateText(prompt, options: AIGenerateOptions = {}) {
    const { apiKey, model } = getGeminiConfig();
    const ai = new GoogleGenAI({ apiKey });

    const config: Record<string, unknown> = {
      temperature: options.temperature ?? 0.78,
      maxOutputTokens: options.numPredict ?? 400,
    };

    if (options.format) {
      config.responseMimeType = "application/json";
    }

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config,
    });

    const text = response.text;

    if (typeof text !== "string" || !text.trim()) {
      throw new Error("Gemini returned an empty response");
    }

    return text.trim();
  },

  async generateTextStream(prompt, options: AIGenerateOptions = {}, onToken) {
    const text = await this.generateText(prompt, options);
    onToken(text);
    return text;
  },
};

