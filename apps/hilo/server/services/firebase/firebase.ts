import 'server-only';
import { App, getApps, initializeApp } from 'firebase-admin/app';

/**
 * Firebase Admin app. On App Hosting the default credentials are used. Locally, point it at the
 * emulators with FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST (see README).
 */
export const app: App = getApps().length
  ? getApps()[0]
  : initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
