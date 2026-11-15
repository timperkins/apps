// Every game in the hub exports a module with this shape, so adding a game is one registry entry.
export interface GameModule {
  /** Draws the game into `root`. Returns a cleanup function. */
  mount: (root: HTMLElement, opts: { onExit: () => void }) => () => void;
}

export interface GameEntry {
  id: string; // also the URL hash: games.trom.dev/#<id>
  title: string;
  tagline: string;
  /** Small inline SVG shown on the game's card. */
  art: string;
  /** Lazy-loaded so the launcher stays quick. */
  load: () => Promise<{ default: GameModule }>;
}
