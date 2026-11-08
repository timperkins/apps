import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { isAllowed, parseAllowlist } from "../allowlist";

let app: App | undefined;

/**
 * Firebase Admin app. On Firebase App Hosting the default credentials are used.
 * Locally, set FIREBASE_SERVICE_ACCOUNT to the service account JSON, or
 * GOOGLE_APPLICATION_CREDENTIALS to its path.
 */
function adminApp(): App {
  if (app) return app;
  if (getApps().length) {
    app = getApps()[0];
    return app;
  }
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  app = serviceAccount
    ? initializeApp({ credential: cert(JSON.parse(serviceAccount)) })
    : initializeApp(
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
          ? { projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID }
          : undefined,
      );
  return app;
}

let db: Firestore | undefined;

export function adminDb(): Firestore {
  if (!db) {
    db = getFirestore(adminApp(), process.env.FIRESTORE_DATABASE_ID || "video");
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch {
      // Another server bundle in this process already configured the shared instance.
    }
  }
  return db;
}

export function footageBucket() {
  const name = process.env.STORAGE_BUCKET;
  if (!name) throw new Error("STORAGE_BUCKET is not set");
  return getStorage(adminApp()).bucket(name);
}

export function storagePrefix(): string {
  return (process.env.STORAGE_PREFIX || "video").replace(/\/+$/, "");
}

export interface SignedInUser {
  uid: string;
  email: string;
}

/**
 * Checks the Firebase ID token in an `Authorization: Bearer` header and the email allowlist.
 * Returns the user, or a 401/403 Response to send back.
 */
export async function requireUser(request: Request): Promise<SignedInUser | Response> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return Response.json({ error: "Sign in first." }, { status: 401 });
  let decoded;
  try {
    decoded = await getAuth(adminApp()).verifyIdToken(token);
  } catch {
    return Response.json({ error: "Your sign-in expired. Sign in again." }, { status: 401 });
  }
  if (!isAllowed(parseAllowlist(process.env.ALLOWED_EMAILS), decoded.email, decoded.email_verified)) {
    return Response.json({ error: "This account isn't allowed to use this app." }, { status: 403 });
  }
  return { uid: decoded.uid, email: decoded.email! };
}
