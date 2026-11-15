import type { GameEntry } from './types';

// Add new games here. Each one lives in its own folder under src/games/.
export const GAMES: GameEntry[] = [
  {
    id: 'factori-owen',
    title: 'Factori-owen',
    tagline: 'Mine Owen ore, smelt Owen plates and automate everything.',
    art: `<svg viewBox="0 0 120 80" aria-hidden="true">
      <rect width="120" height="80" fill="#4f7a43"/>
      <rect x="0" y="36" width="120" height="12" fill="#2c3138"/>
      <g stroke="#3fc1b0" stroke-width="2.5" fill="none" opacity=".8">
        <path d="M14 38l5 4-5 4M34 38l5 4-5 4M54 38l5 4-5 4M74 38l5 4-5 4M94 38l5 4-5 4"/>
      </g>
      <circle cx="28" cy="42" r="4" fill="#4f63b8"/><circle cx="64" cy="42" r="4" fill="#9fb0e6"/><circle cx="100" cy="42" r="4" fill="#4f63b8"/>
      <rect x="6" y="6" width="28" height="26" rx="4" fill="#7b6a58"/><circle cx="20" cy="18" r="7" fill="#c9b79c"/>
      <rect x="80" y="54" width="30" height="22" rx="4" fill="#8f8173"/><rect x="88" y="64" width="14" height="8" rx="3" fill="#ffb347"/>
      <circle cx="56" cy="16" r="9" fill="none" stroke="#e3b341" stroke-width="5" stroke-dasharray="4 3"/>
      <text x="56" y="20" font-size="10" font-weight="900" text-anchor="middle" fill="#dbe3ff" font-family="sans-serif">O</text>
    </svg>`,
    load: () => import('./factori-owen/index'),
  },
];
