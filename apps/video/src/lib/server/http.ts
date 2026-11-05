import "server-only";

/**
 * Wraps a route handler so an unexpected error comes back as JSON with its message, and is
 * logged, instead of a bare 500. The upload page shows the message under the failed file.
 */
export function withErrors<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      const err = error as Error & { code?: unknown };
      console.error("Request failed", err);
      const code = err.code !== undefined ? ` (code ${String(err.code)})` : "";
      return Response.json({ error: `Server error: ${err.message}${code}` }, { status: 500 });
    }
  };
}
