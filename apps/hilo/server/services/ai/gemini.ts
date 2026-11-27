import 'server-only';
import { GoogleGenAI, ThinkingLevel, type GenerateContentConfig } from '@google/genai';

let client: GoogleGenAI | undefined;

function ai(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export function geminiModel(): string {
  return process.env.GEMINI_MODEL || 'gemini-flash-latest';
}

// Set when the model rejects a setting, so later calls skip it.
let searchUnsupported = false;
let thinkingUnsupported = false;

/**
 * Asks Gemini for JSON matching `schema`, grounded in Google Search so answers about distances,
 * populations and the like are current. Falls back to no search or default thinking if the model
 * rejects either.
 */
export async function generateJson(prompt: string, schema: object): Promise<unknown> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const config: GenerateContentConfig = {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseJsonSchema: schema,
    };
    if (!searchUnsupported) config.tools = [{ googleSearch: {} }];
    if (!thinkingUnsupported) config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };

    try {
      const response = await ai().models.generateContent({
        model: geminiModel(),
        contents: prompt,
        config,
      });
      return parseJson(response.text ?? '');
    } catch (error) {
      const message = String(error);
      if (!thinkingUnsupported && /thinking/i.test(message)) {
        thinkingUnsupported = true;
      } else if (!searchUnsupported && /tool|search|json|mime/i.test(message)) {
        searchUnsupported = true;
      } else {
        throw error;
      }
      console.warn(`[hilo] Gemini rejected a setting, retrying without it: ${message}`);
    }
  }
  throw new Error('Gemini call failed');
}

function parseJson(text: string): unknown {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/, '')
    .trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error(`No JSON in Gemini response: ${text}`);
  return JSON.parse(trimmed.slice(start, end + 1));
}
