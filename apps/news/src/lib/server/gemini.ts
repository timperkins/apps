import "server-only";
import { GoogleGenAI, ThinkingLevel, type GenerateContentConfig, type GenerateContentResponse } from "@google/genai";
import { geminiModel, geminiThinking } from "../config";
import { logTiming } from "./timing";

let client: GoogleGenAI | undefined;

function ai(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export interface GroundedResult {
  text: string;
  /** Source pages Google Search returned for this answer (redirect links until resolved). */
  sources: { uri: string; title: string }[];
}

function sourcesOf(response: GenerateContentResponse): GroundedResult["sources"] {
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const out: GroundedResult["sources"] = [];
  for (const chunk of chunks) {
    if (chunk.web?.uri) out.push({ uri: chunk.web.uri, title: chunk.web.title ?? "" });
  }
  return out;
}

// Set when the model rejects a thinking level, so later calls skip it.
let thinkingUnsupported = false;

function thinkingConfig(): GenerateContentConfig["thinkingConfig"] {
  const level = geminiThinking();
  if (!level || thinkingUnsupported) return undefined;
  return { thinkingLevel: level as ThinkingLevel };
}

/**
 * One Gemini call grounded in Google Search. `logFields` label its timing log line.
 * Thinking is capped (GEMINI_THINKING, default low) to shorten each call, which runs ~30s at the model default.
 */
export async function groundedGenerate(prompt: string, logFields: Record<string, unknown> = {}): Promise<GroundedResult> {
  const model = geminiModel();
  const start = Date.now();
  const config: GenerateContentConfig = { tools: [{ googleSearch: {} }], temperature: 0.4 };
  try {
    const thinking = thinkingConfig();
    let response: GenerateContentResponse;
    try {
      response = await ai().models.generateContent({ model, contents: prompt, config: { ...config, thinkingConfig: thinking } });
    } catch (error) {
      // Older models don't take a thinking level; fall back to their default thinking.
      if (!thinking || !/thinking/i.test(String(error))) throw error;
      console.warn(`[tim-news] ${model} rejected thinking level ${thinking.thinkingLevel}; using its default`);
      thinkingUnsupported = true;
      response = await ai().models.generateContent({ model, contents: prompt, config });
    }
    const usage = response.usageMetadata;
    const sources = sourcesOf(response);
    logTiming("gemini", {
      ...logFields,
      model,
      modelVersion: response.modelVersion,
      thinking: thinkingUnsupported ? "default" : (thinking?.thinkingLevel ?? "default"),
      ms: Date.now() - start,
      ok: true,
      promptTokens: usage?.promptTokenCount,
      toolPromptTokens: usage?.toolUsePromptTokenCount,
      thoughtTokens: usage?.thoughtsTokenCount,
      outputTokens: usage?.candidatesTokenCount,
      searchQueries: response.candidates?.[0]?.groundingMetadata?.webSearchQueries?.length ?? 0,
      groundingLinks: sources.length,
    });
    return { text: response.text ?? "", sources };
  } catch (error) {
    logTiming("gemini", { ...logFields, model, ms: Date.now() - start, ok: false });
    throw error;
  }
}

/** Streams a grounded answer. Sources arrive with the final chunks. */
export async function* groundedStream(
  prompt: string,
): AsyncGenerator<{ text: string; sources: GroundedResult["sources"] }> {
  const stream = await ai().models.generateContentStream({
    model: geminiModel(),
    contents: prompt,
    config: { tools: [{ googleSearch: {} }], temperature: 0.5 },
  });
  for await (const chunk of stream) {
    yield { text: chunk.text ?? "", sources: sourcesOf(chunk) };
  }
}
