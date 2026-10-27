import "server-only";

/**
 * Structured timing logs for story generation. Each line is JSON, which Cloud Run stores as
 * jsonPayload, so runs can be queried with `jsonPayload.timing="refresh"` in Cloud Logging.
 */
export function logTiming(step: string, fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ severity: "INFO", message: `[tim-news] timing ${step}`, timing: step, ...fields }));
}

/** Runs fn and logs how long it took under `step`, including when it throws. */
export async function timed<T>(step: string, fields: Record<string, unknown>, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  let ok = false;
  try {
    const result = await fn();
    ok = true;
    return result;
  } finally {
    logTiming(step, { ...fields, ms: Date.now() - start, ok });
  }
}
