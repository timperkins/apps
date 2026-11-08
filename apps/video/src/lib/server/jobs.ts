import "server-only";
import { GoogleAuth } from "google-auth-library";

const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });

/**
 * Starts one execution of the processing Cloud Run job for a clip, and returns the execution's
 * name. PROCESS_JOB names the job (video-process, or video-process-preview on previews); without
 * it, as in local development, nothing is started and null comes back. `indexOnly` re-runs only
 * the Gemini indexing.
 */
export async function startProcessJob(
  projectId: string,
  clipId: string,
  { indexOnly = false }: { indexOnly?: boolean } = {},
): Promise<string | null> {
  const job = process.env.PROCESS_JOB;
  if (!job) return null;
  const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "apps-97595";
  const region = process.env.JOBS_REGION || "us-central1";
  const client = await auth.getClient();
  const res = await client.request<{ metadata?: { name?: string }; name?: string }>({
    url: `https://run.googleapis.com/v2/projects/${project}/locations/${region}/jobs/${job}:run`,
    method: "POST",
    data: {
      overrides: {
        containerOverrides: [
          {
            env: [
              { name: "VIDEO_PROJECT_ID", value: projectId },
              { name: "VIDEO_CLIP_ID", value: clipId },
              // Skips transcoding and only runs Gemini indexing on the existing proxy.
              { name: "INDEX_ONLY", value: indexOnly ? "1" : "0" },
            ],
          },
        ],
      },
    },
  });
  // The response is a long-running operation whose metadata is the new execution.
  return res.data.metadata?.name ?? res.data.name ?? null;
}
