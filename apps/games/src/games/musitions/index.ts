// Musitions: draw lines, a kid on a sled rides them, and the lines play music.
// The higher the line, the higher the note. Steep climbs get a spring.
import './style.css';
import type { GameModule } from '../types';
import {
  BEAT, LANES, LANE_H, NOTE_NAMES, Ride, TEMPOS, TOP, WORLD_H, WORLD_W,
  demoLines, finalBonuses, laneOf, laneY, noteName, rating, scoreNote, segAt, springSpots, yOn,
  type Award, type Line, type Played, type Pt, type RideEvent, type Tempo,
} from './game';
import { INSTRUMENTS, boing, fanfare, isMuted, playNote, setMuted, thump, unlockAudio, type Instrument } from './audio';

const SAVE_KEY = 'musitions-song-v1';
const SET_KEY = 'musitions-settings-v1';
const BEST_KEY = 'musitions-best';
const GUTTER = 34; // screen px for the note letters on the left
const NOTE_COLORS = ['#ff5a5f', '#ff9f43', '#ffd93d', '#6bd66b', '#3ec7c2', '#4d8dff', '#a66bff'];
const TEMPO_ICON: Record<Tempo, string> = { slow: '🐢', normal: '🚶', fast: '🐇' };
const TEMPO_ORDER: Tempo[] = ['slow', 'normal', 'fast'];
type Mode = 'draw' | 'pan' | 'erase';

const HELP = `
  <h2>Musitions</h2>
  <p>Make music with a sled! Draw lines and a kid on a sled rides along them. Every time the sled crosses a beat line, it plays the note it's on: <b>the higher the line, the higher the note</b>.</p>
  <ul>
    <li>✏️ <b>Draw</b>: drag to draw a line, or <b>tap</b> to put down dots that join into a line. With 🧲 snap on, taps land right on a note and a beat.</li>
    <li>🌈 The colored lines are the notes <b>C D E F G A B</b>, low at the bottom and high at the top.</li>
    <li>🌀 If your line goes <b>steeply up</b>, a spring pops up and jumps the sled onto the high part.</li>
    <li>🤫 While the sled is in the air, it's quiet: that's a rest. Leave gaps between lines for rests too.</li>
    <li>▶ <b>Ride</b> to hear your song. <b>The more it sounds like a normal song, the more points</b>: small steps up and down, tunes that come back, and ending on <b>C</b> all score big. Too many of the same note or huge jumps don't.</li>
    <li>✋ <b>Move</b> slides along the song (or use two fingers, the mouse wheel or the arrow keys). 🧽 <b>Erase</b> rubs lines out. ↶ undoes.</li>
  </ul>
  <p><kbd>Space</kbd> ride/stop · <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo · <kbd>D</kbd> draw · <kbd>M</kbd> move · <kbd>E</kbd> erase · arrows scroll</p>`;

interface Floater { x: number; y: number; text: string; color: string; t: number }
interface Spark { x: number; y: number; vx: number; vy: number; t: number; color: string }

function loadJSON<T>(key: string, fallback: T): T {
  try { const s = localStorage.getItem(key); return s ? (JSON.parse(s) as T) : fallback; } catch { return fallback; }
}
function saveJSON(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ }
}

function distToSeg(p: Pt, a: Pt, b: Pt) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

const game: GameModule = {
  mount(root, { onExit }) {
    document.title = 'Musitions';
    root.innerHTML = `
    <div class="mu">
      <canvas class="mu-canvas"></canvas>
      <div class="mu-bar">
        <button data-b="exit" title="Back to games">✕</button>
        <button data-b="play" class="mu-play" title="Ride (Space)">▶ Ride</button>
        <span class="mu-sep"></span>
        <button data-b="draw" title="Draw (D)">✏️</button>
        <button data-b="pan" title="Move (M)">✋</button>
        <button data-b="erase" title="Erase (E)">🧽</button>
        <button data-b="undo" title="Undo (Ctrl+Z)">↶</button>
        <button data-b="clear" title="Clear everything">🗑️</button>
        <span class="mu-sep"></span>
        <button data-b="snap" title="Snap taps to notes and beats">🧲</button>
        <button data-b="inst" title="Instrument"></button>
        <button data-b="tempo" title="Speed"></button>
        <button data-b="demo" title="Load the starter song">🎼</button>
        <button data-b="mute" title="Sound"></button>
        <button data-b="help" title="How to play">❓</button>
        <div class="mu-score"></div>
      </div>
      <div class="mu-trail"></div>
      <div class="mu-hint"></div>
      <div class="mu-panel mu-help hidden"><div class="mu-card">${HELP}<button data-b="closehelp" class="mu-big">Let's make music!</button></div></div>
      <div class="mu-panel mu-result hidden"><div class="mu-card mu-res"></div></div>
    </div>`;
    const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
    const canvas = $<HTMLCanvasElement>('.mu-canvas');
    const ctx = canvas.getContext('2d')!;
    const bar = $('.mu-bar');
    const scoreEl = $('.mu-score');
    const trailEl = $('.mu-trail');
    const hintEl = $('.mu-hint');
    const helpEl = $('.mu-help');
    const resEl = $('.mu-result');

    // ---- state ----
    const firstVisit = loadJSON<Line[] | null>(SAVE_KEY, null) === null;
    let lines: Line[] = loadJSON<Line[]>(SAVE_KEY, demoLines());
    const settings = loadJSON(SET_KEY, { snap: true, inst: 'bells' as Instrument, tempo: 'normal' as Tempo });
    let mode: Mode = 'draw';
    const undo: string[] = [];
    let camX = -GUTTER;
    let ride: Ride | null = null;
    let played: Played[] = [];
    let score = 0;
    let floaters: Floater[] = [];
    let sparks: Spark[] = [];
    const laneFlash = new Array(LANES).fill(0);
    let springHit: Pt | null = null, springT = 0;
    let tapLine: Line | null = null;
    let hover: Pt | null = null;
    let W = 0, H = 0, dpr = 1, scale = 1, offY = 0;
    let time = 0;

    const save = () => saveJSON(SAVE_KEY, lines);
    const saveSettings = () => saveJSON(SET_KEY, settings);
    const pushUndo = () => { undo.push(JSON.stringify(lines)); if (undo.length > 80) undo.shift(); };
    const viewW = () => (W - 0) / scale;

    function resize() {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      // Fit the note lanes (not the empty sky above them) between the toolbar and the note trail.
      const barH = bar.getBoundingClientRect().height + 6;
      const top = TOP - LANE_H, span = (LANES - 1) * LANE_H + LANE_H * 2;
      scale = Math.max(0.25, (H - barH - 30) / span);
      offY = barH - top * scale;
      clampCam();
    }
    function clampCam() { camX = Math.max(-GUTTER / scale - 20, Math.min(WORLD_W - viewW() + 60, camX)); }
    const toWorld = (sx: number, sy: number): Pt => ({ x: sx / scale + camX, y: (sy - offY) / scale });

    // ---- toolbar ----
    function refreshBar() {
      bar.querySelectorAll<HTMLButtonElement>('[data-b=draw],[data-b=pan],[data-b=erase]').forEach((b) => b.classList.toggle('on', b.dataset.b === mode));
      $('[data-b=snap]').classList.toggle('on', settings.snap);
      $('[data-b=inst]').textContent = INSTRUMENTS.find((i) => i.id === settings.inst)!.name.split(' ')[0];
      $('[data-b=inst]').title = 'Instrument: ' + INSTRUMENTS.find((i) => i.id === settings.inst)!.name.split(' ')[1];
      $('[data-b=tempo]').textContent = TEMPO_ICON[settings.tempo];
      $('[data-b=tempo]').title = 'Speed: ' + settings.tempo;
      $('[data-b=mute]').textContent = isMuted() ? '🔇' : '🔊';
      $('[data-b=play]').textContent = ride ? '■ Stop' : '▶ Ride';
      $('[data-b=play]').classList.toggle('stop', !!ride);
      bar.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
        if (!['play', 'exit', 'mute', 'help', 'inst', 'tempo'].includes(b.dataset.b!)) b.disabled = !!ride;
      });
      const best = Number(localStorage.getItem(BEST_KEY) || 0);
      scoreEl.innerHTML = ride ? `♪ <b>${score}</b> pts` : best ? `Best: <b>${best}</b>` : '';
      hint();
    }
    function hint() {
      let h = '';
      if (!ride) {
        if (!lines.some((l) => l.pts.length > 1)) h = mode === 'draw' ? 'Drag or tap to draw a line for the sled' : '';
        else if (tapLine && tapLine.pts.length === 1) h = 'Tap again to the right to join the dots';
      }
      hintEl.textContent = h;
      hintEl.classList.toggle('hidden', !h);
    }

    bar.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button')?.dataset.b;
      if (!b) return;
      unlockAudio();
      act(b);
    });
    root.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.mu-panel button')?.dataset.b;
      if (b) act(b);
    });

    function act(b: string) {
      switch (b) {
        case 'exit': onExit(); return;
        case 'play': ride ? stopRide() : startRide(); break;
        case 'draw': case 'pan': case 'erase': mode = b; tapLine = null; break;
        case 'undo': { const s = undo.pop(); if (s) { lines = JSON.parse(s); tapLine = null; save(); } break; }
        case 'clear': trailEl.innerHTML = ''; if (lines.length) { pushUndo(); lines = []; tapLine = null; save(); camX = -GUTTER / scale - 20; } break;
        case 'snap': settings.snap = !settings.snap; saveSettings(); break;
        case 'inst': {
          const i = INSTRUMENTS.findIndex((x) => x.id === settings.inst);
          settings.inst = INSTRUMENTS[(i + 1) % INSTRUMENTS.length].id; saveSettings();
          playNote(7, settings.inst);
          break;
        }
        case 'tempo': settings.tempo = TEMPO_ORDER[(TEMPO_ORDER.indexOf(settings.tempo) + 1) % 3]; saveSettings(); if (ride) ride.speed = TEMPOS[settings.tempo]; break;
        case 'demo': pushUndo(); lines = demoLines(); tapLine = null; save(); camX = -GUTTER / scale - 20; break;
        case 'mute': setMuted(!isMuted()); break;
        case 'help': helpEl.classList.remove('hidden'); break;
        case 'closehelp': helpEl.classList.add('hidden'); break;
        case 'again': resEl.classList.add('hidden'); startRide(); break;
        case 'keep': resEl.classList.add('hidden'); trailEl.innerHTML = ''; break;
      }
      refreshBar();
    }

    // ---- riding ----
    function startRide() {
      if (!Ride.canRide(lines)) { hintEl.textContent = 'Draw a line first!'; hintEl.classList.remove('hidden'); return; }
      resEl.classList.add('hidden');
      helpEl.classList.add('hidden');
      ride = new Ride(lines, TEMPOS[settings.tempo]);
      played = []; score = 0; floaters = []; trailEl.innerHTML = '';
      camX = ride.x - viewW() * 0.25;
      clampCam();
      refreshBar();
    }
    function stopRide() { ride = null; refreshBar(); }

    function award(a: Award | null, x: number, y: number) {
      if (!a) return;
      score += a.pts;
      floaters.push({ x, y: y - 50, text: `${a.pts >= 0 ? '+' : ''}${a.pts} ${a.why}`, color: a.pts >= 0 ? '#fff6a8' : '#ffb0b0', t: 0 });
    }

    function handle(ev: RideEvent) {
      if (!ride) return;
      if (ev.t === 'note') {
        playNote(ev.lane, settings.inst, (BEAT / ride.speed) * 0.9);
        laneFlash[ev.lane] = 1;
        const cur = { lane: ev.lane, beat: ev.beat };
        award(scoreNote(played, cur), ride.x, ride.y);
        played.push(cur);
        const chip = document.createElement('span');
        chip.textContent = noteName(ev.lane);
        chip.style.background = NOTE_COLORS[ev.lane % 7];
        if (ev.lane >= 7) chip.classList.add('hi');
        trailEl.appendChild(chip);
        while (trailEl.children.length > 24) trailEl.firstChild!.remove();
        for (let i = 0; i < 6; i++) sparks.push({ x: ride.x, y: ride.y - 20, vx: (Math.random() - 0.5) * 160, vy: -Math.random() * 160 - 40, t: 0, color: NOTE_COLORS[ev.lane % 7] });
        refreshBar();
      } else if (ev.t === 'spring') {
        boing();
        springHit = { x: ev.x, y: ev.y }; springT = 0;
      } else if (ev.t === 'land') {
        thump();
        for (let i = 0; i < 8; i++) sparks.push({ x: ride.x, y: ride.y, vx: (Math.random() - 0.3) * 200, vy: -Math.random() * 120, t: 0, color: '#ffffff' });
      } else if (ev.t === 'end') {
        finish(ev.why);
      }
    }

    function finish(why: 'done' | 'fell') {
      const bonuses = finalBonuses(played);
      const base = score;
      for (const b of bonuses) score += b.pts;
      score = Math.max(0, score);
      const r = rating(score);
      const best = Number(localStorage.getItem(BEST_KEY) || 0);
      const newBest = score > best;
      if (newBest) try { localStorage.setItem(BEST_KEY, String(score)); } catch { /* ignore */ }
      ride = null;
      fanfare(r.stars);
      $('.mu-res').innerHTML = `
        <h2>${played.length < 2 ? 'Not much of a song yet…' : r.name}</h2>
        <div class="mu-stars">${'★'.repeat(r.stars)}<span>${'★'.repeat(5 - r.stars)}</span></div>
        <div class="mu-total">${score} points${newBest ? ' <em>New best!</em>' : ''}</div>
        <table>
          <tr><td>${played.length} notes as you rode</td><td>${base >= 0 ? '+' : ''}${base}</td></tr>
          ${bonuses.map((b) => `<tr><td>${b.why}</td><td>+${b.pts}</td></tr>`).join('')}
        </table>
        ${why === 'fell' ? '<p class="mu-tip">The sled fell off the bottom. Catch it with a line underneath!</p>' : ''}
        ${played.length && played[played.length - 1].lane % 7 !== 0 ? '<p class="mu-tip">Tip: songs usually end on C.</p>' : ''}
        <div class="mu-row"><button data-b="again" class="mu-big">▶ Ride again</button><button data-b="keep" class="mu-big alt">✏️ Keep drawing</button></div>`;
      resEl.classList.remove('hidden');
      refreshBar();
    }

    // ---- drawing input ----
    const pointers = new Map<number, { x: number; y: number }>();
    let gesture: { kind: 'draw' | 'pan' | 'erase' | 'pinch'; sx: number; sy: number; line: Line | null; moved: boolean; lastX: number; undoPushed?: boolean } | null = null;

    function snapPt(p: Pt): Pt {
      if (!settings.snap) return { x: p.x, y: Math.max(0, Math.min(WORLD_H, p.y)) };
      return { x: Math.round(p.x / BEAT) * BEAT, y: laneY(laneOf(p.y)) };
    }
    function eraseAt(p: Pt) {
      const before = lines.length;
      const r = 16 / Math.min(1, scale);
      const keep = lines.filter((l) => {
        if (l.pts.length === 1) return Math.hypot(l.pts[0].x - p.x, l.pts[0].y - p.y) > r;
        for (let i = 0; i < l.pts.length - 1; i++) if (distToSeg(p, l.pts[i], l.pts[i + 1]) < r) return false;
        return true;
      });
      if (keep.length !== before) {
        if (gesture && !gesture.undoPushed) { pushUndo(); gesture.undoPushed = true; }
        lines = keep;
        if (tapLine && !lines.includes(tapLine)) tapLine = null;
      }
    }

    canvas.addEventListener('pointerdown', (e) => {
      unlockAudio();
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      if (pointers.size === 2) {
        // Two fingers: slide along the song instead of drawing.
        if (gesture?.kind === 'draw' && gesture.line) {
          if (gesture.line.pts.length < 3) { lines = lines.filter((l) => l !== gesture!.line); undo.pop(); }
        }
        const xs = [...pointers.values()];
        gesture = { kind: 'pinch', sx: (xs[0].x + xs[1].x) / 2, sy: 0, line: null, moved: true, lastX: (xs[0].x + xs[1].x) / 2 };
        return;
      }
      if (pointers.size > 2) return;
      const kind = ride || mode === 'pan' || e.button === 1 || e.button === 2 ? 'pan' : mode;
      gesture = { kind, sx: e.offsetX, sy: e.offsetY, line: null, moved: false, lastX: e.offsetX };
      if (kind === 'erase') eraseAt(toWorld(e.offsetX, e.offsetY));
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse' && !pointers.size) {
        hover = mode === 'draw' && !ride ? snapPt(toWorld(e.offsetX, e.offsetY)) : null;
        return;
      }
      if (!pointers.has(e.pointerId) || !gesture) return;
      pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      hover = null;
      const g = gesture;
      if (g.kind === 'pinch') {
        const xs = [...pointers.values()];
        if (xs.length < 2) return;
        const mx = (xs[0].x + xs[1].x) / 2;
        camX -= (mx - g.lastX) / scale; g.lastX = mx; clampCam();
        return;
      }
      if (!g.moved && Math.hypot(e.offsetX - g.sx, e.offsetY - g.sy) > 6) {
        g.moved = true;
        if (g.kind === 'draw') {
          pushUndo();
          const p0 = toWorld(g.sx, g.sy);
          g.line = { pts: [{ x: p0.x, y: Math.max(0, Math.min(WORLD_H, p0.y)) }] };
          lines.push(g.line);
        }
      }
      if (!g.moved) return;
      if (g.kind === 'pan') { camX -= (e.offsetX - g.lastX) / scale; g.lastX = e.offsetX; clampCam(); }
      else if (g.kind === 'erase') eraseAt(toWorld(e.offsetX, e.offsetY));
      else if (g.kind === 'draw' && g.line) {
        const p = toWorld(e.offsetX, e.offsetY);
        p.y = Math.max(0, Math.min(WORLD_H, p.y));
        const last = g.line.pts[g.line.pts.length - 1];
        // Lines only run left to right so the sled always knows where it is.
        if (p.x < last.x) return;
        if (Math.hypot(p.x - last.x, p.y - last.y) >= 5 / scale) g.line.pts.push(p);
        // Keep drawing past the screen edge: scroll along.
        if (e.offsetX > W - 50) { camX += 6 / scale; clampCam(); }
      }
    });
    const endPointer = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      const g = gesture;
      if (!g) return;
      if (g.kind === 'pinch') { if (!pointers.size) gesture = null; return; }
      if (pointers.size) return;
      gesture = null;
      if (g.kind === 'draw') {
        if (!g.moved && e.type === 'pointerup') {
          // A tap: put down a dot, joined to the last tapped one if it's to the right.
          const p = snapPt(toWorld(g.sx, g.sy));
          pushUndo();
          if (tapLine && lines.includes(tapLine) && p.x > tapLine.pts[tapLine.pts.length - 1].x) tapLine.pts.push(p);
          else {
            // Tapping on top of a lonely dot removes it.
            const dot = lines.find((l) => l.pts.length === 1 && Math.hypot(l.pts[0].x - p.x, l.pts[0].y - p.y) < 12);
            if (dot) { lines = lines.filter((l) => l !== dot); tapLine = null; }
            else { tapLine = { pts: [p] }; lines.push(tapLine); }
          }
          playNote(laneOf(p.y), settings.inst, 0.3);
        } else if (g.line) {
          if (g.line.pts.length < 2) { lines = lines.filter((l) => l !== g.line); undo.pop(); }
          else tapLine = g.line;
        }
        save();
      } else if (g.kind === 'erase') save();
      refreshBar();
    };
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('pointerleave', () => { hover = null; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      camX += (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) / scale;
      clampCam();
    }, { passive: false });

    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.code === 'Space') { e.preventDefault(); unlockAudio(); act('play'); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (!ride) act('undo'); }
      else if (e.key === 'ArrowRight') { camX += 120 / scale; clampCam(); }
      else if (e.key === 'ArrowLeft') { camX -= 120 / scale; clampCam(); }
      else if (e.key === 'Escape') { helpEl.classList.add('hidden'); resEl.classList.add('hidden'); }
      else if (!ride && !e.ctrlKey && !e.metaKey) {
        const k = e.key.toLowerCase();
        if (k === 'd') act('draw'); else if (k === 'm') act('pan'); else if (k === 'e') act('erase');
      }
    };
    window.addEventListener('keydown', onKey);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // ---- drawing the world ----
    function drawSky() {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#1b2350');
      g.addColorStop(0.55, '#4b4f9a');
      g.addColorStop(1, '#c79ad6');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // Stars that drift slowly with the camera.
      ctx.fillStyle = 'rgba(255,255,240,.8)';
      for (let i = 0; i < 70; i++) {
        const sx = ((i * 137.5 - camX * scale * 0.05) % (W + 40) + W + 40) % (W + 40) - 20;
        const sy = (i * 61.7) % (H * 0.5);
        const tw = 0.6 + 0.4 * Math.sin(time * 2 + i);
        ctx.globalAlpha = tw * 0.8;
        ctx.fillRect(sx, sy, 1.6, 1.6);
      }
      ctx.globalAlpha = 1;
      // Moon
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#fff6d8';
      ctx.beginPath(); ctx.arc(W - 70, offY + TOP * scale, 22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8ddb8';
      ctx.beginPath(); ctx.arc(W - 76, offY + TOP * scale - 4, 4, 0, Math.PI * 2); ctx.arc(W - 63, offY + TOP * scale + 7, 3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      // Snowy hills far away (parallax).
      const hills = (k: number, base: number, amp: number, col: string) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (let x = 0; x <= W + 20; x += 20) {
          const wx = x + camX * scale * k;
          ctx.lineTo(x, base - amp * (Math.sin(wx * 0.004) * 0.6 + Math.sin(wx * 0.011 + 1.3) * 0.4));
        }
        ctx.lineTo(W, H);
        ctx.fill();
      };
      hills(0.15, H * 0.82, 50, '#8d86c6');
      hills(0.3, H * 0.9, 34, '#b9b2e4');
      ctx.fillStyle = '#eef2ff';
      ctx.fillRect(0, H - 22, W, 22);
    }

    function drawWorld() {
      const x0 = camX, x1 = camX + viewW();
      // Beat lines (stronger every 4 beats).
      const b0 = Math.max(0, Math.floor(x0 / BEAT)), b1 = Math.min(Math.ceil(x1 / BEAT), WORLD_W / BEAT);
      const yTop = TOP - LANE_H * 0.7, yBot = laneY(0) + LANE_H * 0.7;
      for (let b = b0; b <= b1; b++) {
        const bar = b % 4 === 0;
        ctx.strokeStyle = bar ? 'rgba(255,255,255,.28)' : 'rgba(255,255,255,.1)';
        ctx.lineWidth = (bar ? 2 : 1) / scale;
        ctx.beginPath(); ctx.moveTo(b * BEAT, yTop); ctx.lineTo(b * BEAT, yBot); ctx.stroke();
        if (bar) {
          ctx.fillStyle = 'rgba(255,255,255,.45)';
          ctx.font = `${11 / scale}px system-ui, sans-serif`;
          ctx.textAlign = 'left';
          ctx.fillText(String(b / 4 + 1), b * BEAT + 3 / scale, yTop + 2 / scale);
        }
      }
      // End of the world
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      ctx.fillRect(WORLD_W, yTop, 4000, yBot - yTop);
      // Note lines with their letters.
      for (let l = 0; l < LANES; l++) {
        const y = laneY(l);
        const col = NOTE_COLORS[l % 7];
        ctx.strokeStyle = col;
        ctx.globalAlpha = 0.3 + laneFlash[l] * 0.6;
        ctx.lineWidth = (l % 7 === 0 ? 3 : 2) / scale + laneFlash[l] * 4;
        ctx.beginPath(); ctx.moveTo(Math.max(0, x0), y); ctx.lineTo(Math.min(WORLD_W, x1), y); ctx.stroke();
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = col;
        ctx.font = `bold ${12 / scale}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        if (LANE_H * scale >= 24) for (let b = Math.ceil(b0 / 16) * 16 + 8; b <= b1; b += 16) ctx.fillText(`note ${NOTE_NAMES[l % 7]}`, b * BEAT + BEAT / 2, y - 4 / scale);
        ctx.globalAlpha = 1;
      }
      // Drawn lines.
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      for (const l of lines) {
        if (l.pts.length === 1) {
          const p = l.pts[0];
          ctx.fillStyle = '#fff';
          ctx.strokeStyle = '#2b2f63'; ctx.lineWidth = 2 / scale;
          ctx.beginPath(); ctx.arc(p.x, p.y, 6 / scale + 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          continue;
        }
        if (l.pts[l.pts.length - 1].x < x0 - 50 || l.pts[0].x > x1 + 50) continue;
        const path = () => { ctx.beginPath(); l.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); };
        path(); ctx.strokeStyle = '#2b2f63'; ctx.lineWidth = 9; ctx.stroke();
        path(); ctx.strokeStyle = '#f7fbff'; ctx.lineWidth = 5; ctx.stroke();
        if (l === tapLine && !ride) {
          const e = l.pts[l.pts.length - 1];
          ctx.fillStyle = '#ffe066';
          ctx.beginPath(); ctx.arc(e.x, e.y, 5, 0, Math.PI * 2); ctx.fill();
        }
      }
      // Springs.
      for (const s of springSpots(lines)) {
        const hit = springHit && springHit.x === s.x && springHit.y === s.y ? Math.max(0, 1 - springT * 3) : 0;
        drawSpring(s.x, s.y, hit);
      }
      // Hover dot where a tap would go.
      if (hover && !ride) {
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = NOTE_COLORS[laneOf(hover.y) % 7];
        ctx.beginPath(); ctx.arc(hover.x, hover.y, 7, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
      // The sled: riding, or parked at the start.
      if (ride) drawSled(ride.x, ride.y, ride.angle, true);
      else {
        const real = lines.filter((l) => l.pts.length > 1);
        if (real.length) {
          const first = real.reduce((a, b) => (b.pts[0].x < a.pts[0].x ? b : a));
          const p0 = first.pts[0];
          const s = segAt(first, p0.x + 0.01);
          const a = s >= 0 ? Math.atan2(first.pts[s + 1].y - first.pts[s].y, first.pts[s + 1].x - first.pts[s].x) : 0;
          drawSled(p0.x, s >= 0 ? yOn(first, s, p0.x) : p0.y, Math.max(-0.6, Math.min(0.6, a)), false);
        }
      }
      // Sparkles and points.
      for (const s of sparks) {
        ctx.globalAlpha = Math.max(0, 1 - s.t * 1.6);
        ctx.fillStyle = s.color;
        ctx.beginPath(); ctx.arc(s.x, s.y, 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.textAlign = 'center';
      for (const f of floaters) {
        ctx.globalAlpha = Math.max(0, 1 - f.t / 1.3);
        ctx.font = `bold ${14 / scale}px system-ui, sans-serif`;
        ctx.lineWidth = 4 / scale; ctx.strokeStyle = 'rgba(30,20,60,.8)';
        ctx.strokeText(f.text, f.x, f.y - f.t * 40);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y - f.t * 40);
      }
      ctx.globalAlpha = 1;
    }

    function drawSpring(x: number, y: number, pop: number) {
      const h = 14 + pop * 22;
      ctx.save();
      ctx.translate(x, y);
      ctx.strokeStyle = '#c9ced8'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      for (let i = 0; i <= 6; i++) ctx.lineTo(i % 2 ? 8 : -8, -(h * i) / 6);
      ctx.stroke();
      ctx.fillStyle = '#ff5a5f';
      ctx.fillRect(-12, -h - 4, 24, 5);
      ctx.fillStyle = '#7a7f8c';
      ctx.fillRect(-11, -1, 22, 4);
      ctx.restore();
    }

    function drawSled(x: number, y: number, angle: number, moving: boolean) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.scale(1.2, 1.2);
      // Snow spray behind while riding.
      if (moving && ride && ride.line >= 0) {
        ctx.fillStyle = 'rgba(255,255,255,.7)';
        for (let i = 0; i < 4; i++) {
          const k = (time * 9 + i * 0.25) % 1;
          ctx.beginPath(); ctx.arc(-26 - k * 18, -2 - k * 10, 3 * (1 - k), 0, Math.PI * 2); ctx.fill();
        }
      }
      const bob = moving ? Math.sin(time * 14) * 0.8 : 0;
      // Runner with a curl at the front.
      ctx.strokeStyle = '#3b2a1a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-24, -2); ctx.lineTo(18, -2); ctx.quadraticCurveTo(30, -2, 28, -12); ctx.quadraticCurveTo(26, -17, 21, -13); ctx.stroke();
      ctx.strokeStyle = '#3b2a1a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-14, -2); ctx.lineTo(-14, -8); ctx.moveTo(8, -2); ctx.lineTo(8, -8); ctx.stroke();
      // Sled deck.
      ctx.fillStyle = '#d6453d';
      ctx.beginPath(); ctx.roundRect(-24, -13, 44, 6, 2); ctx.fill();
      ctx.fillStyle = '#f2c14e';
      ctx.fillRect(-20, -12, 36, 1.5);
      ctx.translate(0, bob);
      // Legs stretched forward.
      ctx.fillStyle = '#2f5fae';
      ctx.beginPath(); ctx.roundRect(-8, -20, 24, 7, 3); ctx.fill();
      ctx.fillStyle = '#1e2433';
      ctx.beginPath(); ctx.roundRect(14, -21, 6, 8, 2); ctx.fill();
      // Scarf flapping behind.
      const flap = Math.sin(time * 12) * 3;
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.moveTo(-10, -36); ctx.lineTo(-30, -34 + flap); ctx.lineTo(-28, -29 + flap); ctx.lineTo(-10, -32); ctx.fill();
      // Body (coat).
      ctx.fillStyle = '#2bb39a';
      ctx.beginPath(); ctx.roundRect(-14, -40, 14, 22, 5); ctx.fill();
      // Arm holding the rope to the front curl.
      ctx.strokeStyle = '#2bb39a'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(-4, -34); ctx.lineTo(8, -26); ctx.stroke();
      ctx.strokeStyle = '#eee2c8'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(9, -26); ctx.quadraticCurveTo(18, -20, 24, -14); ctx.stroke();
      ctx.fillStyle = '#e04f8a';
      ctx.beginPath(); ctx.arc(9, -26, 3, 0, Math.PI * 2); ctx.fill();
      // Head.
      ctx.fillStyle = '#f1c9a0';
      ctx.beginPath(); ctx.arc(-6, -47, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e88a8a';
      ctx.beginPath(); ctx.arc(-2, -45, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(-1, -49, 1.3, 0, Math.PI * 2); ctx.fill();
      // Beanie with a pompom.
      ctx.fillStyle = '#e04f8a';
      ctx.beginPath(); ctx.arc(-6, -50, 8.5, Math.PI, 0); ctx.fill();
      ctx.fillRect(-15, -51, 18, 3);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-9, -60, 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    function drawGutter() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = 'rgba(20,18,50,.55)';
      ctx.fillRect(0, offY + (TOP - LANE_H * 0.7) * scale, GUTTER, (LANES - 1 + 1.4) * LANE_H * scale);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const sz = Math.min(14, LANE_H * scale * 0.7);
      for (let l = 0; l < LANES; l++) {
        const y = offY + laneY(l) * scale;
        ctx.fillStyle = NOTE_COLORS[l % 7];
        ctx.globalAlpha = 0.85 + laneFlash[l] * 0.15;
        ctx.beginPath(); ctx.arc(GUTTER / 2, y, sz * 0.75 + laneFlash[l] * 3, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#1b1838';
        ctx.font = `bold ${sz}px system-ui, sans-serif`;
        ctx.fillText(NOTE_NAMES[l % 7], GUTTER / 2, y + 0.5);
      }
      ctx.textBaseline = 'alphabetic';
    }

    // ---- loop ----
    let raf = 0, last = performance.now();
    const events: RideEvent[] = [];
    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      time += dt;
      if (ride) {
        events.length = 0;
        ride.step(dt, events);
        for (const ev of events) handle(ev);
        if (ride) {
          const target = ride.x - viewW() * 0.3;
          camX += (target - camX) * Math.min(1, dt * 4);
          clampCam();
        }
      }
      for (let l = 0; l < LANES; l++) laneFlash[l] = Math.max(0, laneFlash[l] - dt * 2.5);
      springT += dt;
      floaters = floaters.filter((f) => (f.t += dt) < 1.3);
      sparks = sparks.filter((s) => { s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 500 * dt; return s.t < 0.7; });

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawSky();
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, -camX * dpr * scale, offY * dpr);
      drawWorld();
      drawGutter();
    }

    resize();
    refreshBar();
    if (firstVisit) helpEl.classList.remove('hidden');
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('keydown', onKey);
      root.innerHTML = '';
    };
  },
};

export default game;
