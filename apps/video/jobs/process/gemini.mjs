// Indexes one clip's proxy with Gemini: uploads it to the Files API, asks for labeled segments
// as JSON, and deletes the upload afterwards.
import { GoogleGenAI, MediaResolution, ThinkingLevel, createPartFromUri } from "@google/genai";
import { INDEX_PROMPT_VERSION, cleanSegments, indexPrompt, indexSchema } from "./lib.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function indexModel() {
  return process.env.INDEX_MODEL || "gemini-flash-latest";
}

/**
 * Returns { summary, segments, model, modelVersion, promptVersion, tokens } for the proxy at
 * `file`. `clip` gives the prompt its context: durationSec, fileName, projectName, projectNotes,
 * and the scene changes used to snap segment boundaries.
 */
export async function indexClip(file, clip) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  const ai = new GoogleGenAI({ apiKey });
  const model = indexModel();

  let uploaded = await ai.files.upload({ file, config: { mimeType: "video/mp4", displayName: clip.fileName } });
  try {
    // Gemini processes the video before it can be used; poll for up to 10 minutes.
    for (let i = 0; uploaded.state === "PROCESSING" && i < 120; i++) {
      await sleep(5000);
      uploaded = await ai.files.get({ name: uploaded.name });
    }
    if (uploaded.state !== "ACTIVE") throw new Error(`Gemini couldn't read the video (${uploaded.state})`);

    const config = {
      responseMimeType: "application/json",
      responseJsonSchema: indexSchema,
      mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW,
      temperature: 0.2,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    };
    const contents = [createPartFromUri(uploaded.uri, uploaded.mimeType), indexPrompt(clip)];
    let response;
    try {
      response = await ai.models.generateContent({ model, contents, config });
    } catch (error) {
      // Older models don't take a thinking level; use their default.
      if (!/thinking/i.test(String(error))) throw error;
      delete config.thinkingConfig;
      response = await ai.models.generateContent({ model, contents, config });
    }

    const parsed = JSON.parse(response.text ?? "{}");
    const usage = response.usageMetadata ?? {};
    return {
      summary: String(parsed.summary ?? ""),
      segments: cleanSegments(parsed.segments, clip.durationSec, clip.scenes),
      model,
      modelVersion: response.modelVersion ?? null,
      promptVersion: INDEX_PROMPT_VERSION,
      tokens: {
        prompt: usage.promptTokenCount ?? null,
        thoughts: usage.thoughtsTokenCount ?? null,
        output: usage.candidatesTokenCount ?? null,
      },
    };
  } finally {
    await ai.files.delete({ name: uploaded.name }).catch(() => {});
  }
}
