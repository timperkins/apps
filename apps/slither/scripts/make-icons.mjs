// Writes the PWA icons (a green snake on the dark arena) as PNGs without any image dependency.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// A curled snake as circles on a 32x32 grid, inside the maskable safe zone.
const BG = [11, 15, 26];
const BODY = [61, 220, 132];
const EYE = [255, 255, 255];
const CIRCLES = [];
for (let i = 0; i <= 24; i++) {
  const t = i / 24;
  CIRCLES.push([8 + t * 16, 16 + Math.sin(t * Math.PI * 2) * 5, 2.6 + t * 0.6, BODY]);
}
CIRCLES.push([24.6, 15.2, 0.9, EYE]);

function colorAt(gx, gy) {
  let c = BG;
  for (const [cx, cy, r, color] of CIRCLES) if ((gx - cx) ** 2 + (gy - cy) ** 2 <= r * r) c = color;
  return c;
}

function png(size) {
  const scale = size / 32;
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = colorAt((x + 0.5) / scale, (y + 0.5) / scale);
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  writeFileSync(new URL(`../public/${name}`, import.meta.url), png(size));
}
console.log('icons written');
