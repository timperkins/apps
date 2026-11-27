import './style.css';
import { Game, Upgrade } from './game';
import { Input } from './input';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>('c');
const screens = ['title', 'pick', 'paused', 'over'] as const;
type Screen = (typeof screens)[number];
function show(s: Screen | null) {
  for (const id of screens) $(id).classList.toggle('show', id === s);
}

const input = new Input(canvas, $('stickL'), $('stickR'), $('tBolt'), $('tDash'), (code) => {
  if (code === 'KeyP' || code === 'Escape') pause();
  if (code === 'KeyM') toggleMute();
  if ((code === 'Enter' || code === 'Space') && game.state === 'title') play();
});
if (matchMedia('(pointer: coarse)').matches) {
  input.touch = true;
  document.body.classList.add('touch');
}

const game = new Game(canvas, input);
addEventListener('resize', () => game.resize());

const best = () => Number(localStorage.getItem('ld-best') || 0);
const showBest = () => {
  const b = best();
  $('bestText').textContent = b ? `Best score ${b.toLocaleString()}` : '';
};
showBest();

function play() {
  game.sfx.unlock();
  show(null);
  $('hud').hidden = false;
  game.start();
}

function pause() {
  if (game.state === 'play' || game.state === 'pause') {
    game.togglePause();
    show(game.state === 'pause' ? 'paused' : null);
  }
}

function toggleMute() {
  game.sfx.setMuted(!game.sfx.muted);
  $('muteBtn').textContent = game.sfx.muted ? '🔇' : '🔊';
}
$('muteBtn').textContent = game.sfx.muted ? '🔇' : '🔊';

$('playBtn').addEventListener('click', play);
$('againBtn').addEventListener('click', play);
$('resumeBtn').addEventListener('click', pause);
$('pauseBtn').addEventListener('click', pause);
$('muteBtn').addEventListener('click', toggleMute);
$('quitBtn').addEventListener('click', () => {
  game.state = 'title';
  $('hud').hidden = true;
  showBest();
  show('title');
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'play') pause();
});
// Any first touch unlocks audio on iOS.
addEventListener('touchstart', () => game.sfx.unlock(), { once: true });

game.onPick = (choices: Upgrade[]) => {
  const box = $('cards');
  box.innerHTML = '';
  for (const u of choices) {
    const b = document.createElement('button');
    b.className = 'card';
    const count = game.picked.filter((p) => p === u.id).length;
    b.innerHTML = `<span class="ico">${u.icon}</span><b>${u.name}</b><small>${u.desc}</small>${count ? `<span class="n">Have ${count}</span>` : ''}`;
    b.addEventListener('click', () => {
      show(null);
      game.choose(u);
    });
    box.appendChild(b);
  }
  show('pick');
};

let bannerTimer = 0;
game.onBanner = (text, sub) => {
  $('bannerText').textContent = text;
  $('bannerSub').textContent = sub ?? '';
  $('banner').classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => $('banner').classList.remove('show'), 1800);
};

game.onGameOver = () => {
  $('finalScore').textContent = game.score.toLocaleString();
  $('finalStats').textContent = `Wave ${game.wave} · ${game.kills} kills`;
  const b = best();
  $('finalBest').textContent = game.score >= b && game.score > 0 ? 'New best score!' : `Best ${b.toLocaleString()}`;
  $('hud').hidden = true;
  show('over');
};

// ---------- HUD ----------
const hpFill = $('hpFill'), hpText = $('hpText'), heatFill = $('heatFill'), heatBar = heatFill.parentElement!;
const heatText = $('heatText');
const boltRing = $('boltRing'), dashRing = $('dashRing');
const boltAb = $('boltAbility'), dashAb = $('dashAbility'), tBolt = $('tBolt'), tDash = $('tDash');
const hurt = $('hurt');
const C = 100.5;
let last = { hp: -1, heat: -1, score: -1, wave: -1, left: -1, bolt: -1, dash: -1 };

function hud() {
  const s = game.stats;
  const hp = Math.ceil(game.hp);
  if (hp !== last.hp) {
    hpFill.style.transform = `scaleX(${game.hp / s.maxHp})`;
    hpText.textContent = `${hp} / ${s.maxHp}`;
    last.hp = hp;
  }
  const heat = Math.round(game.heat);
  if (heat !== last.heat) {
    heatFill.style.transform = `scaleX(${game.heat / 100})`;
    heatBar.classList.toggle('hot', game.overheated);
    heatText.textContent = game.overheated ? 'OVERHEATED' : 'LASER';
    last.heat = heat;
  }
  if (game.score !== last.score) {
    $('scoreText').textContent = game.score.toLocaleString();
    last.score = game.score;
  }
  if (game.wave !== last.wave) {
    $('waveText').textContent = `Wave ${game.wave}`;
    last.wave = game.wave;
  }
  const left = game.remaining;
  if (left !== last.left) {
    $('leftText').textContent = left ? `${left} left` : '';
    last.left = left;
  }
  const bf = Math.max(0, Math.min(1, 1 - game.boltCd / s.boltCd));
  const bq = Math.round(bf * 50);
  if (bq !== last.bolt) {
    boltRing.style.strokeDashoffset = String(C * (1 - bf));
    const ready = bf >= 1;
    boltAb.classList.toggle('cool', !ready);
    boltAb.classList.toggle('ready', ready);
    tBolt.classList.toggle('cool', !ready);
    tBolt.classList.toggle('ready', ready);
    last.bolt = bq;
  }
  const df = Math.max(0, Math.min(1, 1 - game.dashCd / s.dashCd));
  const dq = Math.round(df * 30);
  if (dq !== last.dash) {
    dashRing.style.strokeDashoffset = String(C * (1 - df));
    dashAb.classList.toggle('cool', df < 1);
    tDash.classList.toggle('cool', df < 1);
    last.dash = dq;
  }
  hurt.style.opacity = String(Math.max(game.hurtFlash, game.hp / s.maxHp < 0.25 ? 0.35 + Math.sin(performance.now() / 180) * 0.15 : 0));
}

let prev = performance.now();
function loop(now: number) {
  const dt = (now - prev) / 1000;
  prev = now;
  game.frame(dt);
  if (game.state === 'play') hud();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Debug hook for automated checks.
(window as unknown as { __game: Game }).__game = game;
