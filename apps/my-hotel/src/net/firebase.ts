import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

const env = import.meta.env;
const useEmulators = env.VITE_USE_EMULATORS === 'true';

// Firebase web config is public by design (it ships in every client); security comes from
// firestore.rules. The VITE_FIREBASE_* variables override it, e.g. for the emulators.
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyDqgldIcbiEGPtlDoVVohbwuyKBiWZq3Qc',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'apps-97595.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'apps-97595',
  appId: env.VITE_FIREBASE_APP_ID || '1:769532990756:web:a9962066d10703605c8fb1',
});

export const auth = getAuth(app);
// The game lives in its own named database, not the project's (default) one. CI sets
// VITE_FIRESTORE_DATABASE_ID to `my-hotel` for prod and `my-hotel-preview` for previews; local builds
// default to the preview database so they never touch prod data.
export const db = getFirestore(app, env.VITE_FIRESTORE_DATABASE_ID || 'my-hotel-preview');

if (useEmulators) {
  const host = location.hostname;
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
}

let userPromise: Promise<User> | null = null;

// Every device signs in anonymously so security rules can tell players apart.
export function ensureUser(): Promise<User> {
  if (!userPromise) {
    userPromise = new Promise<User>((resolve, reject) => {
      const stop = onAuthStateChanged(auth, (user) => {
        if (user) {
          stop();
          resolve(user);
        }
      });
      signInAnonymously(auth).catch((err) => {
        stop();
        userPromise = null;
        reject(err);
      });
    });
  }
  return userPromise;
}
