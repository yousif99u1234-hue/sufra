'use strict';
/* سُفرة طلب — خادم قناة الطلب المباشر للمطاعم والكافيهات
   بدون مكتبات خارجية: Node.js + SQLite المدمجة + Server-Sent Events */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = +process.env.PORT || 3000;
const PUB = path.join(__dirname, 'public');
const DATA = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOADS = path.join(DATA, 'uploads');
fs.mkdirSync(UPLOADS, { recursive: true });

/* ---------- قاعدة البيانات ---------- */
const db = new DatabaseSync(process.env.SUFRA_DB || path.join(DATA, 'sufra.db'));
db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS restaurants (
  id INTEGER PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, phone TEXT UNIQUE NOT NULL,
  owner_name TEXT NOT NULL DEFAULT '', pass TEXT NOT NULL, settings TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY, restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL, sort INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY, restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL, emoji TEXT NOT NULL DEFAULT '', image TEXT NOT NULL DEFAULT '', available INTEGER NOT NULL DEFAULT 1,
  popular INTEGER NOT NULL DEFAULT 0, options TEXT NOT NULL DEFAULT '[]', sort INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY, restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  phone TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', area TEXT NOT NULL DEFAULT '', points INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL, UNIQUE (restaurant_id, phone));
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY, restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_id INTEGER REFERENCES customers(id), number INTEGER NOT NULL, token TEXT NOT NULL, type TEXT NOT NULL,
  table_no TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '{}', lines TEXT NOT NULL,
  subtotal INTEGER NOT NULL, delivery_fee INTEGER NOT NULL DEFAULT 0, discount INTEGER NOT NULL DEFAULT 0,
  points_used INTEGER NOT NULL DEFAULT 0, points_earned INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL,
  coupon TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', status TEXT NOT NULL, eta INTEGER NOT NULL DEFAULT 0,
  reject_reason TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, accepted_at INTEGER, ready_at INTEGER, done_at INTEGER);
CREATE INDEX IF NOT EXISTS orders_rest_time ON orders (restaurant_id, created_at);
CREATE INDEX IF NOT EXISTS orders_customer ON orders (customer_id);
CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY, restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  code TEXT NOT NULL COLLATE NOCASE, kind TEXT NOT NULL, value INTEGER NOT NULL, min_order INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER NOT NULL DEFAULT 0, used INTEGER NOT NULL DEFAULT 0, expires_at INTEGER, active INTEGER NOT NULL DEFAULT 1,
  UNIQUE (restaurant_id, code));
`);

try { db.exec('ALTER TABLE customers ADD COLUMN blocked INTEGER NOT NULL DEFAULT 0'); } catch { /* العمود موجود */ }

const stmts = new Map();
const stmt = sql => { let s = stmts.get(sql); if (!s) { s = db.prepare(sql); stmts.set(sql, s); } return s; };
const all = (sql, ...p) => stmt(sql).all(...p);
const get = (sql, ...p) => stmt(sql).get(...p);
const run = (sql, ...p) => stmt(sql).run(...p);
function tx(fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
}

/* ---------- أدوات ---------- */
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (status, msg) => { throw new HttpError(status, msg); };
const DAY = 864e5, TZ = 3 * 36e5; // توقيت بغداد UTC+3
const dayStart = t => Math.floor((t + TZ) / DAY) * DAY - TZ;
const localMinutes = t => { const d = new Date(t + TZ); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
const fmt = n => Math.round(n).toLocaleString('en-US');
const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const int = (v, min = 0, max = 1e9) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min; };
const json = (s, fb) => { try { return JSON.parse(s); } catch { return fb; } };
const token = (n = 24) => crypto.randomBytes(n).toString('hex');

function normPhone(v) {
  let p = String(v ?? '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[^\d+]/g, '');
  if (p.startsWith('+964')) p = '0' + p.slice(4);
  else if (p.startsWith('00964')) p = '0' + p.slice(5);
  else if (p.startsWith('964')) p = '0' + p.slice(3);
  else if (p.startsWith('7') && p.length === 10) p = '0' + p;
  return p;
}
const validPhone = p => /^07\d{9}$/.test(p);

function hashPass(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex');
}
function checkPass(pw, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const a = crypto.scryptSync(pw, salt, 32), b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const DEFAULT_SETTINGS = {
  tagline: '', color: '#d9480f', logo: '', cover: '', whatsapp: '', address: '',
  paused: false, hours: { open: '10:00', close: '23:59' },
  delivery: { enabled: true, minOrder: 10000, eta: 40, areas: [] },
  pickup: { enabled: true, eta: 20 },
  dineIn: { enabled: true },
  loyalty: { enabled: true, per: 1000, rewardPoints: 100, rewardValue: 5000 },
  commissionPct: 20, currency: 'د.ع',
};
function merge(base, over) {
  if (Array.isArray(base)) return Array.isArray(over) ? over : base;
  if (base && typeof base === 'object') {
    const out = { ...base };
    for (const k of Object.keys(base)) if (over && over[k] !== undefined) out[k] = merge(base[k], over[k]);
    return out;
  }
  return over === undefined ? base : over;
}
const settingsOf = r => merge(DEFAULT_SETTINGS, json(r.settings, {}));

function isOpen(s, t = Date.now()) {
  if (s.paused) return false;
  const toM = h => { const [a, b] = String(h || '0:0').split(':').map(Number); return (a || 0) * 60 + (b || 0); };
  const o = toM(s.hours.open);
  let c = toM(s.hours.close);
  if (c === 0) c = 1440;
  if (o === c) return true;
  const m = localMinutes(t);
  return o < c ? m >= o && m < c : m >= o || m < c;
}

const itemOut = i => ({
  id: i.id, category_id: i.category_id, name: i.name, description: i.description, price: i.price, emoji: i.emoji,
  image: i.image, available: !!i.available, popular: !!i.popular, options: json(i.options, []), sort: i.sort,
});
function orderOut(o, admin = false) {
  const out = {
    id: o.id, number: o.number, status: o.status, type: o.type, table: o.table_no, address: json(o.address, {}),
    lines: json(o.lines, []), subtotal: o.subtotal, delivery_fee: o.delivery_fee, discount: o.discount,
    points_used: o.points_used, points_earned: o.points_earned, total: o.total, coupon: o.coupon, note: o.note,
    eta: o.eta, reject_reason: o.reject_reason, created_at: o.created_at, accepted_at: o.accepted_at,
    ready_at: o.ready_at, done_at: o.done_at,
  };
  if (admin) out.customer = { id: o.customer_id, name: o.cname || '', phone: o.cphone || '', previous: o.cprev || 0 };
  return out;
}
const ADMIN_ORDER_SQL = `SELECT o.*, c.name cname, c.phone cphone,
  (SELECT COUNT(*) FROM orders x WHERE x.customer_id = o.customer_id AND x.status = 'completed' AND x.id <> o.id) cprev
  FROM orders o LEFT JOIN customers c ON c.id = o.customer_id`;
const adminOrder = id => orderOut(get(`${ADMIN_ORDER_SQL} WHERE o.id = ?`, id), true);

/* ---------- البث الفوري (SSE) ---------- */
const channels = new Map();
function subscribe(req, res, key) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write('retry: 3000\n\n');
  if (!channels.has(key)) channels.set(key, new Set());
  channels.get(key).add(res);
  req.on('close', () => { const s = channels.get(key); if (s) { s.delete(res); if (!s.size) channels.delete(key); } });
}
function emit(key, event, data) {
  const s = channels.get(key); if (!s) return;
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of s) res.write(msg);
}
setInterval(() => { for (const s of channels.values()) for (const res of s) res.write(': ping\n\n'); }, 25000).unref();
function notifyOrder(o) {
  emit(`admin:${o.restaurant_id}`, 'order', adminOrder(o.id));
  emit(`order:${o.id}`, 'status', orderOut(o));
}

/* ---------- حماية بسيطة من الإغراق ---------- */
const hits = new Map();
function limit(ip, key, max, windowMs) {
  const k = key + ':' + ip, now = Date.now();
  const arr = (hits.get(k) || []).filter(t => now - t < windowMs);
  if (arr.length >= max) fail(429, 'محاولات كثيرة، حاول بعد قليل');
  arr.push(now); hits.set(k, arr);
}
setInterval(() => { const now = Date.now(); for (const [k, a] of hits) if (!a.some(t => now - t < 36e5)) hits.delete(k); }, 6e5).unref();

/* ---------- المصادقة ---------- */
function cookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map(c => c.trim().split('=')).filter(p => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
}
function authRestaurant(req) {
  const t = cookies(req).sid;
  if (!t) return null;
  const s = get('SELECT * FROM sessions WHERE token = ?', t);
  if (!s || s.expires_at < Date.now()) return null;
  return get('SELECT * FROM restaurants WHERE id = ?', s.restaurant_id);
}
function startSession(req, res, rid) {
  const t = token();
  run('INSERT INTO sessions (token, restaurant_id, expires_at) VALUES (?, ?, ?)', t, rid, Date.now() + 30 * DAY);
  const secure = req.headers['x-forwarded-proto'] === 'https' || process.env.SECURE_COOKIES === '1' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `sid=${t}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${30 * 86400}${secure}`);
}
const RESERVED = new Set(['admin', 'api', 'r', 'uploads', 'store', 'www', 'app']);

/* ---------- منطق الطلبات ---------- */
function couponCheck(rid, code, subtotal) {
  const c = get('SELECT * FROM coupons WHERE restaurant_id = ? AND code = ?', rid, str(code, 30));
  if (!c || !c.active) fail(400, 'الكوبون غير صالح');
  if (c.expires_at && c.expires_at < Date.now()) fail(400, 'انتهت صلاحية الكوبون');
  if (c.max_uses && c.used >= c.max_uses) fail(400, 'انتهى عدد استخدامات هذا الكوبون');
  if (subtotal < c.min_order) fail(400, `الكوبون يحتاج طلب بقيمة ${fmt(c.min_order)} أو أكثر`);
  const d = c.kind === 'pct' ? Math.round(subtotal * c.value / 100 / 250) * 250 : c.value;
  return { coupon: c, discount: Math.min(d, subtotal), label: c.kind === 'pct' ? `خصم ${c.value}%` : `خصم ${fmt(c.value)}` };
}

function buildLines(rid, items) {
  if (!Array.isArray(items) || !items.length) fail(400, 'السلة فارغة');
  if (items.length > 40) fail(400, 'عدد الأصناف كبير جداً');
  let subtotal = 0;
  const lines = items.map(x => {
    const it = get('SELECT * FROM items WHERE id = ? AND restaurant_id = ?', int(x.itemId), rid);
    if (!it) fail(400, 'أحد الأصناف لم يعد موجوداً، حدّث الصفحة');
    if (!it.available) fail(409, `"${it.name}" نفد حالياً`);
    const qty = int(x.qty, 1, 50);
    const chosen = new Set(Array.isArray(x.choices) ? x.choices.map(String) : []);
    const names = [];
    let unit = it.price;
    for (const g of json(it.options, [])) {
      const picked = g.choices.filter(c => chosen.has(String(c.id)));
      if (g.required && !picked.length) fail(400, `اختر "${g.name}" لـ ${it.name}`);
      if (!g.multi && picked.length > 1) fail(400, `اختر خياراً واحداً لـ "${g.name}"`);
      for (const c of picked) { unit += int(c.price, 0); names.push(c.name); }
    }
    subtotal += unit * qty;
    return { itemId: it.id, name: it.name, qty, unit, choices: names, note: str(x.note, 120) };
  });
  return { lines, subtotal };
}

function createOrder(r, b) {
  const s = settingsOf(r);
  if (!isOpen(s)) fail(409, 'المطعم لا يستقبل طلبات حالياً');
  const type = ['delivery', 'pickup', 'dine'].includes(b.type) ? b.type : fail(400, 'نوع الطلب غير صحيح');
  if (type === 'delivery' && !s.delivery.enabled) fail(400, 'التوصيل غير متاح حالياً');
  if (type === 'pickup' && !s.pickup.enabled) fail(400, 'الاستلام غير متاح حالياً');
  if (type === 'dine' && !s.dineIn.enabled) fail(400, 'الطلب من الطاولة غير متاح');
  const name = str(b.name, 60);
  if (name.length < 2) fail(400, 'اكتب اسمك');
  const phone = normPhone(b.phone);
  if (!validPhone(phone)) fail(400, 'رقم الهاتف غير صحيح — مثال: 07701234567');
  const { lines, subtotal } = buildLines(r.id, b.items);

  let fee = 0, address = {};
  if (type === 'delivery') {
    const area = s.delivery.areas.find(a => a.name === b.area);
    if (!area) fail(400, 'اختر منطقة التوصيل');
    if (subtotal < s.delivery.minOrder) fail(400, `الحد الأدنى للتوصيل ${fmt(s.delivery.minOrder)} ${s.currency}`);
    const details = str(b.address, 300);
    if (details.length < 4) fail(400, 'اكتب تفاصيل العنوان');
    fee = int(area.fee, 0);
    address = { area: area.name, details };
    const lat = Number(b.lat), lng = Number(b.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) Object.assign(address, { lat, lng });
  }
  const tableNo = type === 'dine' ? str(b.table, 10) : '';
  if (type === 'dine' && !tableNo) fail(400, 'رقم الطاولة مفقود — امسح رمز QR الموجود على الطاولة');

  return tx(() => {
    let c = get('SELECT * FROM customers WHERE restaurant_id = ? AND phone = ?', r.id, phone);
    if (!c) {
      const id = run('INSERT INTO customers (restaurant_id, phone, name, area, created_at) VALUES (?, ?, ?, ?, ?)', r.id, phone, name, address.area || '', Date.now()).lastInsertRowid;
      c = get('SELECT * FROM customers WHERE id = ?', id);
    } else run('UPDATE customers SET name = ?, area = CASE WHEN ? <> \'\' THEN ? ELSE area END WHERE id = ?', name, address.area || '', address.area || '', c.id);
    if (c.blocked) fail(403, 'تعذّر استلام الطلب — تواصل مع المطعم مباشرة');

    let discount = 0, couponCode = '', pointsUsed = 0;
    if (str(b.coupon)) {
      const cc = couponCheck(r.id, b.coupon, subtotal);
      discount += cc.discount; couponCode = cc.coupon.code;
      run('UPDATE coupons SET used = used + 1 WHERE id = ?', cc.coupon.id);
    }
    if (b.redeem && s.loyalty.enabled && c.points >= s.loyalty.rewardPoints) {
      pointsUsed = s.loyalty.rewardPoints;
      discount += s.loyalty.rewardValue;
      run('UPDATE customers SET points = points - ? WHERE id = ?', pointsUsed, c.id);
    }
    discount = Math.min(discount, subtotal);
    const now = Date.now();
    const number = get('SELECT COUNT(*) n FROM orders WHERE restaurant_id = ? AND created_at >= ?', r.id, dayStart(now)).n + 1;
    const tk = token(16);
    const id = run(`INSERT INTO orders (restaurant_id, customer_id, number, token, type, table_no, address, lines, subtotal, delivery_fee,
      discount, points_used, total, coupon, note, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    r.id, c.id, number, tk, type, tableNo, JSON.stringify(address), JSON.stringify(lines), subtotal, fee,
    discount, pointsUsed, subtotal + fee - discount, couponCode, str(b.note, 300), now).lastInsertRowid;
    return get('SELECT * FROM orders WHERE id = ?', id);
  });
}

const NEXT = { pending: null, preparing: o => (o.type === 'delivery' ? 'on_way' : 'ready'), ready: () => 'completed', on_way: () => 'completed' };
function updateOrder(r, id, b) {
  const o = get('SELECT * FROM orders WHERE id = ? AND restaurant_id = ?', int(id), r.id);
  if (!o) fail(404, 'الطلب غير موجود');
  const s = settingsOf(r), now = Date.now();
  tx(() => {
    if (b.action === 'accept') {
      if (o.status !== 'pending') fail(409, 'تم التعامل مع هذا الطلب مسبقاً');
      run("UPDATE orders SET status = 'preparing', eta = ?, accepted_at = ? WHERE id = ?", int(b.eta, 5, 240), now, o.id);
    } else if (b.action === 'reject') {
      if (['completed', 'rejected'].includes(o.status)) fail(409, 'لا يمكن رفض هذا الطلب');
      run("UPDATE orders SET status = 'rejected', reject_reason = ?, done_at = ? WHERE id = ?", str(b.reason, 120) || 'تعذّر تنفيذ الطلب', now, o.id);
      if (o.points_used) run('UPDATE customers SET points = points + ? WHERE id = ?', o.points_used, o.customer_id);
      if (o.coupon) run('UPDATE coupons SET used = MAX(0, used - 1) WHERE restaurant_id = ? AND code = ?', r.id, o.coupon);
    } else if (b.action === 'next') {
      const nx = NEXT[o.status]?.(o);
      if (!nx) fail(409, 'لا توجد مرحلة تالية');
      if (nx === 'completed') {
        const earned = s.loyalty.enabled ? Math.floor((o.total - o.delivery_fee) / Math.max(1, s.loyalty.per)) : 0;
        run("UPDATE orders SET status = 'completed', done_at = ?, points_earned = ? WHERE id = ?", now, earned, o.id);
        if (earned) run('UPDATE customers SET points = points + ? WHERE id = ?', earned, o.customer_id);
      } else run('UPDATE orders SET status = ?, ready_at = ? WHERE id = ?', nx, now, o.id);
    } else if (b.action === 'eta') {
      run('UPDATE orders SET eta = ? WHERE id = ?', int(b.eta, 5, 240), o.id);
    } else fail(400, 'إجراء غير معروف');
  });
  const updated = get('SELECT * FROM orders WHERE id = ?', o.id);
  notifyOrder(updated);
  return adminOrder(o.id);
}

/* ---------- الإحصائيات ---------- */
function stats(r, days) {
  const s = settingsOf(r), now = Date.now(), from = dayStart(now) - (days - 1) * DAY;
  const os = all('SELECT * FROM orders WHERE restaurant_id = ? AND created_at >= ?', r.id, from);
  const done = os.filter(o => o.status === 'completed');
  const revenue = done.reduce((a, o) => a + o.total, 0);
  const series = [];
  for (let t = from; t <= now; t += DAY) {
    const d = done.filter(o => o.created_at >= t && o.created_at < t + DAY);
    series.push({ day: t, orders: d.length, revenue: d.reduce((a, o) => a + o.total, 0) });
  }
  const items = {}, hours = Array(24).fill(0), types = { delivery: 0, pickup: 0, dine: 0 };
  for (const o of done) {
    hours[new Date(o.created_at + TZ).getUTCHours()]++;
    types[o.type] = (types[o.type] || 0) + 1;
    for (const l of json(o.lines, [])) { const k = l.name; items[k] = items[k] || { name: k, qty: 0, revenue: 0 }; items[k].qty += l.qty; items[k].revenue += l.unit * l.qty; }
  }
  const custIds = [...new Set(done.map(o => o.customer_id))];
  const returning = custIds.filter(id => get("SELECT COUNT(*) n FROM orders WHERE customer_id = ? AND status = 'completed'", id).n >= 2).length;
  const newCustomers = get('SELECT COUNT(*) n FROM customers WHERE restaurant_id = ? AND created_at >= ?', r.id, from).n;
  const pointsRedeemed = done.reduce((a, o) => a + o.points_used, 0);
  return {
    days, orders: done.length, revenue, avg: done.length ? revenue / done.length : 0,
    saved: Math.round(revenue * s.commissionPct / 100), commissionPct: s.commissionPct,
    rejected: os.filter(o => o.status === 'rejected').length, total: os.length,
    customers: custIds.length, returning, returningPct: custIds.length ? returning / custIds.length * 100 : 0, newCustomers,
    rewards: Math.round(pointsRedeemed / Math.max(1, s.loyalty.rewardPoints)), series, hours, types,
    topItems: Object.values(items).sort((a, b) => b.revenue - a.revenue).slice(0, 8),
  };
}

/* ---------- المسارات ---------- */
const routes = [];
function route(method, pattern, handler, opts = {}) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, handler, opts });
}
const storeBySlug = slug => get('SELECT * FROM restaurants WHERE slug = ?', String(slug).toLowerCase()) || fail(404, 'المتجر غير موجود');

// --- واجهة الزبون ---
route('GET', '/api/store/:slug', ({ params }) => {
  const r = storeBySlug(params.slug), s = settingsOf(r);
  return {
    restaurant: {
      slug: r.slug, name: r.name, phone: r.phone, tagline: s.tagline, color: s.color, logo: s.logo, cover: s.cover,
      whatsapp: s.whatsapp, address: s.address, open: isOpen(s), paused: s.paused, hours: s.hours,
      delivery: s.delivery, pickup: s.pickup, dineIn: s.dineIn, loyalty: s.loyalty, currency: s.currency,
    },
    categories: all('SELECT id, name FROM categories WHERE restaurant_id = ? ORDER BY sort, id', r.id),
    items: all('SELECT * FROM items WHERE restaurant_id = ? ORDER BY sort, id', r.id).map(itemOut),
  };
});
route('GET', '/api/store/:slug/points', ({ params, query, ip }) => {
  limit(ip, 'points', 30, 6e5);
  const r = storeBySlug(params.slug), phone = normPhone(query.get('phone'));
  if (!validPhone(phone)) return { points: 0, known: false };
  const c = get('SELECT points FROM customers WHERE restaurant_id = ? AND phone = ?', r.id, phone);
  return { points: c ? c.points : 0, known: !!c };
});
route('POST', '/api/store/:slug/coupon', ({ params, body, ip }) => {
  limit(ip, 'coupon', 20, 6e5);
  const r = storeBySlug(params.slug);
  const { coupon, discount, label } = couponCheck(r.id, body.code, int(body.subtotal));
  return { code: coupon.code, discount, label };
});
route('POST', '/api/store/:slug/orders', ({ params, body, ip }) => {
  limit(ip, 'order', 15, 6e5);
  const r = storeBySlug(params.slug);
  const o = createOrder(r, body);
  notifyOrder(o);
  return { id: o.id, token: o.token, number: o.number };
});
function publicOrder(id, tk) {
  const o = get('SELECT * FROM orders WHERE id = ?', int(id));
  if (!o || !tk || o.token.length !== String(tk).length || !crypto.timingSafeEqual(Buffer.from(o.token), Buffer.from(String(tk)))) fail(404, 'الطلب غير موجود');
  return o;
}
route('GET', '/api/orders/:id', ({ params, query }) => {
  const o = publicOrder(params.id, query.get('token'));
  const r = get('SELECT * FROM restaurants WHERE id = ?', o.restaurant_id), s = settingsOf(r);
  const c = get('SELECT points FROM customers WHERE id = ?', o.customer_id);
  return { order: orderOut(o), restaurant: { name: r.name, slug: r.slug, phone: r.phone, whatsapp: s.whatsapp, color: s.color, currency: s.currency, loyalty: s.loyalty }, points: c?.points || 0 };
});
route('GET', '/api/orders/:id/stream', ({ req, res, params, query }) => {
  const o = publicOrder(params.id, query.get('token'));
  subscribe(req, res, `order:${o.id}`);
}, { stream: true });

// --- المصادقة ---
route('POST', '/api/auth/signup', ({ req, res, body, ip }) => {
  limit(ip, 'signup', 5, 36e5);
  const name = str(body.name, 60), slug = str(body.slug, 30).toLowerCase(), phone = normPhone(body.phone), pw = String(body.password || '');
  if (name.length < 2) fail(400, 'اكتب اسم المطعم');
  if (!/^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/.test(slug) || RESERVED.has(slug)) fail(400, 'رابط المتجر: أحرف إنجليزية صغيرة وأرقام وشرطة فقط (3–30 حرف)');
  if (!validPhone(phone)) fail(400, 'رقم الهاتف غير صحيح');
  if (pw.length < 8) fail(400, 'كلمة المرور 8 أحرف على الأقل');
  if (get('SELECT 1 FROM restaurants WHERE slug = ?', slug)) fail(409, 'رابط المتجر مستخدم، اختر غيره');
  if (get('SELECT 1 FROM restaurants WHERE phone = ?', phone)) fail(409, 'هذا الرقم مسجّل مسبقاً — سجّل الدخول');
  const id = tx(() => {
    const rid = run('INSERT INTO restaurants (slug, name, phone, owner_name, pass, settings, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      slug, name, phone, str(body.owner, 60), hashPass(pw), JSON.stringify({ whatsapp: phone, delivery: { areas: [{ name: 'المنطقة القريبة', fee: 2000 }] } }), Date.now()).lastInsertRowid;
    ['الأطباق الرئيسية', 'المشروبات'].forEach((c, i) => run('INSERT INTO categories (restaurant_id, name, sort) VALUES (?, ?, ?)', rid, c, i));
    return rid;
  });
  startSession(req, res, id);
  return { ok: true };
});
route('POST', '/api/auth/login', ({ req, res, body, ip }) => {
  limit(ip, 'login', 10, 6e5);
  const r = get('SELECT * FROM restaurants WHERE phone = ?', normPhone(body.phone));
  if (!r || !checkPass(String(body.password || ''), r.pass)) fail(401, 'رقم الهاتف أو كلمة المرور غير صحيحة');
  startSession(req, res, r.id);
  return { ok: true };
});
route('POST', '/api/auth/logout', ({ req, res }) => {
  const t = cookies(req).sid;
  if (t) run('DELETE FROM sessions WHERE token = ?', t);
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0');
  return { ok: true };
});

// --- لوحة المطعم ---
const meOut = r => ({ id: r.id, slug: r.slug, name: r.name, phone: r.phone, owner: r.owner_name, settings: settingsOf(r), open: isOpen(settingsOf(r)) });
route('GET', '/api/admin/me', ({ rest }) => meOut(rest), { auth: true });
route('PUT', '/api/admin/settings', ({ rest, body }) => {
  const cur = settingsOf(rest), b = body.settings || {};
  const color = /^#[0-9a-f]{6}$/i.test(b.color) ? b.color : cur.color;
  const time = v => (/^\d{1,2}:\d{2}$/.test(v) ? v : null);
  const next = {
    tagline: str(b.tagline ?? cur.tagline, 120), color, logo: str(b.logo ?? cur.logo, 200), cover: str(b.cover ?? cur.cover, 200),
    whatsapp: b.whatsapp !== undefined ? (normPhone(b.whatsapp) || '') : cur.whatsapp, address: str(b.address ?? cur.address, 200),
    paused: b.paused !== undefined ? !!b.paused : cur.paused,
    hours: { open: time(b.hours?.open) || cur.hours.open, close: time(b.hours?.close) || cur.hours.close },
    delivery: b.delivery ? {
      enabled: !!b.delivery.enabled, minOrder: int(b.delivery.minOrder, 0, 1e7), eta: int(b.delivery.eta, 5, 240),
      areas: (Array.isArray(b.delivery.areas) ? b.delivery.areas : []).map(a => ({ name: str(a.name, 40), fee: int(a.fee, 0, 1e6) })).filter(a => a.name).slice(0, 60),
    } : cur.delivery,
    pickup: b.pickup ? { enabled: !!b.pickup.enabled, eta: int(b.pickup.eta, 5, 240) } : cur.pickup,
    dineIn: b.dineIn ? { enabled: !!b.dineIn.enabled } : cur.dineIn,
    loyalty: b.loyalty ? {
      enabled: !!b.loyalty.enabled, per: int(b.loyalty.per, 100, 1e6), rewardPoints: int(b.loyalty.rewardPoints, 1, 1e5), rewardValue: int(b.loyalty.rewardValue, 0, 1e7),
    } : cur.loyalty,
    commissionPct: b.commissionPct !== undefined ? int(b.commissionPct, 0, 60) : cur.commissionPct,
    currency: str(b.currency ?? cur.currency, 10) || 'د.ع',
  };
  const name = str(body.name ?? rest.name, 60) || rest.name;
  run('UPDATE restaurants SET name = ?, owner_name = ?, settings = ? WHERE id = ?', name, str(body.owner ?? rest.owner_name, 60), JSON.stringify(next), rest.id);
  return meOut(get('SELECT * FROM restaurants WHERE id = ?', rest.id));
}, { auth: true });
route('POST', '/api/admin/password', ({ rest, body }) => {
  if (!checkPass(String(body.current || ''), rest.pass)) fail(400, 'كلمة المرور الحالية غير صحيحة');
  if (String(body.next || '').length < 8) fail(400, 'كلمة المرور الجديدة 8 أحرف على الأقل');
  run('UPDATE restaurants SET pass = ? WHERE id = ?', hashPass(String(body.next)), rest.id);
  return { ok: true };
}, { auth: true });

route('GET', '/api/admin/orders', ({ rest, query }) => {
  const scope = query.get('scope') || 'active';
  const rows = scope === 'active'
    ? all(`${ADMIN_ORDER_SQL} WHERE o.restaurant_id = ? AND (o.status IN ('pending','preparing','ready','on_way') OR o.created_at >= ?) ORDER BY o.created_at`, rest.id, dayStart(Date.now()))
    : all(`${ADMIN_ORDER_SQL} WHERE o.restaurant_id = ? ORDER BY o.created_at DESC LIMIT 200`, rest.id);
  return rows.map(o => orderOut(o, true));
}, { auth: true });
route('PATCH', '/api/admin/orders/:id', ({ rest, params, body }) => updateOrder(rest, params.id, body), { auth: true });
route('GET', '/api/admin/stream', ({ req, res, rest }) => subscribe(req, res, `admin:${rest.id}`), { auth: true, stream: true });

route('GET', '/api/admin/menu', ({ rest }) => ({
  categories: all('SELECT id, name, sort FROM categories WHERE restaurant_id = ? ORDER BY sort, id', rest.id),
  items: all('SELECT * FROM items WHERE restaurant_id = ? ORDER BY sort, id', rest.id).map(itemOut),
}), { auth: true });
route('POST', '/api/admin/categories', ({ rest, body }) => {
  const name = str(body.name, 40) || fail(400, 'اكتب اسم القسم');
  const sort = get('SELECT COALESCE(MAX(sort), -1) + 1 s FROM categories WHERE restaurant_id = ?', rest.id).s;
  return { id: run('INSERT INTO categories (restaurant_id, name, sort) VALUES (?, ?, ?)', rest.id, name, sort).lastInsertRowid };
}, { auth: true });
route('PUT', '/api/admin/categories/order', ({ rest, body }) => {
  tx(() => (Array.isArray(body.ids) ? body.ids : []).forEach((id, i) => run('UPDATE categories SET sort = ? WHERE id = ? AND restaurant_id = ?', i, int(id), rest.id)));
  return { ok: true };
}, { auth: true });
route('PUT', '/api/admin/categories/:id', ({ rest, params, body }) => {
  run('UPDATE categories SET name = ? WHERE id = ? AND restaurant_id = ?', str(body.name, 40) || fail(400, 'اكتب اسم القسم'), int(params.id), rest.id);
  return { ok: true };
}, { auth: true });
route('DELETE', '/api/admin/categories/:id', ({ rest, params }) => {
  if (get('SELECT 1 FROM items WHERE category_id = ? AND restaurant_id = ?', int(params.id), rest.id)) fail(409, 'انقل أو احذف أصناف هذا القسم أولاً');
  run('DELETE FROM categories WHERE id = ? AND restaurant_id = ?', int(params.id), rest.id);
  return { ok: true };
}, { auth: true });

function cleanOptions(opts) {
  return (Array.isArray(opts) ? opts : []).slice(0, 10).map((g, gi) => ({
    id: str(g.id, 20) || 'g' + gi + token(2), name: str(g.name, 40), required: !!g.required, multi: !!g.multi,
    choices: (Array.isArray(g.choices) ? g.choices : []).slice(0, 20).map((c, ci) => ({ id: str(c.id, 20) || 'c' + ci + token(2), name: str(c.name, 40), price: int(c.price, 0, 1e7) })).filter(c => c.name),
  })).filter(g => g.name && g.choices.length);
}
function itemFields(rest, b) {
  const name = str(b.name, 60);
  if (!name) fail(400, 'اكتب اسم الصنف');
  const price = int(b.price, 0, 1e8);
  const cat = b.category_id ? get('SELECT id FROM categories WHERE id = ? AND restaurant_id = ?', int(b.category_id), rest.id) : null;
  return [cat ? cat.id : null, name, str(b.description, 300), price, str(b.emoji, 8), str(b.image, 200), b.available === false ? 0 : 1, b.popular ? 1 : 0, JSON.stringify(cleanOptions(b.options))];
}
route('POST', '/api/admin/items', ({ rest, body }) => {
  const sort = get('SELECT COALESCE(MAX(sort), -1) + 1 s FROM items WHERE restaurant_id = ?', rest.id).s;
  const id = run('INSERT INTO items (category_id, name, description, price, emoji, image, available, popular, options, restaurant_id, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', ...itemFields(rest, body), rest.id, sort).lastInsertRowid;
  return itemOut(get('SELECT * FROM items WHERE id = ?', id));
}, { auth: true });
route('PUT', '/api/admin/items/:id', ({ rest, params, body }) => {
  const r = run('UPDATE items SET category_id = ?, name = ?, description = ?, price = ?, emoji = ?, image = ?, available = ?, popular = ?, options = ? WHERE id = ? AND restaurant_id = ?', ...itemFields(rest, body), int(params.id), rest.id);
  if (!r.changes) fail(404, 'الصنف غير موجود');
  return itemOut(get('SELECT * FROM items WHERE id = ?', int(params.id)));
}, { auth: true });
route('PATCH', '/api/admin/items/:id', ({ rest, params, body }) => {
  if (body.available !== undefined) run('UPDATE items SET available = ? WHERE id = ? AND restaurant_id = ?', body.available ? 1 : 0, int(params.id), rest.id);
  if (body.popular !== undefined) run('UPDATE items SET popular = ? WHERE id = ? AND restaurant_id = ?', body.popular ? 1 : 0, int(params.id), rest.id);
  return { ok: true };
}, { auth: true });
route('DELETE', '/api/admin/items/:id', ({ rest, params }) => {
  run('DELETE FROM items WHERE id = ? AND restaurant_id = ?', int(params.id), rest.id);
  return { ok: true };
}, { auth: true });
route('POST', '/api/admin/upload', ({ body }) => {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.data || ''));
  if (!m) fail(400, 'صيغة الصورة غير مدعومة');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 1.5 * 1024 * 1024) fail(413, 'حجم الصورة كبير');
  const name = token(12) + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]);
  fs.writeFileSync(path.join(UPLOADS, name), buf);
  return { url: '/uploads/' + name };
}, { auth: true, limit: 2.5e6 });

route('PATCH', '/api/admin/customers/:id', ({ rest, params, body }) => {
  run('UPDATE customers SET blocked = ? WHERE id = ? AND restaurant_id = ?', body.blocked ? 1 : 0, int(params.id), rest.id);
  return { ok: true };
}, { auth: true });
route('GET', '/api/admin/customers', ({ rest }) => all(`SELECT c.id, c.phone, c.name, c.area, c.points, c.blocked, c.created_at,
    COUNT(o.id) orders, COALESCE(SUM(o.total), 0) spent, MAX(o.created_at) last_at
  FROM customers c LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'completed'
  WHERE c.restaurant_id = ? GROUP BY c.id ORDER BY last_at DESC`, rest.id), { auth: true });

route('GET', '/api/admin/coupons', ({ rest }) => all('SELECT * FROM coupons WHERE restaurant_id = ? ORDER BY id DESC', rest.id), { auth: true });
function couponFields(b) {
  const code = str(b.code, 20).toUpperCase().replace(/\s+/g, '');
  if (!/^[A-Z0-9_-]{3,20}$/.test(code)) fail(400, 'الكود: أحرف إنجليزية وأرقام (3–20)');
  const kind = b.kind === 'fixed' ? 'fixed' : 'pct';
  const value = kind === 'pct' ? int(b.value, 1, 100) : int(b.value, 250, 1e7);
  const exp = b.expires_at ? int(b.expires_at) : null;
  return [code, kind, value, int(b.min_order, 0, 1e8), int(b.max_uses, 0, 1e6), exp || null, b.active === false ? 0 : 1];
}
route('POST', '/api/admin/coupons', ({ rest, body }) => {
  try { run('INSERT INTO coupons (code, kind, value, min_order, max_uses, expires_at, active, restaurant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ...couponFields(body), rest.id); }
  catch (e) { if (String(e.message).includes('UNIQUE')) fail(409, 'هذا الكود موجود مسبقاً'); throw e; }
  return { ok: true };
}, { auth: true });
route('PUT', '/api/admin/coupons/:id', ({ rest, params, body }) => {
  try { run('UPDATE coupons SET code = ?, kind = ?, value = ?, min_order = ?, max_uses = ?, expires_at = ?, active = ? WHERE id = ? AND restaurant_id = ?', ...couponFields(body), int(params.id), rest.id); }
  catch (e) { if (String(e.message).includes('UNIQUE')) fail(409, 'هذا الكود موجود مسبقاً'); throw e; }
  return { ok: true };
}, { auth: true });
route('DELETE', '/api/admin/coupons/:id', ({ rest, params }) => {
  run('DELETE FROM coupons WHERE id = ? AND restaurant_id = ?', int(params.id), rest.id);
  return { ok: true };
}, { auth: true });
route('GET', '/api/admin/stats', ({ rest, query }) => stats(rest, int(query.get('days') || 30, 1, 365)), { auth: true });

/* ---------- الملفات الثابتة ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
};
function safeJoin(base, rel) {
  const f = path.resolve(base, rel);
  return f === base || f.startsWith(base + path.sep) ? f : null;
}
function redirect(res, to) { res.writeHead(302, { Location: to, 'Cache-Control': 'no-cache' }); res.end(); }
function storeManifest(res, slug) {
  const r = get('SELECT * FROM restaurants WHERE slug = ?', String(slug || '').toLowerCase());
  if (!r) { res.writeHead(404); return res.end(); }
  const s = settingsOf(r);
  res.writeHead(200, { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'no-cache' });
  res.end(JSON.stringify(manifestFor(r.slug, r.name, s.tagline, s.color)));
}
function manifestFor(slug, name, tagline, color) {
  return {
    id: `./?r=${slug}`, name, short_name: name.replace(/^(مطعم|كافيه|قهوة)\s+/, '').slice(0, 14), description: tagline || `اطلب من ${name} مباشرة`,
    lang: 'ar', dir: 'rtl', start_url: `./?r=${slug}`, scope: './', display: 'standalone', orientation: 'portrait',
    background_color: '#f5f3ef', theme_color: color,
    icons: [
      { src: '../icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '../icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '../icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
function serveStatic(req, res, p, url) {
  if (p === '/admin') return redirect(res, '/admin/');
  const short = p.match(/^\/r\/([a-z0-9-]+)\/?$/i);
  if (short) {
    const t = url.searchParams.get('t');
    return redirect(res, `/store/?r=${short[1].toLowerCase()}${t ? '&t=' + encodeURIComponent(t) : ''}`);
  }
  if (p === '/store/manifest.webmanifest') return storeManifest(res, url.searchParams.get('r'));
  let file = p.startsWith('/uploads/') ? safeJoin(UPLOADS, p.slice(9)) : safeJoin(PUB, p.slice(1));
  let st = null;
  try { st = file && fs.statSync(file); } catch { st = null; }
  if (st && st.isDirectory() && !p.startsWith('/uploads/')) {
    if (!p.endsWith('/')) return redirect(res, p + '/' + url.search);
    file = path.join(file, 'index.html');
    try { st = fs.statSync(file); } catch { st = null; }
  }
  if (!st || !st.isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end('<!doctype html><meta charset="utf-8"><title>غير موجود</title><p style="font-family:sans-serif;text-align:center;margin-top:20vh">الصفحة غير موجودة — <a href="/">الرئيسية</a></p>');
  }
  const ext = path.extname(file).toLowerCase();
  const etag = `"${st.size.toString(36)}-${Math.round(st.mtimeMs).toString(36)}"`;
  const headers = {
    'Content-Type': MIME[ext] || 'application/octet-stream', ETag: etag,
    'Cache-Control': p.startsWith('/uploads/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  };
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); return res.end(); }
  res.writeHead(200, { ...headers, 'Content-Length': st.size });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}

/* ---------- الخادم ---------- */
function readJson(req, max = 1e5) {
  return new Promise((resolve, reject) => {
    if (!String(req.headers['content-type'] || '').includes('application/json')) return reject(new HttpError(415, 'نوع المحتوى يجب أن يكون JSON'));
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > max) { reject(new HttpError(413, 'الطلب كبير جداً')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { reject(new HttpError(400, 'بيانات غير صالحة')); } });
    req.on('error', reject);
  });
}
const clientIp = req => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://local');
    let p;
    try { p = decodeURIComponent(url.pathname); } catch { fail(400, 'رابط غير صالح'); }
    if (!p.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') fail(405, 'غير مسموح');
      return serveStatic(req, res, p, url);
    }
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = p.match(r.re);
      if (!m) continue;
      const ctx = { req, res, url, query: url.searchParams, ip: clientIp(req), params: Object.fromEntries(r.keys.map((k, i) => [k, m[i + 1]])) };
      if (r.opts.auth) { ctx.rest = authRestaurant(req); if (!ctx.rest) fail(401, 'انتهت الجلسة، سجّل الدخول'); }
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) ctx.body = await readJson(req, r.opts.limit);
      const out = await r.handler(ctx);
      if (!r.opts.stream && !res.headersSent) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(out ?? { ok: true }));
      }
      return;
    }
    fail(404, 'غير موجود');
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    if (!res.headersSent) {
      res.writeHead(e.status || 500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: e.status ? e.message : 'خطأ في الخادم، حاول مرة أخرى' }));
    }
  }
});

if (!get('SELECT 1 FROM restaurants LIMIT 1')) require('./seed').seed({ db, run, get, all, tx, hashPass, dayStart, DAY, TZ, token, settingsDefaults: DEFAULT_SETTINGS });
run('DELETE FROM sessions WHERE expires_at < ?', Date.now());

/* تصدير البيانات التجريبية لنسخة العرض الثابتة (GitHub Pages) */
function exportDemo(file) {
  const rest = all('SELECT * FROM restaurants').map(r => ({ id: r.id, slug: r.slug, name: r.name, phone: r.phone, owner_name: r.owner_name, settings: settingsOf(r), created_at: r.created_at, demo: true }));
  const data = {
    exportedAt: Date.now(), restaurants: rest,
    categories: all('SELECT * FROM categories'),
    items: all('SELECT * FROM items').map(i => ({ ...i, options: json(i.options, []) })),
    customers: all('SELECT * FROM customers'),
    orders: all('SELECT * FROM orders').map(o => ({ ...o, address: json(o.address, {}), lines: json(o.lines, []) })),
    coupons: all('SELECT * FROM coupons'),
    manifests: Object.fromEntries(rest.map(r => [r.slug, manifestFor(r.slug, r.name, r.settings.tagline, r.settings.color)])),
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
  console.log(`تم تصدير ${data.orders.length} طلب إلى ${file}`);
}
module.exports = { manifestFor };
if (process.env.SUFRA_EXPORT) { exportDemo(process.env.SUFRA_EXPORT); process.exit(0); }

server.listen(PORT, () => console.log(`سُفرة طلب يعمل على http://localhost:${PORT}`));
