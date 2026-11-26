/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PR_NUMBER?: string;
}

/** Changes whenever a sound file changes; see vite.config.ts. */
declare const __AUDIO_V__: string;
