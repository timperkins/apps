import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { FIRESTORE_DATABASE_ID } from "../config";

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
    db = getFirestore(adminApp(), FIRESTORE_DATABASE_ID);
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch {
      // Another server bundle in this process already configured the shared instance.
    }
  }
  return db;
}

/** Verifies the Firebase ID token in an `Authorization: Bearer` header. Returns the uid or null. */
export async function verifyRequest(request: Request): Promise<string | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  try {
    const decoded = await getAuth(adminApp()).verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}
