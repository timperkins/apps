// The Audio page (/audio/): every sound effect, spoken line and music loop
// the game plays, to listen to one at a time, with what each is, when the
// game plays it, what is said and in whose voice. The words are in data.ts.

import './audio.css';
import type { Loop, Sfx } from '../sfx';
import type { UnitLine, UnitVoice } from '../voice';
import { ANNOUNCE, ANNOUNCE_GAP, GAIN, MUSIC_VOLUME as VOLUME, UNIT_CLIPS } from '../audio-config';
import { ANNOUNCEMENTS, LINES, LINE_TITLE, LINE_WHEN, MUSIC, type MoodId, SFX, SFX_APPLIED, SFX_GROUPS, SFX_OPTIONS, UNIT_NAME, type Use, VOICE_OPTIONS, VOICES } from './data';
import { ROOT, picture } from './pics';
import { load, play, stopAll, type PlayOpts, type Playing } from './player';

const base = ROOT;
const LOOPS: Loop[] = ['tracks_loop', 'engine_loop', 'rotor_loop', 'boat_loop', 'footsteps', 'ore_dig', 'surf_loop', 'fire_loop'];
const isLoop = (n: string): n is Loop => (LOOPS as string[]).includes(n);

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

const secs = (s: number) => (s < 10 ? `${s.toFixed(2)} s` : s < 60 ? `${s.toFixed(1)} s` : `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`);
const pct = (v: number) => `${Math.round(v * 100)}%`;

// ---------- picks: which option is chosen for each sound and voice ----------
// 0 is what the game plays now. Kept in this browser so a reload keeps them.

const PICKS_KEY = 'ra.audio.picks.v2'; // v2: the first picks were applied, and the slots moved
const picks: Record<string, number> = (() => {
  try {
    return JSON.parse(localStorage.getItem(PICKS_KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
})();
const pickListeners: (() => void)[] = [];
function setPick(key: string, i: number): void {
  if (i) picks[key] = i;
  else delete picks[key];
  try {
    localStorage.setItem(PICKS_KEY, JSON.stringify(picks));
  } catch {
    /* private mode */
  }
  for (const f of pickListeners) f();
}

const sfxPath = (n: string) => (picks[`sfx:${n}`] ? `sfx/options/${n}_${picks[`sfx:${n}`]}.mp3` : `sfx/${n}.mp3`);

/** A row of buttons, one per choice; the picked one is lit. */
function choiceGroup(key: string, labels: string[], titles: string[] = []): HTMLElement {
  const g = el('div', 'choices');
  g.setAttribute('role', 'radiogroup');
  const btns = labels.map((l, i) => {
    const b = el('button', 'choice', l);
    b.type = 'button';
    b.setAttribute('role', 'radio');
    if (titles[i]) b.title = titles[i];
    b.addEventListener('click', () => {
      stopAll();
      setPick(key, i);
    });
    g.append(b);
    return b;
  });
  const paint = () => btns.forEach((b, i) => b.setAttribute('aria-checked', String((picks[key] ?? 0) === i)));
  pickListeners.push(paint);
  paint();
  return g;
}

// A file's name and, once it has loaded, how long it is.
function fileMeta(path: string): HTMLElement {
  const m = el('span', 'file');
  const a = el('a', '', path.split('/').pop());
  a.href = base + path;
  a.title = path;
  a.target = '_blank';
  const len = el('span', 'len', '…');
  m.append(a, len);
  void load(base + path).then((b) => (len.textContent = b ? secs(b.duration) : 'missing'));
  return m;
}

// ---------- the play button ----------

let playingBtn: HTMLButtonElement | null = null;
let raf = 0;

/** A button that plays path (stopping anything else); a second press stops it. */
function playBtn(path: string | (() => string), label: string, o: PlayOpts = {}, cls = ''): HTMLButtonElement {
  const b = el('button', `play ${cls}`.trim());
  b.type = 'button';
  const icon = el('span', 'ico');
  icon.setAttribute('aria-hidden', 'true');
  const txt = el('span', 'lbl', label);
  const bar = el('span', 'bar');
  b.append(icon, txt, bar);
  b.title = o.loop ? 'Play on a loop (press again to stop)' : 'Play';
  let p: Playing | null = null;
  b.addEventListener('click', async () => {
    if (playingBtn === b) {
      stopAll();
      return;
    }
    const url = base + (typeof path === 'function' ? path() : path);
    playingBtn?.classList.remove('on');
    playingBtn = b;
    b.classList.add('on');
    p = await play(url, o, () => {
      b.classList.remove('on');
      bar.style.width = '0';
      if (playingBtn === b) playingBtn = null;
      p = null;
    });
    if (!p) return;
    const tick = (): void => {
      if (!p) return;
      bar.style.width = `${p.progress() * 100}%`;
      raf = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(raf);
    tick();
  });
  return b;
}

const rateLabel = (u: Use) => {
  const r = u.rate ?? 1;
  const bits = [r === 1 ? 'as recorded' : `×${r} speed`];
  if (u.reverse) bits.push('backwards');
  return bits.join(', ');
};

// ---------- sound effects ----------

function sfxCard(n: Sfx | Loop): HTMLElement {
  const info = SFX[n];
  const loop = isLoop(n);
  const card = el('section', 'card');
  card.id = n;
  if (info.pic) card.append(picture(info.pic));
  else card.append(el('div', 'pic none'));
  const body = el('div', 'body');
  const head = el('div', 'head');
  head.append(el('h4', '', info.title));
  if (loop) head.append(el('span', 'tag', 'Loop'));
  body.append(head);
  body.append(el('p', 'what', info.what));
  const when = el('p', 'when');
  when.append(el('b', '', 'Plays when: '), info.when);
  body.append(when);
  const key = `sfx:${n}`;
  const old = SFX_APPLIED[n];
  const opts = ['Current', ...Array.from({ length: SFX_OPTIONS }, (_, i) => (i + 1 === old ? 'Old' : `New ${i + 1}`))];
  const titles = opts.map((o, i) => (!i ? 'What the game plays now' : o === 'Old' ? 'What the game played before' : `New ElevenLabs take ${i}`));
  body.append(choiceGroup(key, opts, titles));
  const plays = el('div', 'plays');
  const path = () => sfxPath(n);
  plays.append(playBtn(path, loop ? 'Loop' : 'Play', { loop, gain: 1 }, 'main'));
  // the ways the game plays it: each at its own speed (so its own pitch)
  for (const u of info.uses ?? []) {
    const b = playBtn(path, u.who, { rate: u.rate, reverse: u.reverse, loop }, 'use');
    b.title = rateLabel(u);
    b.append(el('span', 'rate', u.reverse ? `${u.rate ?? 1}× ◂` : `${u.rate ?? 1}×`));
    plays.append(b);
  }
  body.append(plays);
  const meta = el('div', 'meta');
  const file = el('span');
  let shown = '';
  const showFile = () => {
    if (shown === path()) return;
    shown = path();
    file.replaceChildren(fileMeta(shown));
    card.classList.toggle('changed', !!picks[key]);
  };
  pickListeners.push(showFile);
  showFile();
  meta.append(file, el('span', '', `in-game volume ${pct(GAIN[n] ?? 0.5)}`));
  if (!loop && n !== 'whoosh_space' && info.group !== 'ui') meta.append(el('span', '', 'pitched ±5% at random each time'));
  body.append(meta);
  card.append(body);
  return card;
}

function buildSfx(root: HTMLElement): void {
  const names = Object.keys(SFX) as (Sfx | Loop)[];
  for (const g of SFX_GROUPS) {
    const sec = el('div', 'group');
    sec.id = `sfx-${g.id}`;
    sec.append(el('h3', '', g.title), el('p', 'blurb', g.blurb));
    const grid = el('div', 'grid');
    for (const n of names) if (SFX[n].group === g.id) grid.append(sfxCard(n));
    sec.append(grid);
    root.append(sec);
  }
}

// ---------- spoken lines ----------

const LINE_ORDER: UnitLine[] = ['select', 'move', 'attack', 'harvest', 'full', 'repair'];

function voiceHead(v: UnitVoice | 'announcer'): HTMLElement {
  const info = VOICES[v];
  const head = el('div', 'vhead');
  const pics = el('div', 'pics');
  for (const u of info.units.slice(0, 4)) pics.append(picture({ unit: u }));
  if (!info.units.length) pics.append(picture({ unit: 'mcv' }));
  head.append(pics);
  const txt = el('div', 'vtxt');
  txt.append(el('h4', '', info.title));
  const who = el('p', 'voice');
  if (info.voiceId) {
    who.append(el('b', '', 'Voice: '), `${info.voice} `, el('span', 'id', `ElevenLabs · ${info.voiceId}`));
  } else who.append(el('b', '', info.voice));
  txt.append(who, el('p', 'style', info.style));
  if (info.units.length) {
    const used = el('p', 'used');
    used.append(el('b', '', 'Speaks for: '), info.units.map((u) => UNIT_NAME[u]).join(', '));
    txt.append(used);
  }
  if (info.note) txt.append(el('p', 'note', info.note));
  head.append(txt);
  return head;
}

// The game picks a random take, never the same one twice running.
const lastPick = new Map<string, number>();
function pickTake(key: string, n: number): number {
  let i = 1 + Math.floor(Math.random() * n);
  if (n > 1 && i === lastPick.get(key)) i = (i % n) + 1;
  lastPick.set(key, i);
  return i;
}

// New voices to try for this unit, each saying its first select line.
function voiceOptions(v: UnitVoice, vo: NonNullable<(typeof VOICE_OPTIONS)[UnitVoice]>): HTMLElement {
  const key = `voice:${v}`;
  const says = LINES[v].select?.[0] ?? '';
  const box = el('div', 'vopts');
  const lh = el('div', 'lhead');
  lh.append(el('h5', '', 'Try a new voice'), el('span', 'opts', `${vo.options.length} new voices${vo.why ? `. ${vo.why}` : ''}`));
  box.append(lh);
  const names = ['Current', ...vo.options.map((o) => o.voice.split(' – ')[0])];
  box.append(choiceGroup(key, names, [VOICES[v].voice, ...vo.options.map((o) => o.voice)]));
  const path = () => {
    const i = picks[key] ?? 0;
    return i ? `voice-options/${v}/${v}_select_${vo.options[i - 1].slug}.mp3` : `voice/${v}/${v}_select_1.mp3`;
  };
  const row = el('div', 'plays');
  row.append(playBtn(path, `“${says}”`, {}, 'main'));
  box.append(row);
  const who = el('p', 'voice');
  const paint = () => {
    const i = picks[key] ?? 0;
    const o = i ? vo.options[i - 1] : { voice: VOICES[v].voice, voiceId: VOICES[v].voiceId, style: VOICES[v].style };
    who.replaceChildren(el('b', '', i ? 'New voice: ' : 'Current voice: '), `${o.voice} `, el('span', 'id', `ElevenLabs · ${o.voiceId}`), el('br'), el('span', 'style', o.style));
    box.classList.toggle('changed', !!i);
  };
  pickListeners.push(paint);
  paint();
  box.append(who);
  box.append(el('p', 'note', 'Only this first line has been made in the new voices. The other lines below are still the current voice.'));
  return box;
}

function voiceCard(v: UnitVoice): HTMLElement {
  const card = el('section', 'vcard');
  card.id = `voice-${v}`;
  card.append(voiceHead(v));
  const vo = VOICE_OPTIONS[v];
  if (vo) card.append(voiceOptions(v, vo));
  const lines = el('div', 'lines');
  for (const line of LINE_ORDER) {
    const takes = LINES[v][line];
    const n = UNIT_CLIPS[v][line];
    if (!takes || !n) continue;
    const blk = el('div', 'line');
    const lh = el('div', 'lhead');
    lh.append(el('h5', '', LINE_TITLE[line]));
    lh.append(el('span', 'opts', n > 1 ? `${n} options, one picked at random` : 'one take'));
    if (n > 1) {
      const r = playBtn(() => `voice/${v}/${v}_${line}_${pickTake(`${v}_${line}`, n)}.mp3`, 'Random, as in the game', {}, 'rnd');
      lh.append(r);
    }
    blk.append(lh, el('p', 'when', LINE_WHEN[line]));
    const ol = el('ol', 'takes');
    takes.forEach((says, i) => {
      const li = el('li');
      const path = `voice/${v}/${v}_${line}_${i + 1}.mp3`;
      const b = playBtn(path, `“${says}”`, {}, 'take');
      if (says.startsWith('(')) b.querySelector('.lbl')!.textContent = says;
      li.append(el('span', 'num', `${i + 1}`), b, fileMeta(path));
      ol.append(li);
    });
    blk.append(ol);
    lines.append(blk);
  }
  card.append(lines);
  return card;
}

function announcerCard(): HTMLElement {
  const card = el('section', 'vcard');
  card.id = 'voice-announcer';
  card.append(voiceHead('announcer'));
  const ol = el('ol', 'takes ann');
  for (const a of ANNOUNCE) {
    const info = ANNOUNCEMENTS[a];
    const li = el('li');
    const path = `voice/announcer/announcer_${a}_1.mp3`;
    const txt = el('div', 'atxt');
    const when = el('p', 'when', info.when);
    const gap = ANNOUNCE_GAP[a] ?? 2;
    txt.append(when);
    const m = fileMeta(path);
    m.append(el('span', '', `at most once every ${gap} s`));
    txt.append(m);
    li.append(playBtn(path, `“${info.says}”`, { gain: 1.1 }, 'take'), txt);
    ol.append(li);
  }
  const lines = el('div', 'lines');
  const blk = el('div', 'line');
  const lh = el('div', 'lhead');
  lh.append(el('h5', '', 'Announcements'), el('span', 'opts', 'one take each; they queue up, up to three, instead of talking over each other'));
  blk.append(lh, ol);
  lines.append(blk);
  card.append(lines);
  return card;
}

function buildVoices(root: HTMLElement): void {
  const order: UnitVoice[] = ['soldier', 'engineer', 'commando', 'flamer', 'dog', 'tank', 'scout', 'harvester', 'copter', 'pilot', 'navy'];
  const intro = el('p', 'blurb');
  intro.textContent =
    'Units answer when you select them and when you give them an order; a new answer cuts off the one before. Each kind of line has a few takes and the game picks one at random, never the same one twice running. Made with ElevenLabs text to speech (Eleven v4).';
  root.append(intro);
  root.append(announcerCard());
  for (const v of order) root.append(voiceCard(v));
}

// ---------- music ----------

function buildMusic(root: HTMLElement): void {
  root.append(
    el(
      'p',
      'blurb',
      'One of three loops is always playing, picked by what is going on, and they crossfade over 2.5 seconds when it changes. Made with ElevenLabs Music and cut to loop seamlessly. Pausing the game fades the music out.',
    ),
  );
  const grid = el('div', 'grid music');
  for (const m of ['base', 'shroud', 'battle'] as MoodId[]) {
    const info = MUSIC[m];
    const card = el('section', 'card');
    card.id = `music-${m}`;
    const body = el('div', 'body');
    const head = el('div', 'head');
    head.append(el('h4', '', info.title), el('span', 'tag', 'Loop'));
    body.append(head, el('p', 'what', info.style));
    const when = el('p', 'when');
    when.append(el('b', '', 'Plays when: '), info.when);
    body.append(when);
    const plays = el('div', 'plays');
    plays.append(playBtn(`music/${m}.mp3`, 'Loop', { loop: true, gain: VOLUME[m] }, 'main'));
    body.append(plays);
    const meta = el('div', 'meta');
    meta.append(fileMeta(`music/${m}.mp3`), el('span', '', `in-game volume ${pct(VOLUME[m])}`));
    body.append(meta);
    card.append(body);
    grid.append(card);
  }
  root.append(grid);
}

buildSfx(document.querySelector('#sfxRows')!);
buildVoices(document.querySelector('#voiceRows')!);
buildMusic(document.querySelector('#musicRows')!);
document.querySelector('#stop')!.addEventListener('click', () => stopAll());

// ---------- copy the picks, to paste back into the chat ----------

function changesText(): { text: string; count: number } {
  const sfx: string[] = [];
  for (const n of Object.keys(SFX)) {
    const i = picks[`sfx:${n}`];
    if (i) sfx.push(`- ${n} (${SFX[n as Sfx | Loop].title}): ${SFX_APPLIED[n as Sfx | Loop] === i ? 'back to the old clip' : `new ${i}`} (public/sfx/options/${n}_${i}.mp3)`);
  }
  const voices: string[] = [];
  for (const [v, vo] of Object.entries(VOICE_OPTIONS) as [UnitVoice, NonNullable<(typeof VOICE_OPTIONS)[UnitVoice]>][]) {
    const i = picks[`voice:${v}`];
    if (!i) continue;
    const o = vo.options[i - 1];
    voices.push(`- ${VOICES[v].title} (${v}): ${o.voice}, voice id ${o.voiceId} (was ${VOICES[v].voice}). Sample: public/voice-options/${v}/${v}_select_${o.slug}.mp3`);
  }
  const count = sfx.length + voices.length;
  if (!count) return { text: 'RA audio picks: no changes, keep everything as it is.', count };
  const out = ['RA audio picks from the Audio page:'];
  if (sfx.length) out.push('', `Sound effects to replace (${sfx.length}):`, ...sfx);
  if (voices.length) out.push('', `Voices to switch to, then make all of their lines in the new voice (${voices.length}):`, ...voices);
  return { text: out.join('\n'), count };
}

async function copyText(t: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    const ta = el('textarea');
    ta.value = t;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

const copyBtn = document.querySelector<HTMLButtonElement>('#copy')!;
const clearBtn = document.querySelector<HTMLButtonElement>('#clear')!;
const paintCopy = () => {
  const { count } = changesText();
  copyBtn.textContent = count ? `⧉ Copy ${count} change${count === 1 ? '' : 's'}` : '⧉ Copy changes';
  clearBtn.hidden = !count;
};
pickListeners.push(paintCopy);
paintCopy();
copyBtn.addEventListener('click', async () => {
  const { text } = changesText();
  const ok = await copyText(text);
  copyBtn.textContent = ok ? '✓ Copied' : 'Copy failed';
  setTimeout(paintCopy, 1500);
});
clearBtn.addEventListener('click', () => {
  for (const k of Object.keys(picks)) delete picks[k];
  setPick('', 0);
});
document.querySelector<HTMLParagraphElement>('#status')!.hidden = true;
if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
