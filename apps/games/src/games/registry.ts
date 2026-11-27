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
  {
    id: 'robopoculeps',
    title: 'Robopoculeps',
    tagline: 'Dig in a mine and build flying robots that mine for you.',
    art: `<svg viewBox="0 0 120 80" aria-hidden="true">
      <rect width="120" height="80" fill="#3e332b"/>
      <rect width="120" height="14" fill="#1d1714"/><rect y="10" width="120" height="5" fill="#4a3c33"/>
      <rect x="10" y="2" width="30" height="20" fill="#2b1b10" stroke="#5b3a1f" stroke-width="2"/><rect x="8" y="20" width="34" height="5" fill="#8a5a2b"/>
      <circle cx="25" cy="13" r="4" fill="#f1c9a0"/><path d="M20 10h10l-3-7z" fill="#1b2a6b"/><circle cx="25" cy="6" r="1" fill="#ffe36b"/>
      <path d="M78 58l8-12 14 2 6 12-10 8-16-2z" fill="#8b8580"/><circle cx="88" cy="56" r="2" fill="#b9b3ad"/><circle cx="96" cy="60" r="2" fill="#b9b3ad"/>
      <path d="M100 66l4-6 8 1 2 6-6 4z" fill="#6f665c"/><circle cx="107" cy="65" r="1.6" fill="#ffd23f"/>
      <g transform="translate(70 34)"><path d="M0-11v-4" stroke="#d9dde3" stroke-width="1.5"/><ellipse cy="-15" rx="10" ry="1.5" fill="#d9dde3"/>
        <ellipse rx="11" ry="9" fill="#b8c0cc"/><ellipse cx="1" cy="-1" rx="7" ry="4" fill="#16222c"/><rect x="-3" y="-3" width="2" height="2" fill="#e0e0e0"/><rect x="2" y="-3" width="2" height="2" fill="#e0e0e0"/>
        <path d="M0 8L10 20" stroke="#ff7a50" stroke-width="1.5" stroke-dasharray="2 1.5"/></g>
      <rect x="6" y="62" width="40" height="10" fill="#3a3f45"/><path d="M12 64l4 3-4 3M24 64l4 3-4 3M36 64l4 3-4 3" stroke="#e8b33a" stroke-width="1.5" fill="none"/>
      <rect x="48" y="60" width="14" height="14" fill="#2f8a4c"/><text x="55" y="71" font-size="10" font-weight="900" text-anchor="middle" fill="#d4ffda" font-family="sans-serif">$</text>
    </svg>`,
    load: () => import('./robopoculeps/index'),
  },
  {
    id: 'survivle-long',
    title: 'Survivle (Long Edition)',
    tagline: 'Survivle, but bigger: a 3× tougher Dark Beast, the Sword of Light, raider camps and 25 more things to find.',
    art: `<svg viewBox="0 0 120 80" aria-hidden="true">
      <rect width="120" height="80" fill="#1d2140"/>
      <path d="M0 62L34 46L68 62L34 78Z" fill="#63b04b"/><path d="M0 62L34 78V80H0Z" fill="#8a6c4c"/>
      <path d="M58 44L88 30L118 44L88 58Z" fill="#a8895a"/>
      <g transform="translate(88 44)">
        <path d="M-6 2l-3-9M6 2l3-9M-6-6l-3 9M6-6l3 9" stroke="#6b4424" stroke-width="1.6"/>
        <circle cx="-9" cy="-7" r="2" fill="#e0302a"/><circle cx="9" cy="-7" r="2" fill="#e0302a"/>
        <ellipse cx="0" cy="0" rx="5" ry="2.5" fill="#6a6460"/>
        <path d="M0-1q-4-4 0-10q4 6 0 10z" fill="#ffa530"/><path d="M0-1q-2-3 0-6q2 3 0 6z" fill="#ffe27a"/>
      </g>
      <g transform="translate(60 40)">
        <rect x="-14" y="-4" width="28" height="6" rx="2" fill="#6e6a78"/>
        <rect x="-1.5" y="-30" width="3" height="27" fill="#fff7c8"/><rect x="-6" y="-31" width="12" height="2.5" fill="#e0b53c"/><rect x="-1.2" y="-38" width="2.4" height="7" fill="#3b6fcb"/>
        <path d="M-8-38L8-38L4 0L-4 0Z" fill="#fff2a0" opacity=".25"/>
      </g>
      <g transform="translate(30 62)">
        <rect x="-4" y="-6" width="3" height="7" fill="#2f7d31"/><rect x="1" y="-6" width="3" height="7" fill="#2f7d31"/>
        <rect x="-5" y="-15" width="10" height="10" rx="3" fill="#dfe5ec"/>
        <circle cx="0" cy="-19" r="5" fill="#f0c7a0"/><path d="M-6-17Q-6-26 0-25Q6-26 6-17L4-20Q0-23-4-20Z" fill="#1b4a20"/>
        <ellipse cx="-7" cy="-10" rx="4" ry="5" fill="#3b6fcb" stroke="#e0b53c" stroke-width="1.2"/>
      </g>
      <text x="60" y="14" font-size="9" font-weight="900" text-anchor="middle" fill="#fff2a0" font-family="sans-serif" letter-spacing="2">LONG EDITION</text>
    </svg>`,
    load: () => import('./survivle-long/index'),
  },
  {
    id: 'emberwild',
    title: 'Emberwild',
    tagline: 'Roam a wild land, mine and build with blocks, and automate drills, belts and furnaces to relight four lost beacons.',
    art: `<svg viewBox="0 0 120 80" aria-hidden="true">
      <rect width="120" height="80" fill="#2b3a5a"/>
      <path d="M0 52L30 38L60 50L92 30L120 44V80H0Z" fill="#4f9440"/>
      <path d="M0 62L40 52L80 64L120 54V80H0Z" fill="#72b54e"/>
      <rect x="84" y="26" width="16" height="14" fill="#b9b1a0"/><rect x="82" y="23" width="20" height="4" fill="#857d6b"/>
      <path d="M86 23q0-10 6-15q6 5 6 15z" fill="#ff7a1a"/><path d="M89 23q0-5 3-8q3 3 3 8z" fill="#ffe27a"/>
      <path d="M86 23L80 0H104L98 23Z" fill="rgba(255,190,80,.2)"/>
      <rect x="10" y="56" width="11" height="11" fill="#d39a3a"/><rect x="10" y="53" width="11" height="4" fill="#e8b860"/>
      <rect x="21" y="60" width="34" height="6" fill="#33383e"/><path d="M26 61l3 2-3 2M36 61l3 2-3 2M46 61l3 2-3 2" stroke="#d9a632" stroke-width="1.2" fill="none"/>
      <rect x="55" y="54" width="13" height="13" fill="#a19b92"/><rect x="58" y="61" width="7" height="4" rx="1" fill="#ff8a2a"/>
      <rect x="104" y="58" width="10" height="10" fill="#a39f97"/><rect x="104" y="55" width="10" height="4" fill="#c4c0b8"/><rect x="107" y="60" width="3" height="2" fill="#e8803e"/>
      <circle cx="30" cy="40" r="7" fill="#3f8a3a"/><rect x="29" y="44" width="2.5" height="6" fill="#6b4424"/>
      <g transform="translate(74 60)"><rect x="-3" y="-8" width="6" height="7" rx="1.5" fill="#2f8a74"/><circle cy="-11" r="3.2" fill="#f0c7a0"/><path d="M-3.4 -11.5a3.4 3.4 0 0 1 6.8 0z" fill="#e0b04a"/><path d="M-3 -8L-4 -1H4L3 -8Z" fill="#c4462f" opacity=".85"/></g>
      <g fill="#fff8e0"><circle cx="14" cy="10" r=".9"/><circle cx="48" cy="6" r="1"/><circle cx="66" cy="16" r=".8"/></g>
    </svg>`,
    load: () => import('./emberwild/index'),
  },
  {
    id: 'md',
    title: 'M.D.',
    tagline: 'Monster Dungeons: a blocky dungeon crawler with traders, many weapons, dungeon maps and five guardians to beat.',
    art: `<svg viewBox="0 0 120 80" aria-hidden="true">
      <rect width="120" height="80" fill="#0e0b14"/>
      <path d="M60 30L110 55L60 80L10 55Z" fill="#4a534d"/><path d="M60 30L85 42.5L60 55L35 42.5Z" fill="#56605a"/>
      <path d="M10 55L60 30V18L10 43Z" fill="#6d7a68"/><path d="M60 30L110 55V43L60 18Z" fill="#3d4a3a"/>
      <path d="M10 43L60 18L110 43" stroke="#8a9a84" stroke-width="1" fill="none"/>
      <rect x="28" y="30" width="3" height="6" fill="#5a3418"/><rect x="27" y="25" width="5" height="6" fill="#ffb347"/><circle cx="29.5" cy="28" r="9" fill="#ffb347" opacity=".18"/>
      <g transform="translate(46 52)"><rect x="-4" y="-2" width="3" height="6" fill="#3a3a52"/><rect x="1" y="-2" width="3" height="6" fill="#3a3a52"/><rect x="-5" y="-10" width="10" height="9" fill="#3f7a5a"/><rect x="-4.5" y="-18" width="9" height="8" fill="#e8b890"/><rect x="-5" y="-19" width="10" height="3" fill="#6b3a1e"/><path d="M5 -8L16 -18" stroke="#b0a090" stroke-width="2.5"/></g>
      <g transform="translate(78 50)"><rect x="-6" y="-12" width="12" height="11" fill="#77806e"/><rect x="-6.5" y="-13" width="13" height="3" fill="#5f9a3a"/><rect x="-4" y="-8" width="2.5" height="2" fill="#ffe24a"/><rect x="1.5" y="-8" width="2.5" height="2" fill="#ffe24a"/></g>
      <g transform="translate(92 36)"><rect x="-4" y="-4" width="8" height="7" fill="#3a2a4a"/><rect x="-11" y="-3" width="7" height="2" fill="#5a3a6e"/><rect x="4" y="-3" width="7" height="2" fill="#5a3a6e"/><rect x="-2.5" y="-2" width="1.6" height="1.6" fill="#ff3a5a"/><rect x="1" y="-2" width="1.6" height="1.6" fill="#ff3a5a"/></g>
      <circle cx="100" cy="68" r="2.5" fill="#ffd84a"/><circle cx="20" cy="64" r="2" fill="#ffd84a"/>
      <text x="60" y="13" font-size="12" font-weight="900" text-anchor="middle" fill="#ffd04a" stroke="#2a1206" stroke-width="1" paint-order="stroke" font-family="sans-serif" letter-spacing="1">M.D.</text>
    </svg>`,
    load: () => import('./md/index'),
  },
  {
    id: 'explorer',
    title: 'Explorer',
    tagline: 'A whole round 3D earth: mine, craft, build factories, visit villages, rent a car and launch a rocket to space.',
    art: `<svg viewBox="0 0 120 80" aria-hidden="true">
      <rect width="120" height="80" fill="#8ec9ff"/>
      <path d="M0 50L20 30L34 40L52 18L70 38L84 28L120 52V80H0Z" fill="#8a8a80"/>
      <path d="M44 26L52 18L60 26L56 28L52 24L48 28Z" fill="#f4f8fb"/>
      <path d="M0 58Q30 50 60 58T120 56V80H0Z" fill="#6db04a"/>
      <path d="M0 70Q40 64 80 70T120 68V80H0Z" fill="#3f8a35"/>
      <rect x="86" y="44" width="16" height="12" fill="#e8d5b7"/><path d="M84 45L94 37L104 45Z" fill="#a83a2c"/>
      <g transform="translate(18 56)"><rect x="-1.5" y="0" width="3" height="8" fill="#7a5230"/><path d="M-7 2L0-14L7 2Z" fill="#245c3a"/></g>
      <g transform="translate(30 60)"><rect x="-1.5" y="0" width="3" height="7" fill="#7a5230"/><circle cy="-4" r="7" fill="#4c9a3a"/></g>
      <g transform="translate(62 62)"><rect x="-3" y="-8" width="6" height="7" rx="1.5" fill="#ffd23f"/><circle cy="-11" r="3.2" fill="#f1c9a0"/><rect x="-3" y="-1" width="2.4" height="5" fill="#3a4a6a"/><rect x=".6" y="-1" width="2.4" height="5" fill="#3a4a6a"/></g>
      <g transform="translate(104 20) rotate(20)"><rect x="-3" y="-10" width="6" height="16" rx="2" fill="#f0f0f4"/><path d="M-3-10L0-16L3-10Z" fill="#d03030"/><path d="M-2 6Q0 14 2 6Z" fill="#ffb030"/></g>
      <circle cx="16" cy="14" r="7" fill="#fff4b0"/>
      <text x="60" y="13" font-size="11" font-weight="900" text-anchor="middle" fill="#ffe066" stroke="#7a3a0a" stroke-width="1" paint-order="stroke" font-family="sans-serif" letter-spacing="2">EXPLORER</text>
    </svg>`,
    load: () => import('./explorer/index'),
  },
  {
    id: 'mob-delvers',
    title: 'Mob Delvers',
    tagline: 'Team up to 4, beat 8 missions on 10 difficulties and hunt better gear with your power level.',
    art: `<svg viewBox="0 0 120 80" aria-hidden="true">
      <rect width="120" height="80" fill="#1a1426"/>
      <path d="M60 28L112 54L60 80L8 54Z" fill="#3e5a34"/><path d="M60 28L86 41L60 54L34 41Z" fill="#4a6a3c"/>
      <rect x="20" y="40" width="10" height="10" fill="#6a4a2a"/><path d="M18 40l7-7 7 7z" fill="#a33a2a"/>
      <circle cx="96" cy="44" r="5" fill="#e08a2a"/><rect x="95" y="38" width="2" height="3" fill="#3a6a2a"/>
      <g transform="translate(50 56)"><rect x="-4" y="-2" width="3" height="6" fill="#2a3a5a"/><rect x="1" y="-2" width="3" height="6" fill="#2a3a5a"/><rect x="-5" y="-10" width="10" height="9" fill="#2a7ab0"/><rect x="-4.5" y="-18" width="9" height="8" fill="#e8b890"/><rect x="-5" y="-19" width="10" height="3" fill="#3a2a1a"/><path d="M5 -8L16 -20" stroke="#d8e0ff" stroke-width="2.5"/></g>
      <g transform="translate(78 58)"><rect x="-5" y="-14" width="10" height="13" fill="#5a8a4a"/><rect x="-4" y="-9" width="2.5" height="2" fill="#ff3a3a"/><rect x="1.5" y="-9" width="2.5" height="2" fill="#ff3a3a"/><rect x="-4" y="-1" width="3" height="5" fill="#3a4a2a"/><rect x="1" y="-1" width="3" height="5" fill="#3a4a2a"/></g>
      <g fill="#a8f0ff" opacity=".85"><circle cx="66" cy="38" r="2"/><circle cx="30" cy="62" r="1.6"/><circle cx="88" cy="66" r="1.8"/></g>
      <text x="60" y="15" font-size="11" font-weight="900" text-anchor="middle" fill="#ffe08a" stroke="#2a1206" stroke-width="1" paint-order="stroke" font-family="sans-serif" letter-spacing="1">MOB DELVERS</text>
      <text x="104" y="30" font-size="8" font-weight="900" text-anchor="middle" fill="#e8d0ff" font-family="sans-serif">⚡</text>
    </svg>`,
    load: () => import('./mob-delvers/index'),
  },
  {
    id: 'tiny-kingdoms',
    title: 'Tiny Kingdoms',
    tagline: 'Grow a little kingdom, train an army and knock down the Black castle. Up to 4 players.',
    art: `<svg viewBox="0 0 120 80" aria-hidden="true">
      <rect width="120" height="80" fill="#47aba9"/>
      <path d="M8 18q4-10 16-10h72q16 0 16 12v42q0 12-14 12H22Q8 74 8 60z" fill="#b8b958" stroke="#e8f4d8" stroke-width="2"/>
      <g transform="translate(22 22)"><rect width="34" height="22" fill="#d9cfa8"/><rect y="-6" width="10" height="10" fill="#3f6aa1"/><rect x="24" y="-6" width="10" height="10" fill="#3f6aa1"/><rect x="10" y="-2" width="14" height="6" fill="#a8743f"/><rect x="13" y="10" width="8" height="12" fill="#5a3a20"/></g>
      <g transform="translate(76 18)"><rect width="22" height="16" fill="#9a9a9a"/><rect y="-6" width="7" height="8" fill="#2c2c38"/><rect x="15" y="-6" width="7" height="8" fill="#2c2c38"/><rect x="8" y="8" width="6" height="8" fill="#2c2c38"/></g>
      <g fill="#2f6b45"><path d="M88 46l7-16 7 16z"/><path d="M98 54l6-14 6 14z"/></g>
      <g fill="#f2c23a"><circle cx="18" cy="60" r="4"/><circle cx="25" cy="63" r="3"/></g>
      <g transform="translate(48 56)"><circle r="6" fill="#4b8ed9"/><path d="M5 -2l12 -10" stroke="#e9eef7" stroke-width="2.5"/></g>
      <g transform="translate(68 52)"><circle r="6" fill="#3a3a48"/><path d="M-5 -2l-10 -8" stroke="#e9eef7" stroke-width="2.5"/></g>
      <g fill="#fff"><ellipse cx="40" cy="70" rx="5" ry="3.5"/><circle cx="44" cy="68" r="2.5"/></g>
    </svg>`,
    load: () => import('./tiny-kingdoms/index'),
  },
  {
    id: '2p-games',
    title: '2p Games',
    tagline: 'Mini games for up to 8 players: Factory and Knight Battle.',
    art: `<svg viewBox="0 0 120 80" aria-hidden="true">
      <defs><linearGradient id="pg-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffcf6b"/><stop offset=".5" stop-color="#ff8fa3"/><stop offset="1" stop-color="#8a7dff"/></linearGradient></defs>
      <rect width="120" height="80" fill="url(#pg-bg)"/>
      <g transform="rotate(-8 30 22)"><rect x="12" y="10" width="36" height="24" rx="7" fill="#fff"/><text x="30" y="29" font-size="17" font-weight="900" text-anchor="middle" fill="#ff5d73" font-family="sans-serif">2p</text></g>
      <rect x="10" y="44" width="44" height="28" rx="6" fill="#2a8f73" stroke="#175c49" stroke-width="2"/>
      <text x="22" y="64" font-size="15" text-anchor="middle">🍌</text><text x="42" y="64" font-size="15" text-anchor="middle">🐱</text>
      <path d="M86 66c-12-8-20-14-20-23a8 8 0 0 1 14-5l6 5 6-5a8 8 0 0 1 14 5c0 9-8 15-20 23z" fill="#e8304d" stroke="#6e0f1f" stroke-width="2.5"/>
      <path d="M96 14l-14 20M90 12l12 4" stroke="#e9eef7" stroke-width="3.5" stroke-linecap="round"/>
      <circle cx="82" cy="34" r="3" fill="#8a5a2b"/>
    </svg>`,
    load: () => import('./2p-games/index'),
  },
];
