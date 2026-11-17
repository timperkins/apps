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
  {
    id: 'space-defender',
    title: 'Space Defender',
    tagline: 'Hold out on a platform in space: shoot asteroids, catch their stone and build.',
    art: `<svg viewBox="0 0 120 80" aria-hidden="true">
      <rect width="120" height="80" fill="#05060f"/>
      <g fill="#fff8e0"><circle cx="10" cy="10" r="1"/><circle cx="34" cy="68" r="1.2"/><circle cx="104" cy="12" r="1"/><circle cx="112" cy="58" r="1.3"/><circle cx="62" cy="6" r=".8"/><circle cx="8" cy="50" r=".9"/></g>
      <g transform="translate(38 30)">
        <rect width="44" height="34" rx="2" fill="#5d6577"/>
        <path d="M11 0V34M22 0V34M33 0V34M0 11H44M0 22H44" stroke="#3e4454" stroke-width="1.2"/>
        <rect x="16" y="11" width="12" height="12" rx="2" fill="#a0713f" stroke="#6b4626" stroke-width="1.5"/>
        <circle cx="10" cy="27" r="3.5" fill="#e9eef7"/><circle cx="10" cy="27" r="2" fill="#6fb6ff"/>
      </g>
      <path d="M82 40L104 22" stroke="#c9b79c" stroke-width="2"/><circle cx="105" cy="21" r="3" fill="none" stroke="#c9b79c" stroke-width="1.5"/>
      <path d="M20 22l4-5 5 1 2 5-3 4-6 0z" fill="#8a7d70"/><path d="M90 66l3-4 4 1 1 4-3 2z" fill="#8a7d70"/>
      <path d="M48 30L30 18" stroke="#ffe066" stroke-width="1.5" stroke-dasharray="3 2"/>
    </svg>`,
    load: () => import('./space-defender/index'),
  },
  {
    id: 'north-pole',
    title: 'North Pole Village',
    tagline: 'Chop trees, build fences and keep the polar bears out of your village.',
    art: `<svg viewBox="0 0 120 80" aria-hidden="true">
      <rect width="120" height="80" fill="#eaf2fa"/>
      <g fill="#245c43"><path d="M10 40l9-22 9 22z"/><path d="M96 36l8-20 8 20z"/><path d="M100 70l7-16 7 16z"/></g>
      <g fill="#fff"><path d="M19 18l3 8h-6z"/><path d="M104 16l3 7h-6z"/></g>
      <path d="M44 34l16-14 16 14z" fill="#b8362c"/><rect x="47" y="34" width="26" height="18" fill="#7a4a28"/>
      <rect x="57" y="42" width="7" height="10" fill="#3e2412"/><rect x="50" y="38" width="5" height="5" fill="#ffd27a"/>
      <g stroke="#8a5a32" stroke-width="3"><path d="M34 60H86M34 66H86"/></g>
      <g fill="#5a3a20"><rect x="33" y="56" width="4" height="13"/><rect x="51" y="56" width="4" height="13"/><rect x="69" y="56" width="4" height="13"/><rect x="85" y="56" width="4" height="13"/></g>
      <g transform="translate(18 66)"><ellipse rx="11" ry="7" fill="#f6f6f0" stroke="#b8bcc4"/><circle cx="10" cy="-3" r="5" fill="#f6f6f0" stroke="#b8bcc4"/><circle cx="13" cy="-3" r="1.2" fill="#111"/></g>
      <g fill="#fff"><circle cx="30" cy="10" r="1.5"/><circle cx="80" cy="8" r="1.2"/><circle cx="64" cy="70" r="1.3"/><circle cx="90" cy="48" r="1"/></g>
    </svg>`,
    load: () => import('./north-pole/index'),
  },
  {
    id: 'jobville',
    title: 'Jobville',
    tagline: 'Explore a huge village, pick a job off the job board and spend your $ on shop upgrades.',
    art: `<svg viewBox="0 0 120 80" aria-hidden="true">
      <rect width="120" height="80" fill="#7cc35b"/>
      <rect x="0" y="50" width="120" height="8" fill="#cdb994"/><rect x="56" y="0" width="8" height="80" fill="#cdb994"/>
      <rect x="6" y="8" width="20" height="16" fill="#f2d7b6"/><rect x="4" y="6" width="24" height="11" fill="#b5483a"/>
      <rect x="32" y="8" width="20" height="16" fill="#c9dcef"/><rect x="30" y="6" width="24" height="11" fill="#3f6aa1"/>
      <rect x="70" y="6" width="44" height="26" fill="#ffe08a"/><rect x="68" y="4" width="48" height="16" fill="#d04a7a"/>
      <rect x="80" y="8" width="24" height="8" rx="2" fill="#fff"/><text x="92" y="15" font-size="7" font-weight="900" text-anchor="middle" fill="#d04a7a" font-family="sans-serif">SHOP</text>
      <rect x="14" y="32" width="28" height="12" fill="#9a6435" stroke="#5a3418" stroke-width="1.5"/>
      <rect x="17" y="35" width="6" height="6" fill="#fff8dc"/><rect x="25" y="34" width="6" height="6" fill="#e0f0ff"/><rect x="33" y="35" width="6" height="6" fill="#ffe0e0"/>
      <circle cx="88" cy="66" r="9" fill="#1f8a4c" stroke="#fff" stroke-width="2"/><text x="88" y="70" font-size="11" font-weight="900" text-anchor="middle" fill="#fff" font-family="sans-serif">$</text>
      <circle cx="60" cy="64" r="4" fill="#f1c27d"/><rect x="56" y="67" width="8" height="7" rx="2" fill="#e74c3c"/>
      <circle cx="10" cy="68" r="7" fill="#2e7d32"/><circle cx="110" cy="44" r="6" fill="#2e7d32"/>
    </svg>`,
    load: () => import('./jobville/index'),
  },
  {
    id: 'survivle',
    title: 'Survivle',
    tagline: 'Explore a huge land and beat the Dark Beast before the world goes black.',
    art: `<svg viewBox="0 0 120 80" aria-hidden="true">
      <rect width="120" height="80" fill="#2a2140"/>
      <path d="M0 60L30 45L60 60L30 75Z" fill="#63b04b"/><path d="M0 60L30 75V80H0Z" fill="#8a6c4c"/>
      <path d="M50 40L80 25L110 40L80 55Z" fill="#918c84"/><path d="M50 40L80 55V80H50Z" fill="#77726b"/><path d="M80 55L110 40V80H80Z" fill="#5f5b55"/>
      <rect x="70" y="14" width="20" height="18" fill="#8c8996"/><path d="M68 14h4v-4h4v4h4v-4h4v4h4v-4h4v4h-24z" fill="#8c8996"/>
      <circle cx="80" cy="10" r="9" fill="#1a0b28"/><circle cx="80" cy="10" r="9" fill="none" stroke="#9b3ad6" stroke-width="2" opacity=".7"/>
      <circle cx="77" cy="9" r="1.5" fill="#ff4fd8"/><circle cx="83" cy="9" r="1.5" fill="#ff4fd8"/>
      <g transform="translate(28 58)">
        <rect x="-4" y="-6" width="3" height="7" fill="#2f7d31"/><rect x="1" y="-6" width="3" height="7" fill="#2f7d31"/>
        <rect x="-5" y="-15" width="10" height="10" rx="3" fill="#3e9b3a"/>
        <circle cx="0" cy="-19" r="5" fill="#f0c7a0"/><path d="M-6-17Q-6-26 0-25Q6-26 6-17L4-20Q0-23-4-20Z" fill="#1b4a20"/>
        <rect x="6" y="-24" width="2" height="12" fill="#b98b52" transform="rotate(25 7 -14)"/>
      </g>
      <g transform="translate(12 44)"><rect x="-1.5" y="0" width="3" height="8" fill="#6b4424"/><circle cx="0" cy="-3" r="6" fill="#3f9440"/></g>
    </svg>`,
    load: () => import('./survivle/index'),
  },
];
