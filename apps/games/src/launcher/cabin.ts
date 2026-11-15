// The launcher's backdrop: a log cabin in the pines at dusk, drawn as inline SVG.

function pines(n: number, y: number, h: number, color: string, seed: number): string {
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = (i / n) * 1700 - 50 + rnd() * 40;
    const hh = h * (0.7 + rnd() * 0.6);
    const w = hh * 0.36;
    out += `<path d="M${x} ${y - hh}L${x + w} ${y}H${x - w}Z"/>`;
  }
  return `<g fill="${color}">${out}</g>`;
}

function stars(n: number): string {
  let s = 7;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = rnd() * 1600, y = rnd() * 380, r = 0.6 + rnd() * 1.4;
    out += `<circle class="star" style="animation-delay:${(rnd() * 4).toFixed(2)}s" cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}"/>`;
  }
  return `<g fill="#fff8e0">${out}</g>`;
}

function logs(x: number, y: number, w: number, rows: number, rowH: number): string {
  let out = '';
  for (let i = 0; i < rows; i++) {
    const yy = y + i * rowH;
    out += `<rect x="${x}" y="${yy}" width="${w}" height="${rowH - 2}" rx="${rowH / 2}" fill="${i % 2 ? '#7a4a2b' : '#86532f'}"/>`;
    out += `<circle cx="${x + 4}" cy="${yy + rowH / 2 - 1}" r="${rowH / 2 - 1}" fill="#c08a55"/><circle cx="${x + 4}" cy="${yy + rowH / 2 - 1}" r="${rowH / 5}" fill="#9a6a3c"/>`;
    out += `<circle cx="${x + w - 4}" cy="${yy + rowH / 2 - 1}" r="${rowH / 2 - 1}" fill="#c08a55"/><circle cx="${x + w - 4}" cy="${yy + rowH / 2 - 1}" r="${rowH / 5}" fill="#9a6a3c"/>`;
  }
  return out;
}

function fireflies(n: number): string {
  let s = 3;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  let out = '';
  for (let i = 0; i < n; i++) {
    out += `<circle class="fly" style="animation-delay:${(rnd() * 6).toFixed(2)}s;animation-duration:${(5 + rnd() * 5).toFixed(1)}s" cx="${(rnd() * 1600).toFixed(0)}" cy="${(700 + rnd() * 180).toFixed(0)}" r="2.2"/>`;
  }
  return `<g fill="#ffe98a">${out}</g>`;
}

export const CABIN_SVG = `
<svg class="cabin" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1b1f44"/>
      <stop offset=".45" stop-color="#4b3a6b"/>
      <stop offset=".75" stop-color="#c46a5a"/>
      <stop offset="1" stop-color="#f0a860"/>
    </linearGradient>
    <radialGradient id="glow" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#ffd27a" stop-opacity=".75"/>
      <stop offset="1" stop-color="#ffb04a" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="win" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffe3a0"/>
      <stop offset="1" stop-color="#ff9d3c"/>
    </linearGradient>
    <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2d3b2c"/>
      <stop offset="1" stop-color="#182219"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#sky)"/>
  ${stars(90)}
  <circle cx="1280" cy="170" r="46" fill="#fff3d1" opacity=".95"/>
  <circle cx="1298" cy="158" r="44" fill="#4b3a6b" opacity=".9"/>
  <path d="M0 560L180 400L320 500L470 360L650 520L820 380L980 520L1150 330L1330 500L1480 410L1600 480V900H0Z" fill="#3a3258"/>
  <path d="M0 600L220 480L380 560L560 450L760 580L940 470L1120 590L1300 470L1600 560V900H0Z" fill="#2c2a46"/>
  ${pines(38, 680, 150, '#1f2a33', 11)}
  ${pines(30, 740, 190, '#17211f', 23)}
  <rect y="720" width="1600" height="180" fill="url(#ground)"/>

  <!-- cabin -->
  <g transform="translate(560 430)">
    <ellipse cx="240" cy="300" rx="380" ry="40" fill="#0e140f" opacity=".6"/>
    <!-- chimney + smoke -->
    <rect x="350" y="20" width="46" height="120" fill="#6b5d52"/>
    <rect x="344" y="14" width="58" height="14" fill="#574b42"/>
    <g class="smoke" fill="#d9d4e6">
      <circle cx="373" cy="0" r="16"/><circle cx="373" cy="0" r="14"/><circle cx="373" cy="0" r="18"/><circle cx="373" cy="0" r="12"/>
    </g>
    <!-- walls -->
    <g>${logs(20, 130, 440, 8, 22)}</g>
    <!-- roof -->
    <path d="M-20 140L240 10L500 140Z" fill="#3d2a22"/>
    <path d="M-30 146L240 0L510 146L490 156L240 22L-10 156Z" fill="#5a3a2a"/>
    <path d="M40 140L240 40L440 140Z" fill="#6f4a33"/>
    <g>${logs(80, 96, 320, 2, 22)}</g>
    <!-- gable window -->
    <circle cx="240" cy="96" r="22" fill="url(#win)"/>
    <path d="M240 74V118M218 96H262" stroke="#4a2e1d" stroke-width="5"/>
    <!-- door -->
    <rect x="200" y="196" width="80" height="110" rx="8" fill="#4a2e1d"/>
    <rect x="208" y="204" width="64" height="102" rx="6" fill="#6b4126"/>
    <circle cx="260" cy="256" r="5" fill="#e8c37a"/>
    <!-- windows -->
    <g class="windows">
      <rect x="64" y="186" width="96" height="76" rx="6" fill="url(#win)"/>
      <rect x="320" y="186" width="96" height="76" rx="6" fill="url(#win)"/>
    </g>
    <path d="M112 186V262M64 224H160M368 186V262M320 224H416" stroke="#4a2e1d" stroke-width="6"/>
    <rect x="58" y="180" width="108" height="88" rx="8" fill="none" stroke="#3a2416" stroke-width="7"/>
    <rect x="314" y="180" width="108" height="88" rx="8" fill="none" stroke="#3a2416" stroke-width="7"/>
    <!-- porch -->
    <rect x="-10" y="302" width="500" height="14" rx="4" fill="#5a3a2a"/>
    <rect x="0" y="150" width="12" height="155" fill="#5a3a2a"/>
    <rect x="468" y="150" width="12" height="155" fill="#5a3a2a"/>
    <!-- lantern -->
    <rect x="296" y="190" width="14" height="22" rx="3" fill="#ffd27a"/>
    <circle cx="303" cy="200" r="60" fill="url(#glow)" class="lantern"/>
    <!-- woodpile -->
    <g transform="translate(-130 250)">
      ${[0, 1, 2].map((r) => [0, 1, 2, 3 - r].slice(0, 4 - r).map((_, i) => `<circle cx="${20 + i * 26 + r * 13}" cy="${50 - r * 22}" r="12" fill="#c08a55" stroke="#7a4a2b" stroke-width="4"/>`).join('')).join('')}
    </g>
  </g>
  <ellipse cx="660" cy="660" rx="140" ry="70" fill="url(#glow)" opacity=".7"/>
  <ellipse cx="920" cy="660" rx="140" ry="70" fill="url(#glow)" opacity=".7"/>
  <g fill="#0f1714"><path d="M60 520L180 900H-60Z"/><path d="M230 600L320 900H140Z"/><path d="M1400 560L1510 900H1290Z"/><path d="M1560 480L1700 900H1420Z"/></g>
  ${fireflies(24)}
</svg>`;
