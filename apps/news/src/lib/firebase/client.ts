"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { FIRESTORE_DATABASE_ID } from "../config";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(config.apiKey && config.projectId);

function app(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(config);
}

// Local development against `firebase emulators:start` (see README).
const useEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";
let emulatorsConnected = { auth: false, db: false };

export function clientAuth(): Auth {
  const auth = getAuth(app());
  if (useEmulators && !emulatorsConnected.auth) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    emulatorsConnected = { ...emulatorsConnected, auth: true };
  }
  return auth;
}

export function clientDb(): Firestore {
  const db = getFirestore(app(), FIRESTORE_DATABASE_ID);
  if (useEmulators && !emulatorsConnected.db) {
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    emulatorsConnected = { ...emulatorsConnected, db: true };
  }
  return db;
}
