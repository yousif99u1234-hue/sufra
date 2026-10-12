'use strict';
/* يولّد أيقونات التطبيق (PNG) بدون مكتبات: غطاء طعام أبيض على لون سُفرة */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const OUT = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(OUT, { recursive: true });

const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const SS = 4; // تنعيم الحواف
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const [pr, pg, pb, pa] = pixel((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
        r += pr * pa; g += pg * pa; b += pb * pa; a += pa;
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = a ? Math.round(r / a) : 0; raw[o + 1] = a ? Math.round(g / a) : 0; raw[o + 2] = a ? Math.round(b / a) : 0; raw[o + 3] = Math.round(a / (SS * SS) * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const A = [0xf0, 0x6a, 0x1e], B = [0xb3, 0x34, 0x08]; // تدرّج برتقالي
function art(scale, rounded) {
  return (u, v) => {
    if (rounded) { // زوايا دائرية للأيقونة العادية
      const rr = 0.22, cx = Math.min(Math.max(u, rr), 1 - rr), cy = Math.min(Math.max(v, rr), 1 - rr);
      if ((u - cx) ** 2 + (v - cy) ** 2 > rr * rr) return [0, 0, 0, 0];
    }
    const t = (u + v) / 2;
    const bg = A.map((c, i) => Math.round(c + (B[i] - c) * t));
    const x = 0.5 + (u - 0.5) / scale, y = 0.5 + (v - 0.5) / scale; // تصغير الرسم داخل المنطقة الآمنة
    const white = [255, 255, 255, 1];
    if (y <= 0.62 && (x - 0.5) ** 2 + (y - 0.62) ** 2 <= 0.28 ** 2) return white;               // القبة
    if ((x - 0.5) ** 2 + (y - 0.315) ** 2 <= 0.045 ** 2) return white;                          // المقبض
    if (y >= 0.655 && y <= 0.715 && x >= 0.16 && x <= 0.84) {                                     // الصينية
      const ex = x < 0.19 ? 0.19 : x > 0.81 ? 0.81 : x;
      if ((x - ex) ** 2 + (y - 0.685) ** 2 <= 0.03 ** 2 || (x >= 0.19 && x <= 0.81)) return white;
    }
    if (y > 0.36 && y < 0.6 && (x - 0.5) ** 2 + (y - 0.62) ** 2 <= 0.215 ** 2 && (x - 0.5) ** 2 + (y - 0.62) ** 2 >= 0.18 ** 2 && x < 0.42 && y < 0.52) {
      return [255, 220, 196, 1];                                                                  // لمعة
    }
    return [...bg, 1];
  };
}

const files = [
  ['icon-192.png', 192, art(1, true)],
  ['icon-512.png', 512, art(1, true)],
  ['maskable-512.png', 512, art(0.78, false)],
  ['apple-touch-icon.png', 180, art(0.86, false)],
];
for (const [name, size, fn] of files) {
  fs.writeFileSync(path.join(OUT, name), png(size, fn));
  console.log('✓', name);
}
