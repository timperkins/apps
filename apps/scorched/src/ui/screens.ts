import {
  CPU_NAMES,
  DIFFICULTIES,
  MAX_PLAYERS,
  PLAYER_COLORS,
  TANK_DESIGN_NAMES,
  validateSettings,
  type Difficulty,
  type GameConfig,
} from '../core/config';
import type { LobbyPlayer } from '../net/protocol';
import { drawTankSprite } from '../render/tanks';
import type { Match, RoundSummary } from '../core/match';
import { Rng } from '../core/rng';
import { generateHeights } from '../core/terrain';
import { ITEMS, WEAPONS, type ShopId } from '../core/weapons';

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function fmt(n: number): string {
  return Math.floor(n).toLocaleString('en-US');
}

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
  expert: 'Expert',
};

export function difficultyLabel(d: Difficulty): string {
  return DIFFICULTY_LABEL[d];
}

// ---- Title ------------------------------------------------------------------------

export function renderTitle(root: HTMLElement, opts: { canContinue: boolean; onNew: () => void; onQuick: () => void }): void {
  root.innerHTML = `
    <h1 class="logo">SCORCHED</h1>
    <p class="tagline">Realtime tank artillery. Pick a weapon, set your angle and power, and fire. Reload takes 5 seconds.</p>
    <canvas class="title-art" width="320" height="90" aria-hidden="true"></canvas>
    <div class="row">
      <button class="btn primary" data-act="new">New game</button>
      <button class="btn" data-act="quick">${opts.canContinue ? 'Use last setup' : 'Quick game'}</button>
    </div>
    <div class="panel">
      <h2>How to play</h2>
      <p style="margin:0 0 8px">This screen shows the battle. Everyone plays on their own phone: start a game here, then scan the QR code with each phone to join. Hold the phone sideways to use it as your tank's controller.</p>
      <p class="note">There are no turns. Aim and fire whenever you like; after each shot your tank reloads for 5 seconds. Power is limited by your tank's health, so a damaged tank can't shoot as far. A Power Cell from the shop brings power back to max.</p>
      <p class="note">Planes fly over now and then. Hit one with anything to bring it down for a cash reward, but watch out: it explodes like a Baby Nuke where it crashes.</p>
      <dl class="help" style="margin-top:12px">
        <dt>F</dt><dd>Fast forward (computer-only games)</dd>
        <dt>M</dt><dd>Sound on or off</dd>
        <dt>Esc</dt><dd>Pause menu</dd>
      </dl>
    </div>`;
  root.querySelector('[data-act="new"]')!.addEventListener('click', opts.onNew);
  root.querySelector('[data-act="quick"]')!.addEventListener('click', opts.onQuick);
  drawTitleArt(root.querySelector('canvas')!);
}

function drawTitleArt(c: HTMLCanvasElement): void {
  const ctx = c.getContext('2d');
  if (!ctx) return;
  const rng = new Rng(Date.now());
  const hm = generateHeights('hills', rng, c.width, c.height * 4);
  for (let x = 0; x < c.width; x++) {
    const top = Math.round(hm[x] / 4 + 20);
    ctx.fillStyle = '#9a7a3a';
    ctx.fillRect(x, top, 1, 2);
    ctx.fillStyle = '#6a4c28';
    ctx.fillRect(x, top + 2, 1, c.height - top);
  }
  const spots = [50, 160, 270];
  spots.forEach((x, i) => {
    const y = Math.round(hm[x] / 4 + 20);
    ctx.fillStyle = PLAYER_COLORS[i];
    ctx.fillRect(x - 6, y - 4, 13, 3);
    ctx.fillRect(x - 3, y - 6, 7, 2);
    ctx.fillStyle = '#eee';
    for (let k = 0; k < 7; k++) ctx.fillRect(x + (i === 2 ? -k : k), y - 6 - k, 1, 1);
  });
  // A shell in flight
  ctx.fillStyle = 'rgba(255,220,160,0.7)';
  for (let k = 0; k < 40; k += 3) {
    const x = 57 + k * 1.3;
    ctx.fillRect(Math.round(x), Math.round(hm[50] / 4 + 5 - k * 0.9 + (k * k) / 70), 1, 1);
  }
}

// ---- Setup ------------------------------------------------------------------------

function options<T extends string | number>(values: [T, string][], selected: T): string {
  return values
    .map(([v, label]) => `<option value="${v}"${v === selected ? ' selected' : ''}>${esc(label)}</option>`)
    .join('');
}

export function renderSetup(
  root: HTMLElement,
  initial: GameConfig,
  opts: { onStart: (c: GameConfig) => void; onBack: () => void },
): void {
  const config: GameConfig = structuredClone(initial);

  const draw = () => {
    root.innerHTML = `
      <h1 class="logo" style="font-size:28px">GAME SETUP</h1>
      <form class="panel" id="setup-form" novalidate>
        <h2>Match</h2>
        <div class="form-grid">
          <div class="field"><label for="rounds">Rounds</label>
            <input id="rounds" type="number" min="1" max="20" step="1" value="${config.rounds}"></div>
          <div class="field"><label for="coins">Starting cash</label>
            <select id="coins">${options(
              [0, 5000, 10000, 20000, 50000, 100000].map((n) => [n, `$${fmt(n)}`] as [number, string]),
              config.startingCoins,
            )}</select></div>
          <div class="field"><label for="interest">Interest on saved cash</label>
            <select id="interest">${options(
              [0, 2, 5, 10].map((n) => [n, `${n}% per round`] as [number, string]),
              config.interestPct,
            )}</select></div>
          <div class="field"><label for="terrain">Terrain</label>
            <select id="terrain">${options(
              [['random', 'Random'], ['hills', 'Rolling hills'], ['mountains', 'Mountains'], ['canyons', 'Canyons'], ['flat', 'Flat']],
              config.terrain,
            )}</select></div>
          <div class="field"><label for="wind">Wind</label>
            <select id="wind">${options(
              [['off', 'Off'], ['calm', 'Calm'], ['breezy', 'Breezy'], ['gale', 'Gale']],
              config.wind,
            )}</select></div>
          <div class="field"><label for="wind-change">Wind changes</label>
            <select id="wind-change">${options(
              [['turn', 'Every 10 seconds'], ['round', 'Every round']],
              config.windChange,
            )}</select></div>
          <div class="field"><label for="planes">Planes</label>
            <select id="planes">${options(
              [['off', 'Off'], ['few', 'Few'], ['some', 'Some'], ['many', 'Many']],
              config.planes,
            )}</select></div>
          <div class="field"><label for="gravity">Gravity</label>
            <select id="gravity">${options(
              [['low', 'Low'], ['normal', 'Normal'], ['high', 'High']],
              config.gravity,
            )}</select></div>
        </div>

        <h2 style="margin-top:20px">Computer players (${config.players.length})</h2>
        <p class="note" style="margin:0 0 8px">People join with their phones on the next screen. Add computer players here to fill out the battle.</p>
        <div class="players">
          ${config.players
            .map(
              (p, i) => `
            <div class="player-row cpu-row" data-i="${i}">
              <span class="swatch" style="background:${p.color}" aria-hidden="true"></span>
              <input type="text" maxlength="12" value="${esc(p.name)}" data-act="name" aria-label="Name for computer player ${i + 1}" id="name-${i}">
              <select data-act="difficulty" class="difficulty" aria-label="Difficulty" id="diff-${i}">${options(
                DIFFICULTIES.map((d) => [d, DIFFICULTY_LABEL[d]] as [Difficulty, string]),
                p.difficulty,
              )}</select>
              <button type="button" class="btn small" data-act="remove" aria-label="Remove ${esc(p.name)}">✕</button>
            </div>`,
            )
            .join('')}
        </div>
        <div class="row" style="justify-content:flex-start;margin-top:10px">
          <button type="button" class="btn" data-act="add-cpu" ${config.players.length >= MAX_PLAYERS - 1 ? 'disabled' : ''}>Add computer</button>
        </div>
        <p class="errors" id="errors" role="alert"></p>
        <div class="footer-actions">
          <button type="button" class="btn" data-act="back">Back</button>
          <button type="submit" class="btn primary">Next: join with phones</button>
        </div>
      </form>`;
    bind();
  };

  const read = () => {
    const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
    config.rounds = Number(q<HTMLInputElement>('#rounds').value);
    config.startingCoins = Number(q<HTMLSelectElement>('#coins').value);
    config.interestPct = Number(q<HTMLSelectElement>('#interest').value);
    config.terrain = q<HTMLSelectElement>('#terrain').value as GameConfig['terrain'];
    config.wind = q<HTMLSelectElement>('#wind').value as GameConfig['wind'];
    config.windChange = q<HTMLSelectElement>('#wind-change').value as GameConfig['windChange'];
    config.gravity = q<HTMLSelectElement>('#gravity').value as GameConfig['gravity'];
    config.planes = q<HTMLSelectElement>('#planes').value as GameConfig['planes'];
    root.querySelectorAll<HTMLElement>('.player-row').forEach((row) => {
      const p = config.players[Number(row.dataset.i)];
      p.name = row.querySelector<HTMLInputElement>('[data-act="name"]')!.value;
      p.difficulty = row.querySelector<HTMLSelectElement>('[data-act="difficulty"]')!.value as Difficulty;
    });
  };

  const unusedColor = () => PLAYER_COLORS.find((c) => !config.players.some((p) => p.color === c)) ?? PLAYER_COLORS[0];

  const bind = () => {
    const form = root.querySelector<HTMLFormElement>('#setup-form')!;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      read();
      const errors = validateSettings(config);
      if (errors.length) {
        root.querySelector('#errors')!.textContent = errors.join(' ');
        return;
      }
      opts.onStart(config);
    });
    form.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (!btn || btn.tagName === 'INPUT' || btn.tagName === 'SELECT') return;
      const act = btn.dataset.act;
      const row = btn.closest<HTMLElement>('.player-row');
      const i = row ? Number(row.dataset.i) : -1;
      read();
      if (act === 'back') return opts.onBack();
      if (act === 'remove') config.players.splice(i, 1);
      if (act === 'add-cpu') {
        const name = CPU_NAMES.find((n) => !config.players.some((p) => p.name === n)) ?? `CPU ${config.players.length + 1}`;
        config.players.push({ name, color: unusedColor(), kind: 'cpu', difficulty: 'normal' });
      }
      draw();
    });
  };

  draw();
}

// ---- Shop -------------------------------------------------------------------------

export interface ShopperState {
  name: string;
  color: string;
  ready: boolean;
  connected: boolean;
}

/** The host's view while everyone shops on their phone. */
export function renderShopWait(root: HTMLElement, match: Match, shoppers: ShopperState[], cpuNote: string, room: string): void {
  root.innerHTML = `
    <h1 class="logo" style="font-size:28px">SHOP</h1>
    <p class="tagline">Round ${match.round} of ${match.config.rounds}. Everyone is shopping on their phone.</p>
    <div class="panel">
      <ul class="shoppers">${shoppers
        .map(
          (s) => `<li><span class="dot" style="background:${s.color}"></span>${esc(s.name)}
            <span class="shopper-state ${s.ready ? 'ready' : ''}">${!s.connected ? 'Disconnected' : s.ready ? 'Ready' : 'Shopping…'}</span></li>`,
        )
        .join('')}</ul>
      ${cpuNote ? `<p class="note">${esc(cpuNote)}</p>` : ''}
      <p class="note">The battle starts when every phone taps Ready. Dropped out? Rejoin with room code <b>${esc(room)}</b>.</p>
    </div>`;
}

/** One line describing what the computer players bought. */
export function describePurchases(match: Match, bought: Map<number, ShopId[]>): string {
  const parts: string[] = [];
  for (const [i, ids] of bought) {
    if (!ids.length) continue;
    const counts = new Map<ShopId, number>();
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
    const list = [...counts].map(([id, n]) => `${n > 1 ? `${n}× ` : ''}${id in WEAPONS ? WEAPONS[id as keyof typeof WEAPONS].name : ITEMS[id as keyof typeof ITEMS].name}`);
    parts.push(`${match.players[i].name} bought ${list.join(', ')}.`);
  }
  return parts.join(' ');
}

// ---- Results ----------------------------------------------------------------------

export function renderResults(root: HTMLElement, match: Match, summary: RoundSummary, onNext: () => void): void {
  const winner = summary.winner !== null ? match.players[summary.winner] : null;
  const last = match.round >= match.config.rounds;
  root.innerHTML = `
    <h1 class="logo" style="font-size:28px">ROUND ${summary.round}</h1>
    <p class="tagline">${winner ? `${esc(winner.name)} wins the round!` : 'Nobody survived. The round is a draw.'}</p>
    <div class="panel">
      <div class="table-wrap"><table>
        <thead><tr><th>Player</th><th class="num">Damage</th><th class="num">Kills</th><th class="num">Earned</th><th class="num">Cash</th><th class="num">Score</th></tr></thead>
        <tbody>${match.players
          .map((p, i) => {
            const s = summary.stats[i];
            return `<tr class="${i === summary.winner ? 'winner-row' : ''}">
              <td><span class="dot" style="background:${p.color}"></span>${esc(p.name)}</td>
              <td class="num">${fmt(s.damageDealt)}</td>
              <td class="num">${s.kills}</td>
              <td class="num">+$${fmt(s.coinsEarned)}</td>
              <td class="num">$${fmt(p.coins)}</td>
              <td class="num">${p.score}</td>
            </tr>`;
          })
          .join('')}</tbody>
      </table></div>
      <p class="note">Earned includes damage pay, kill bonuses, plane rewards${winner ? ', the win bonus' : ''} and ${match.config.interestPct}% interest.</p>
      <div class="footer-actions">
        <button class="btn primary" data-act="next" id="next-btn">${last ? 'Final standings' : 'Next round'}</button>
      </div>
    </div>`;
  const btn = root.querySelector<HTMLButtonElement>('[data-act="next"]')!;
  btn.addEventListener('click', onNext);
  btn.focus();
}

export function renderFinal(root: HTMLElement, match: Match, opts: { onAgain: () => void; onSetup: () => void }): void {
  const standings = match.standings();
  root.innerHTML = `
    <h1 class="logo" style="font-size:28px">FINAL STANDINGS</h1>
    <p class="tagline">${esc(standings[0].name)} takes the match after ${match.config.rounds} round${match.config.rounds === 1 ? '' : 's'}.</p>
    <div class="panel">
      <div class="table-wrap"><table>
        <thead><tr><th class="num">#</th><th>Player</th><th class="num">Score</th><th class="num">Kills</th><th class="num">Cash</th></tr></thead>
        <tbody>${standings
          .map(
            (p, i) => `<tr class="${i === 0 ? 'winner-row' : ''}">
              <td class="num">${i + 1}</td>
              <td><span class="dot" style="background:${p.color}"></span>${esc(p.name)}${p.kind === 'cpu' ? ` <span class="desc">(${DIFFICULTY_LABEL[p.difficulty]} CPU)</span>` : ''}</td>
              <td class="num">${p.score}</td>
              <td class="num">${p.totalKills}</td>
              <td class="num">$${fmt(p.coins)}</td>
            </tr>`,
          )
          .join('')}</tbody>
      </table></div>
      <div class="footer-actions">
        <button class="btn" data-act="setup">Change setup</button>
        <button class="btn primary" data-act="again">Play again</button>
      </div>
    </div>`;
  root.querySelector('[data-act="again"]')!.addEventListener('click', opts.onAgain);
  root.querySelector('[data-act="setup"]')!.addEventListener('click', opts.onSetup);
}

// ---- Lobby ------------------------------------------------------------------------

export interface LobbyView {
  /** Room code, or null while the room is still opening. */
  room: string | null;
  joinUrl: string | null;
  error: string | null;
  players: LobbyPlayer[];
  canStart: boolean;
}

/** Draws a small preview of a tank design onto a canvas, scaled up with crisp pixels. */
export function drawTankPreview(c: HTMLCanvasElement, color: string, design: LobbyPlayer['design'], angle = 50): void {
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const w = 24;
  const h = 18;
  const scale = Math.max(1, Math.floor(Math.min(c.width / w, c.height / h)));
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.save();
  ctx.translate(Math.floor((c.width - w * scale) / 2), Math.floor((c.height - h * scale) / 2));
  ctx.scale(scale, scale);
  drawTankSprite(ctx, 12, 16, angle, color, design);
  ctx.restore();
}

export function renderLobby(
  root: HTMLElement,
  view: LobbyView,
  opts: { onStart: () => void; onBack: () => void; onRetry: () => void; drawQr: (canvas: HTMLCanvasElement, url: string) => void },
): void {
  const status = view.error
    ? `<p class="errors" role="alert">${esc(view.error)}</p><button class="btn" data-act="retry">Try again</button>`
    : !view.room
      ? '<p class="note">Opening a room…</p>'
      : '';
  root.innerHTML = `
    <h1 class="logo" style="font-size:28px">JOIN THE BATTLE</h1>
    <div class="lobby">
      <div class="panel lobby-join">
        ${
          view.room && view.joinUrl
            ? `<canvas class="qr" width="264" height="264" aria-label="QR code to join"></canvas>
               <p class="join-text">Scan with your phone's camera, or open<br><b class="join-url">${esc(view.joinUrl.replace(/^https?:\/\//, '').replace(/\?.*$/, ''))}</b><br>and enter code</p>
               <p class="room-code">${esc(view.room)}</p>`
            : status
        }
      </div>
      <div class="panel lobby-players">
        <h2>Tanks (${view.players.length} of ${MAX_PLAYERS})</h2>
        ${
          view.players.length
            ? `<ul class="lobby-list">${view.players
                .map(
                  (p, i) => `<li><canvas class="tank-preview" width="48" height="36" data-i="${i}" aria-hidden="true"></canvas>
                    <span class="lobby-name" style="color:${p.color}">${esc(p.name)}</span>
                    <span class="desc">${p.cpu ? 'Computer' : TANK_DESIGN_NAMES[p.design]}</span></li>`,
                )
                .join('')}</ul>`
            : '<p class="note">Waiting for phones to join…</p>'
        }
        <p class="note">${view.players.some((p) => !p.cpu) ? '' : 'At least one phone needs to join. '}Hold your phone sideways once the battle starts.</p>
        <div class="footer-actions">
          <button class="btn" data-act="back">Back to setup</button>
          <button class="btn primary" data-act="start" ${view.canStart ? '' : 'disabled'}>Start battle</button>
        </div>
      </div>
    </div>`;
  const qr = root.querySelector<HTMLCanvasElement>('canvas.qr');
  if (qr && view.joinUrl) opts.drawQr(qr, view.joinUrl);
  root.querySelectorAll<HTMLCanvasElement>('canvas.tank-preview').forEach((c) => {
    const p = view.players[Number(c.dataset.i)];
    drawTankPreview(c, p.color, p.design);
  });
  root.onclick = (e) => {
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'start') opts.onStart();
    if (act === 'back') opts.onBack();
    if (act === 'retry') opts.onRetry();
  };
}
