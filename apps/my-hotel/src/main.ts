import './style.css';
import { Controls } from './input';
import { Renderer } from './render/renderer';
import { loadHotel, saveHotel } from './save/save';
import { tick, type Hotel, type MapId } from './sim/hotel';
import { Hud } from './ui/hud';
import { showStart } from './ui/start';

const STEP = 1 / 60;

function play(map: MapId) {
  const hotel: Hotel = loadHotel(map);
  const canvas = document.createElement('canvas');
  canvas.className = 'game';
  document.body.appendChild(canvas);
  const renderer = new Renderer(canvas, hotel);
  const controls = new Controls(canvas);
  let running = true;

  const save = () => saveHotel(hotel);
  const quit = () => {
    running = false;
    save();
    clearInterval(saver);
    removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', save);
    removeEventListener('pagehide', save);
    controls.dispose();
    hud.dispose();
    renderer.dispose();
    canvas.remove();
    showStart(play);
  };
  const hud = new Hud(hotel, quit);

  const resize = () => renderer.resize(innerWidth, innerHeight);
  resize();
  addEventListener('resize', resize);
  const saver = setInterval(save, 3000);
  document.addEventListener('visibilitychange', save);
  addEventListener('pagehide', save);

  const popAt = (text: string) => {
    const p = renderer.project(hotel.player.pos.x, 2.6, hotel.player.pos.z);
    const el = document.createElement('div');
    el.className = 'pop';
    el.textContent = text;
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  };

  let last = performance.now();
  let acc = 0;
  const frame = (now: number) => {
    if (!running) return;
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    acc += dt;
    const input = controls.read();
    while (acc >= STEP) {
      hud.events(tick(hotel, STEP, input), popAt);
      acc -= STEP;
    }
    hud.update(hotel, controls.used);
    renderer.render(hotel, dt);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // for checking the game from a script
  (window as unknown as { __hotel: Hotel }).__hotel = hotel;
}

showStart(play);
