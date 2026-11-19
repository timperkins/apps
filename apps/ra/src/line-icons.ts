// The game's icons: smooth line drawings on a 24-unit grid, drawn with
// currentColor strokes so each place colors them. (The UI kit also turns
// these into its other icon sets.)

export type IconName =
  | 'menu' | 'select' | 'home' | 'build' | 'group' | 'all' | 'clear' | 'close'
  | 'shuffle' | 'units' | 'check' | 'deploy' | 'gear' | 'back' | 'flag' | 'bolt' | 'coin' | 'play' | 'users' | 'bot' | 'star' | 'pack' | 'unload';

export const LINE: Record<IconName, string> = {
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  select: '<path d="M6 3l12 9-5.5 1.2L15.5 20l-2.6 1.1-3-6.6L6 18z"/>',
  home: '<path d="M3.5 11L12 4l8.5 7"/><path d="M6 9.5V20h4.5v-5h3v5H18V9.5"/>',
  build: '<path d="M14.5 6.5a4 4 0 0 1 5-1.6l-2.6 2.6.4 2.2 2.2.4 2.6-2.6a4 4 0 0 1-5.4 4.8L9 20a2 2 0 0 1-3-3l7.7-7.7a4 4 0 0 1 .8-2.8z"/>',
  group: '<circle cx="12" cy="7" r="2.6"/><path d="M7.5 20v-3.5a4.5 4.5 0 0 1 9 0V20"/><circle cx="5" cy="9.5" r="1.8"/><circle cx="19" cy="9.5" r="1.8"/><path d="M2.5 19v-2a3 3 0 0 1 3-3M21.5 19v-2a3 3 0 0 0-3-3"/>',
  all: '<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><rect x="8.5" y="8.5" width="7" height="7" rx="1"/>',
  clear: '<path d="M6 6l12 12M18 6L6 18"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  shuffle: '<path d="M3 7h3.5c4 0 6.5 10 11 10H21M3 17h3.5c1.6 0 2.8-1.5 4-3.4M13.5 9.6c1.1-1.5 2.3-2.6 4-2.6H21"/><path d="M18 4l3 3-3 3M18 14l3 3-3 3"/>',
  units: '<rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1"/>',
  check: '<path d="M4.5 12.5l5 5L19.5 7"/>',
  deploy: '<path d="M12 3v10M8 9.5l4 4 4-4"/><path d="M4 15v5h16v-5"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M5.5 18.5l1.9-1.9M16.6 7.4l1.9-1.9"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  flag: '<path d="M6 21V3.5"/><path d="M6 4h11l-2.5 4L17 12H6"/>',
  bolt: '<path d="M13.5 2.5L5 13.5h6l-1.5 8L18 10.5h-6z"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9a3 3 0 1 0 0 6"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  users: '<circle cx="8.5" cy="8" r="3"/><path d="M2.5 20v-2a6 6 0 0 1 12 0v2"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14a5 5 0 0 1 5.5 5v1"/>',
  bot: '<rect x="4" y="7" width="16" height="12" rx="2.5"/><path d="M12 3.5V7M2 12v3M22 12v3"/><circle cx="9" cy="13" r="1.4"/><circle cx="15" cy="13" r="1.4"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  // soldiers out of the back: an open door and an arrow walking out of it
  unload: '<path d="M4 20V4h8v16"/><path d="M4 20h16"/><path d="M10.5 12H20M16.5 8.5L20 12l-3.5 3.5"/>',
  pack: '<path d="M12 3v6M9.5 6.5L12 9l2.5-2.5M12 21v-6M9.5 17.5L12 15l2.5 2.5M3 12h6M6.5 9.5L9 12l-2.5 2.5M21 12h-6M17.5 9.5L15 12l2.5 2.5"/>',
};

export function lineIcon(name: IconName, cls = 'ic'): string {
  return `<svg class="${cls} line" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${LINE[name]}</svg>`;
}
