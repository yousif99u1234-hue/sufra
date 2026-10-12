/* سُفرة — خادم Cloudflare Workers + D1
   نفس منطق server.js لكن بشكل غير متزامن، مع:
   - تحديث لحظي بالاستطلاع (polling) بدل SSE ليناسب الخطة المجانية
   - الصور داخل قاعدة البيانات
   - إشعارات تيليگرام للطلبات الجديدة وتقرير أسبوعي */

const DAY = 864e5, TZ = 3 * 36e5; // توقيت بغداد UTC+3
const PBKDF2_ITER = 20000;

/* ---------- أدوات ---------- */
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (status, msg) => { throw new HttpError(status, msg); };
const dayStart = t => Math.floor((t + TZ) / DAY) * DAY - TZ;
const localMinutes = t => { const d = new Date(t + TZ); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
const fmt = n => Math.round(n).toLocaleString('en-US');
const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const int = (v, min = 0, max = 1e9) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min; };
const json = (s, fb) => { try { return JSON.parse(s); } catch { return fb; } };
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const unhex = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));
const token = (n = 24) => hex(crypto.getRandomValues(new Uint8Array(n)));
const escHtml = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
function normPhone(v) {
  let p = String(v ?? '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[^\d+]/g, '');
  if (p.startsWith('+964')) p = '0' + p.slice(4); else if (p.startsWith('00964')) p = '0' + p.slice(5);
  else if (p.startsWith('964')) p = '0' + p.slice(3); else if (p.startsWith('7') && p.length === 10) p = '0' + p;
  return p;
}
const validPhone = p => /^07\d{9}$/.test(p);

async function pbkdf2(pw, saltHex, iter) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unhex(saltHex), iterations: iter }, key, 256));
}
async function hashPass(pw) { const salt = token(16); return `pbkdf2$${PBKDF2_ITER}$${salt}$${await pbkdf2(pw, salt, PBKDF2_ITER)}`; }
async function checkPass(pw, stored) {
  const [kind, iter, salt, hash] = String(stored).split('$');
  if (kind !== 'pbkdf2' || !salt || !hash) return false;
  const got = await pbkdf2(pw, salt, +iter);
  let diff = got.length ^ hash.length;
  for (let i = 0; i < Math.min(got.length, hash.length); i++) diff |= got.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

const DEFAULT_SETTINGS = {
  tagline: '', color: '#d9480f', logo: '', cover: '', whatsapp: '', address: '', paused: false, hours: { open: '10:00', close: '23:59' },
  delivery: { enabled: true, minOrder: 10000, eta: 40, areas: [] }, pickup: { enabled: true, eta: 20 }, dineIn: { enabled: true },
  loyalty: { enabled: true, per: 1000, rewardPoints: 100, rewardValue: 5000 }, commissionPct: 20, currency: 'د.ع',
  telegram: { chats: [] },
};
function merge(base, over) {
  if (Array.isArray(base)) return Array.isArray(over) ? over : base;
  if (base && typeof base === 'object') { const out = { ...base }; for (const k of Object.keys(base)) if (over && over[k] !== undefined) out[k] = merge(base[k], over[k]); return out; }
  return over === undefined ? base : over;
}
const settingsOf = r => merge(DEFAULT_SETTINGS, json(r.settings, {}));
function isOpen(s, t = Date.now()) {
  if (s.paused) return false;
  const toM = h => { const [a, b] = String(h || '0:0').split(':').map(Number); return (a || 0) * 60 + (b || 0); };
  const o = toM(s.hours.open); let c = toM(s.hours.close); if (c === 0) c = 1440; if (o === c) return true;
  const m = localMinutes(t);
  return o < c ? m >= o && m < c : m >= o || m < c;
}
const itemOut = i => ({ id: i.id, category_id: i.category_id, name: i.name, description: i.description, price: i.price, emoji: i.emoji, image: i.image, available: !!i.available, popular: !!i.popular, options: json(i.options, []), sort: i.sort });
function orderOut(o, admin = false) {
  const out = {
    id: o.id, number: o.number, status: o.status, type: o.type, table: o.table_no, address: json(o.address, {}), lines: json(o.lines, []),
    subtotal: o.subtotal, delivery_fee: o.delivery_fee, discount: o.discount, points_used: o.points_used, points_earned: o.points_earned,
    total: o.total, coupon: o.coupon, note: o.note, eta: o.eta, reject_reason: o.reject_reason, created_at: o.created_at,
    accepted_at: o.accepted_at, ready_at: o.ready_at, done_at: o.done_at,
  };
  if (admin) out.customer = { id: o.customer_id, name: o.cname || '', phone: o.cphone || '', previous: o.cprev || 0, blocked: !!o.cblocked };
  return out;
}
const ADMIN_ORDER_SQL = `SELECT o.*, c.name cname, c.phone cphone, c.blocked cblocked,
  (SELECT COUNT(*) FROM orders x WHERE x.customer_id = o.customer_id AND x.status = 'completed' AND x.id <> o.id) cprev
  FROM orders o LEFT JOIN customers c ON c.id = o.customer_id`;

/* ---------- قاعدة البيانات ---------- */
const db = env => ({
  all: async (sql, ...p) => (await env.DB.prepare(sql).bind(...p).all()).results,
  get: (sql, ...p) => env.DB.prepare(sql).bind(...p).first(),
  run: (sql, ...p) => env.DB.prepare(sql).bind(...p).run(),
  st: (sql, ...p) => env.DB.prepare(sql).bind(...p),
  batch: list => env.DB.batch(list),
});

/* ---------- حماية بسيطة من الإغراق (لكل نسخة من الخادم) ---------- */
const hits = new Map();
function limit(ip, key, max, windowMs) {
  const k = key + ':' + ip, now = Date.now();
  const arr = (hits.get(k) || []).filter(t => now - t < windowMs);
  if (arr.length >= max) fail(429, 'محاولات كثيرة، حاول بعد قليل');
  arr.push(now); hits.set(k, arr);
  if (hits.size > 5000) hits.clear();
}

/* ---------- تيليگرام ---------- */
const tgReady = env => !!(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_BOT_USERNAME);
async function tgSecret(env) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('sufra-tg:' + env.TELEGRAM_BOT_TOKEN))).slice(0, 48); }
async function tg(env, method, body) {
  if (!env.TELEGRAM_BOT_TOKEN) return null;
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json().catch(() => null);
}
const TYPE_AR = { delivery: '🛵 توصيل', pickup: '🛍️ استلام', dine: '🍽️ طاولة' };
function orderMessage(r, o, s) {
  const a = json(o.address, {}), lines = json(o.lines, []);
  return [
    `🔔 <b>طلب جديد #${o.number}</b> — <b>${fmt(o.total)} ${escHtml(s.currency)}</b>`,
    `${TYPE_AR[o.type]}${o.type === 'dine' ? ' ' + escHtml(o.table_no) : ''}${a.area ? ` · ${escHtml(a.area)} — ${escHtml(a.details)}` : ''}`,
    `👤 ${escHtml(o.cname)} · ${escHtml(o.cphone)}${o.cprev ? ` · الطلب رقم ${o.cprev + 1}` : ' · زبون جديد ✨'}`,
    '',
    ...lines.map(l => `• ${l.qty}× ${escHtml(l.name)}${l.choices.length ? ` (${escHtml(l.choices.join('، '))})` : ''}${l.note ? ` — ${escHtml(l.note)}` : ''}`),
    o.note ? `\n📝 ${escHtml(o.note)}` : '',
    a.lat ? `📍 https://maps.google.com/?q=${a.lat},${a.lng}` : '',
  ].filter(x => x !== '').join('\n');
}
async function notifyTelegram(env, origin, r, orderId) {
  const s = settingsOf(r);
  if (!tgReady(env) || !s.telegram.chats.length) return;
  const o = await db(env).get(`${ADMIN_ORDER_SQL} WHERE o.id = ?`, orderId);
  const text = orderMessage(r, o, s);
  const markup = origin.startsWith('https://') ? { inline_keyboard: [[{ text: 'فتح لوحة الطلبات', url: `${origin}/admin/#orders` }]] } : undefined;
  await Promise.all(s.telegram.chats.map(c => tg(env, 'sendMessage', { chat_id: c.id, text, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: markup })));
}

/* ---------- منطق الطلبات ---------- */
async function couponCheck(D, rid, code, subtotal) {
  const c = await D.get('SELECT * FROM coupons WHERE restaurant_id = ? AND code = ?', rid, str(code, 30));
  if (!c || !c.active) fail(400, 'الكوبون غير صالح');
  if (c.expires_at && c.expires_at < Date.now()) fail(400, 'انتهت صلاحية الكوبون');
  if (c.max_uses && c.used >= c.max_uses) fail(400, 'انتهى عدد استخدامات هذا الكوبون');
  if (subtotal < c.min_order) fail(400, `الكوبون يحتاج طلب بقيمة ${fmt(c.min_order)} أو أكثر`);
  const d = c.kind === 'pct' ? Math.round(subtotal * c.value / 100 / 250) * 250 : c.value;
  return { coupon: c, discount: Math.min(d, subtotal), label: c.kind === 'pct' ? `خصم ${c.value}%` : `خصم ${fmt(c.value)}` };
}
async function buildLines(D, rid, items) {
  if (!Array.isArray(items) || !items.length) fail(400, 'السلة فارغة');
  if (items.length > 40) fail(400, 'عدد الأصناف كبير جداً');
  const ids = [...new Set(items.map(x => int(x.itemId)))];
  const rows = await D.all(`SELECT * FROM items WHERE restaurant_id = ? AND id IN (${ids.map(() => '?').join(',')})`, rid, ...ids);
  const byId = Object.fromEntries(rows.map(r => [r.id, r]));
  let subtotal = 0;
  const lines = items.map(x => {
    const it = byId[int(x.itemId)];
    if (!it) fail(400, 'أحد الأصناف لم يعد موجوداً، حدّث الصفحة');
    if (!it.available) fail(409, `"${it.name}" نفد حالياً`);
    const qty = int(x.qty, 1, 50), chosen = new Set(Array.isArray(x.choices) ? x.choices.map(String) : []), names = [];
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
async function createOrder(D, r, b) {
  const s = settingsOf(r);
  if (!isOpen(s)) fail(409, 'المطعم لا يستقبل طلبات حالياً');
  const type = ['delivery', 'pickup', 'dine'].includes(b.type) ? b.type : fail(400, 'نوع الطلب غير صحيح');
  if (type === 'delivery' && !s.delivery.enabled) fail(400, 'التوصيل غير متاح حالياً');
  if (type === 'pickup' && !s.pickup.enabled) fail(400, 'الاستلام غير متاح حالياً');
  if (type === 'dine' && !s.dineIn.enabled) fail(400, 'الطلب من الطاولة غير متاح');
  const name = str(b.name, 60); if (name.length < 2) fail(400, 'اكتب اسمك');
  const phone = normPhone(b.phone); if (!validPhone(phone)) fail(400, 'رقم الهاتف غير صحيح — مثال: 07701234567');
  const { lines, subtotal } = await buildLines(D, r.id, b.items);
  let fee = 0, address = {};
  if (type === 'delivery') {
    const area = s.delivery.areas.find(a => a.name === b.area); if (!area) fail(400, 'اختر منطقة التوصيل');
    if (subtotal < s.delivery.minOrder) fail(400, `الحد الأدنى للتوصيل ${fmt(s.delivery.minOrder)} ${s.currency}`);
    const details = str(b.address, 300); if (details.length < 4) fail(400, 'اكتب تفاصيل العنوان');
    fee = int(area.fee, 0); address = { area: area.name, details };
    const lat = Number(b.lat), lng = Number(b.lng);
    if (b.lat != null && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) Object.assign(address, { lat, lng });
  }
  const tableNo = type === 'dine' ? str(b.table, 10) : '';
  if (type === 'dine' && !tableNo) fail(400, 'رقم الطاولة مفقود — امسح رمز QR الموجود على الطاولة');

  const now = Date.now();
  const c = await D.get(`INSERT INTO customers (restaurant_id, phone, name, area, created_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (restaurant_id, phone) DO UPDATE SET name = excluded.name, area = CASE WHEN excluded.area <> '' THEN excluded.area ELSE customers.area END
    RETURNING *`, r.id, phone, name, address.area || '', now);
  if (c.blocked) fail(403, 'تعذّر استلام الطلب — تواصل مع المطعم مباشرة');
  const recent = await D.get("SELECT COUNT(*) n FROM orders WHERE customer_id = ? AND created_at > ? AND status = 'pending'", c.id, now - 10 * 60e3);
  if (recent.n >= 3) fail(429, 'عندك طلبات بانتظار التأكيد — انتظر رد المطعم');

  let discount = 0, couponCode = '', pointsUsed = 0, couponId = null;
  if (str(b.coupon)) { const cc = await couponCheck(D, r.id, b.coupon, subtotal); discount += cc.discount; couponCode = cc.coupon.code; couponId = cc.coupon.id; }
  if (b.redeem && s.loyalty.enabled && c.points >= s.loyalty.rewardPoints) { pointsUsed = s.loyalty.rewardPoints; discount += s.loyalty.rewardValue; }
  discount = Math.min(discount, subtotal);
  const number = (await D.get('SELECT COUNT(*) n FROM orders WHERE restaurant_id = ? AND created_at >= ?', r.id, dayStart(now))).n + 1;
  const stmts = [D.st(`INSERT INTO orders (restaurant_id, customer_id, number, token, type, table_no, address, lines, subtotal, delivery_fee,
    discount, points_used, total, coupon, note, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?) RETURNING id, token, number`,
  r.id, c.id, number, token(16), type, tableNo, JSON.stringify(address), JSON.stringify(lines), subtotal, fee, discount, pointsUsed,
  subtotal + fee - discount, couponCode, str(b.note, 300), now)];
  if (couponId) stmts.push(D.st('UPDATE coupons SET used = used + 1 WHERE id = ?', couponId));
  if (pointsUsed) stmts.push(D.st('UPDATE customers SET points = points - ? WHERE id = ? AND points >= ?', pointsUsed, c.id, pointsUsed));
  const res = await D.batch(stmts);
  return res[0].results[0];
}
const NEXT = { preparing: o => (o.type === 'delivery' ? 'on_way' : 'ready'), ready: () => 'completed', on_way: () => 'completed' };
async function updateOrder(D, r, id, b) {
  const o = await D.get('SELECT * FROM orders WHERE id = ? AND restaurant_id = ?', int(id), r.id);
  if (!o) fail(404, 'الطلب غير موجود');
  const s = settingsOf(r), now = Date.now(), stmts = [];
  if (b.action === 'accept') {
    if (o.status !== 'pending') fail(409, 'تم التعامل مع هذا الطلب مسبقاً');
    stmts.push(D.st("UPDATE orders SET status = 'preparing', eta = ?, accepted_at = ? WHERE id = ?", int(b.eta, 5, 240), now, o.id));
  } else if (b.action === 'reject') {
    if (['completed', 'rejected'].includes(o.status)) fail(409, 'لا يمكن رفض هذا الطلب');
    stmts.push(D.st("UPDATE orders SET status = 'rejected', reject_reason = ?, done_at = ? WHERE id = ?", str(b.reason, 120) || 'تعذّر تنفيذ الطلب', now, o.id));
    if (o.points_used) stmts.push(D.st('UPDATE customers SET points = points + ? WHERE id = ?', o.points_used, o.customer_id));
    if (o.coupon) stmts.push(D.st('UPDATE coupons SET used = MAX(0, used - 1) WHERE restaurant_id = ? AND code = ?', r.id, o.coupon));
  } else if (b.action === 'next') {
    const nx = NEXT[o.status]?.(o); if (!nx) fail(409, 'لا توجد مرحلة تالية');
    if (nx === 'completed') {
      const earned = s.loyalty.enabled ? Math.floor((o.total - o.delivery_fee) / Math.max(1, s.loyalty.per)) : 0;
      stmts.push(D.st("UPDATE orders SET status = 'completed', done_at = ?, points_earned = ? WHERE id = ?", now, earned, o.id));
      if (earned) stmts.push(D.st('UPDATE customers SET points = points + ? WHERE id = ?', earned, o.customer_id));
    } else stmts.push(D.st('UPDATE orders SET status = ?, ready_at = ? WHERE id = ?', nx, now, o.id));
  } else if (b.action === 'eta') stmts.push(D.st('UPDATE orders SET eta = ? WHERE id = ?', int(b.eta, 5, 240), o.id));
  else fail(400, 'إجراء غير معروف');
  await D.batch(stmts);
  return orderOut(await D.get(`${ADMIN_ORDER_SQL} WHERE o.id = ?`, o.id), true);
}
async function stats(D, r, days) {
  const s = settingsOf(r), now = Date.now(), from = dayStart(now) - (days - 1) * DAY;
  const os = await D.all('SELECT customer_id, status, type, total, points_used, lines, created_at FROM orders WHERE restaurant_id = ? AND created_at >= ?', r.id, from);
  const done = os.filter(o => o.status === 'completed'), revenue = done.reduce((a, o) => a + o.total, 0), series = [];
  for (let t = from; t <= now; t += DAY) { const d = done.filter(o => o.created_at >= t && o.created_at < t + DAY); series.push({ day: t, orders: d.length, revenue: d.reduce((a, o) => a + o.total, 0) }); }
  const items = {}, hours = Array(24).fill(0), types = { delivery: 0, pickup: 0, dine: 0 };
  for (const o of done) {
    hours[new Date(o.created_at + TZ).getUTCHours()]++; types[o.type]++;
    for (const l of json(o.lines, [])) { items[l.name] = items[l.name] || { name: l.name, qty: 0, revenue: 0 }; items[l.name].qty += l.qty; items[l.name].revenue += l.unit * l.qty; }
  }
  const counts = await D.all("SELECT customer_id, COUNT(*) n FROM orders WHERE restaurant_id = ? AND status = 'completed' GROUP BY customer_id", r.id);
  const cnt = Object.fromEntries(counts.map(x => [x.customer_id, x.n]));
  const custIds = [...new Set(done.map(o => o.customer_id))], returning = custIds.filter(id => cnt[id] >= 2).length;
  const newCustomers = (await D.get('SELECT COUNT(*) n FROM customers WHERE restaurant_id = ? AND created_at >= ?', r.id, from)).n;
  return {
    days, orders: done.length, revenue, avg: done.length ? revenue / done.length : 0, saved: Math.round(revenue * s.commissionPct / 100), commissionPct: s.commissionPct,
    rejected: os.filter(o => o.status === 'rejected').length, total: os.length, customers: custIds.length, returning,
    returningPct: custIds.length ? returning / custIds.length * 100 : 0, newCustomers,
    rewards: Math.round(done.reduce((a, o) => a + o.points_used, 0) / Math.max(1, s.loyalty.rewardPoints)), series, hours, types,
    topItems: Object.values(items).sort((a, b) => b.revenue - a.revenue).slice(0, 8),
  };
}

/* ---------- المسارات ---------- */
const routes = [];
function route(method, pattern, handler, opts = {}) {
  const keys = [], re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, handler, opts });
}
const RESERVED = new Set(['admin', 'api', 'r', 'uploads', 'store', 'www', 'app', 'demo', 'icons']);
const storeBySlug = async (D, slug) => (await D.get('SELECT * FROM restaurants WHERE slug = ?', String(slug).toLowerCase())) || fail(404, 'المتجر غير موجود');
const cookies = req => Object.fromEntries(String(req.headers.get('cookie') || '').split(';').map(c => c.trim().split('=')).filter(p => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
async function authRestaurant(D, req) {
  const t = cookies(req).sid; if (!t) return null;
  return D.get('SELECT r.* FROM sessions s JOIN restaurants r ON r.id = s.restaurant_id WHERE s.token = ? AND s.expires_at > ?', t, Date.now());
}
async function startSession(D, ctx, rid) {
  const t = token();
  await D.run('INSERT INTO sessions (token, restaurant_id, expires_at) VALUES (?, ?, ?)', t, rid, Date.now() + 30 * DAY);
  ctx.headers.append('Set-Cookie', `sid=${t}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${30 * 86400}${ctx.url.protocol === 'https:' ? '; Secure' : ''}`);
}

// --- واجهة الزبون ---
route('GET', '/api/store/:slug', async ({ D, params }) => {
  const r = await storeBySlug(D, params.slug), s = settingsOf(r);
  const [cats, items] = await Promise.all([
    D.all('SELECT id, name FROM categories WHERE restaurant_id = ? ORDER BY sort, id', r.id),
    D.all('SELECT * FROM items WHERE restaurant_id = ? ORDER BY sort, id', r.id),
  ]);
  return {
    restaurant: { slug: r.slug, name: r.name, phone: r.phone, tagline: s.tagline, color: s.color, logo: s.logo, cover: s.cover, whatsapp: s.whatsapp, address: s.address, open: isOpen(s), paused: s.paused, hours: s.hours, delivery: s.delivery, pickup: s.pickup, dineIn: s.dineIn, loyalty: s.loyalty, currency: s.currency, realtime: 'poll' },
    categories: cats, items: items.map(itemOut),
  };
});
route('GET', '/api/store/:slug/points', async ({ D, params, query, ip }) => {
  limit(ip, 'points', 30, 6e5);
  const r = await storeBySlug(D, params.slug), phone = normPhone(query.get('phone'));
  if (!validPhone(phone)) return { points: 0, known: false };
  const c = await D.get('SELECT points FROM customers WHERE restaurant_id = ? AND phone = ?', r.id, phone);
  return { points: c ? c.points : 0, known: !!c };
});
route('POST', '/api/store/:slug/coupon', async ({ D, params, body, ip }) => {
  limit(ip, 'coupon', 20, 6e5);
  const r = await storeBySlug(D, params.slug);
  const { coupon, discount, label } = await couponCheck(D, r.id, body.code, int(body.subtotal));
  return { code: coupon.code, discount, label };
});
route('POST', '/api/store/:slug/orders', async ({ D, env, params, body, ip, url, waitUntil }) => {
  limit(ip, 'order', 15, 6e5);
  const r = await storeBySlug(D, params.slug);
  const o = await createOrder(D, r, body);
  waitUntil(notifyTelegram(env, url.origin, r, o.id).catch(() => null));
  return o;
});
route('GET', '/api/orders/:id', async ({ D, params, query }) => {
  const o = await D.get('SELECT * FROM orders WHERE id = ?', int(params.id));
  if (!o || !query.get('token') || o.token !== query.get('token')) fail(404, 'الطلب غير موجود');
  const r = await D.get('SELECT * FROM restaurants WHERE id = ?', o.restaurant_id), s = settingsOf(r);
  const c = await D.get('SELECT points FROM customers WHERE id = ?', o.customer_id);
  return { order: orderOut(o), restaurant: { name: r.name, slug: r.slug, phone: r.phone, whatsapp: s.whatsapp, color: s.color, currency: s.currency, loyalty: s.loyalty }, points: c?.points || 0 };
});

// --- المصادقة ---
route('POST', '/api/auth/signup', async ctx => {
  const { D, body, ip } = ctx;
  limit(ip, 'signup', 5, 36e5);
  const name = str(body.name, 60), slug = str(body.slug, 30).toLowerCase(), phone = normPhone(body.phone), pw = String(body.password || '');
  if (name.length < 2) fail(400, 'اكتب اسم المطعم');
  if (!/^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/.test(slug) || RESERVED.has(slug)) fail(400, 'رابط المتجر: أحرف إنجليزية صغيرة وأرقام وشرطة فقط (3–30 حرف)');
  if (!validPhone(phone)) fail(400, 'رقم الهاتف غير صحيح');
  if (pw.length < 8) fail(400, 'كلمة المرور 8 أحرف على الأقل');
  if (await D.get('SELECT 1 FROM restaurants WHERE slug = ?', slug)) fail(409, 'رابط المتجر مستخدم، اختر غيره');
  if (await D.get('SELECT 1 FROM restaurants WHERE phone = ?', phone)) fail(409, 'هذا الرقم مسجّل مسبقاً — سجّل الدخول');
  const r = await D.get('INSERT INTO restaurants (slug, name, phone, owner_name, pass, settings, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
    slug, name, phone, str(body.owner, 60), await hashPass(pw), JSON.stringify({ whatsapp: phone, delivery: { areas: [{ name: 'المنطقة القريبة', fee: 2000 }] } }), Date.now());
  await D.batch(['الأطباق الرئيسية', 'المشروبات'].map((c, i) => D.st('INSERT INTO categories (restaurant_id, name, sort) VALUES (?, ?, ?)', r.id, c, i)));
  await startSession(D, ctx, r.id);
  return { ok: true };
});
route('POST', '/api/auth/login', async ctx => {
  const { D, body, ip } = ctx;
  limit(ip, 'login', 10, 6e5);
  const r = await D.get('SELECT * FROM restaurants WHERE phone = ?', normPhone(body.phone));
  if (!r || !(await checkPass(String(body.password || ''), r.pass))) fail(401, 'رقم الهاتف أو كلمة المرور غير صحيحة');
  await startSession(D, ctx, r.id);
  return { ok: true };
});
route('POST', '/api/auth/logout', async ctx => {
  const t = cookies(ctx.req).sid;
  if (t) await ctx.D.run('DELETE FROM sessions WHERE token = ?', t);
  ctx.headers.append('Set-Cookie', 'sid=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0');
  return { ok: true };
});

// --- لوحة المطعم ---
const meOut = (r, env) => {
  const s = settingsOf(r);
  return { id: r.id, slug: r.slug, name: r.name, phone: r.phone, owner: r.owner_name, settings: s, open: isOpen(s), realtime: 'poll', telegram: { configured: tgReady(env), chats: s.telegram.chats.length } };
};
route('GET', '/api/admin/me', ({ rest, env }) => meOut(rest, env), { auth: true });
route('PUT', '/api/admin/settings', async ({ D, env, rest, body }) => {
  const cur = settingsOf(rest), b = body.settings || {}, time = v => (/^\d{1,2}:\d{2}$/.test(v) ? v : null);
  const next = {
    tagline: str(b.tagline ?? cur.tagline, 120), color: /^#[0-9a-f]{6}$/i.test(b.color) ? b.color : cur.color,
    logo: str(b.logo ?? cur.logo, 200), cover: str(b.cover ?? cur.cover, 200), whatsapp: b.whatsapp !== undefined ? normPhone(b.whatsapp) : cur.whatsapp,
    address: str(b.address ?? cur.address, 200), paused: b.paused !== undefined ? !!b.paused : cur.paused,
    hours: { open: time(b.hours?.open) || cur.hours.open, close: time(b.hours?.close) || cur.hours.close },
    delivery: b.delivery ? { enabled: !!b.delivery.enabled, minOrder: int(b.delivery.minOrder, 0, 1e7), eta: int(b.delivery.eta, 5, 240), areas: (Array.isArray(b.delivery.areas) ? b.delivery.areas : []).map(a => ({ name: str(a.name, 40), fee: int(a.fee, 0, 1e6) })).filter(a => a.name).slice(0, 60) } : cur.delivery,
    pickup: b.pickup ? { enabled: !!b.pickup.enabled, eta: int(b.pickup.eta, 5, 240) } : cur.pickup,
    dineIn: b.dineIn ? { enabled: !!b.dineIn.enabled } : cur.dineIn,
    loyalty: b.loyalty ? { enabled: !!b.loyalty.enabled, per: int(b.loyalty.per, 100, 1e6), rewardPoints: int(b.loyalty.rewardPoints, 1, 1e5), rewardValue: int(b.loyalty.rewardValue, 0, 1e7) } : cur.loyalty,
    commissionPct: b.commissionPct !== undefined ? int(b.commissionPct, 0, 60) : cur.commissionPct, currency: str(b.currency ?? cur.currency, 10) || 'د.ع',
    telegram: cur.telegram,
  };
  const name = str(body.name ?? rest.name, 60) || rest.name;
  await D.run('UPDATE restaurants SET name = ?, owner_name = ?, settings = ? WHERE id = ?', name, str(body.owner ?? rest.owner_name, 60), JSON.stringify(next), rest.id);
  return meOut(await D.get('SELECT * FROM restaurants WHERE id = ?', rest.id), env);
}, { auth: true });
route('POST', '/api/admin/password', async ({ D, rest, body }) => {
  if (!(await checkPass(String(body.current || ''), rest.pass))) fail(400, 'كلمة المرور الحالية غير صحيحة');
  if (String(body.next || '').length < 8) fail(400, 'كلمة المرور الجديدة 8 أحرف على الأقل');
  await D.run('UPDATE restaurants SET pass = ? WHERE id = ?', await hashPass(String(body.next)), rest.id);
  return { ok: true };
}, { auth: true });

route('GET', '/api/admin/orders', async ({ D, rest, query }) => {
  const rows = query.get('scope') === 'history'
    ? await D.all(`${ADMIN_ORDER_SQL} WHERE o.restaurant_id = ? ORDER BY o.created_at DESC LIMIT 200`, rest.id)
    : await D.all(`${ADMIN_ORDER_SQL} WHERE o.restaurant_id = ? AND (o.status IN ('pending','preparing','ready','on_way') OR o.created_at >= ?) ORDER BY o.created_at`, rest.id, dayStart(Date.now()));
  return rows.map(o => orderOut(o, true));
}, { auth: true });
route('PATCH', '/api/admin/orders/:id', ({ D, rest, params, body }) => updateOrder(D, rest, params.id, body), { auth: true });

route('GET', '/api/admin/menu', async ({ D, rest }) => ({
  categories: await D.all('SELECT id, name, sort FROM categories WHERE restaurant_id = ? ORDER BY sort, id', rest.id),
  items: (await D.all('SELECT * FROM items WHERE restaurant_id = ? ORDER BY sort, id', rest.id)).map(itemOut),
}), { auth: true });
route('POST', '/api/admin/categories', async ({ D, rest, body }) => {
  const name = str(body.name, 40) || fail(400, 'اكتب اسم القسم');
  const r = await D.get('INSERT INTO categories (restaurant_id, name, sort) VALUES (?, ?, (SELECT COALESCE(MAX(sort), -1) + 1 FROM categories WHERE restaurant_id = ?)) RETURNING id', rest.id, name, rest.id);
  return { id: r.id };
}, { auth: true });
route('PUT', '/api/admin/categories/order', async ({ D, rest, body }) => {
  const ids = Array.isArray(body.ids) ? body.ids : [];
  if (ids.length) await D.batch(ids.map((id, i) => D.st('UPDATE categories SET sort = ? WHERE id = ? AND restaurant_id = ?', i, int(id), rest.id)));
  return { ok: true };
}, { auth: true });
route('PUT', '/api/admin/categories/:id', async ({ D, rest, params, body }) => {
  await D.run('UPDATE categories SET name = ? WHERE id = ? AND restaurant_id = ?', str(body.name, 40) || fail(400, 'اكتب اسم القسم'), int(params.id), rest.id);
  return { ok: true };
}, { auth: true });
route('DELETE', '/api/admin/categories/:id', async ({ D, rest, params }) => {
  if (await D.get('SELECT 1 FROM items WHERE category_id = ? AND restaurant_id = ?', int(params.id), rest.id)) fail(409, 'انقل أو احذف أصناف هذا القسم أولاً');
  await D.run('DELETE FROM categories WHERE id = ? AND restaurant_id = ?', int(params.id), rest.id);
  return { ok: true };
}, { auth: true });
const cleanOptions = opts => (Array.isArray(opts) ? opts : []).slice(0, 10).map((g, gi) => ({
  id: str(g.id, 20) || 'g' + gi + token(2), name: str(g.name, 40), required: !!g.required, multi: !!g.multi,
  choices: (Array.isArray(g.choices) ? g.choices : []).slice(0, 20).map((c, ci) => ({ id: str(c.id, 20) || 'c' + ci + token(2), name: str(c.name, 40), price: int(c.price, 0, 1e7) })).filter(c => c.name),
})).filter(g => g.name && g.choices.length);
async function itemFields(D, rest, b) {
  const name = str(b.name, 60); if (!name) fail(400, 'اكتب اسم الصنف');
  const cat = b.category_id ? await D.get('SELECT id FROM categories WHERE id = ? AND restaurant_id = ?', int(b.category_id), rest.id) : null;
  return [cat ? cat.id : null, name, str(b.description, 300), int(b.price, 0, 1e8), str(b.emoji, 8), str(b.image, 200), b.available === false ? 0 : 1, b.popular ? 1 : 0, JSON.stringify(cleanOptions(b.options))];
}
route('POST', '/api/admin/items', async ({ D, rest, body }) => {
  const f = await itemFields(D, rest, body);
  const it = await D.get(`INSERT INTO items (category_id, name, description, price, emoji, image, available, popular, options, restaurant_id, sort)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort), -1) + 1 FROM items WHERE restaurant_id = ?)) RETURNING *`, ...f, rest.id, rest.id);
  return itemOut(it);
}, { auth: true });
route('PUT', '/api/admin/items/:id', async ({ D, rest, params, body }) => {
  const it = await D.get('UPDATE items SET category_id = ?, name = ?, description = ?, price = ?, emoji = ?, image = ?, available = ?, popular = ?, options = ? WHERE id = ? AND restaurant_id = ? RETURNING *', ...(await itemFields(D, rest, body)), int(params.id), rest.id);
  if (!it) fail(404, 'الصنف غير موجود');
  return itemOut(it);
}, { auth: true });
route('PATCH', '/api/admin/items/:id', async ({ D, rest, params, body }) => {
  if (body.available !== undefined) await D.run('UPDATE items SET available = ? WHERE id = ? AND restaurant_id = ?', body.available ? 1 : 0, int(params.id), rest.id);
  if (body.popular !== undefined) await D.run('UPDATE items SET popular = ? WHERE id = ? AND restaurant_id = ?', body.popular ? 1 : 0, int(params.id), rest.id);
  return { ok: true };
}, { auth: true });
route('DELETE', '/api/admin/items/:id', async ({ D, rest, params }) => {
  await D.run('DELETE FROM items WHERE id = ? AND restaurant_id = ?', int(params.id), rest.id);
  return { ok: true };
}, { auth: true });
route('POST', '/api/admin/upload', async ({ D, rest, body }) => {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.data || ''));
  if (!m) fail(400, 'صيغة الصورة غير مدعومة');
  const bin = Uint8Array.from(atob(m[2]), ch => ch.charCodeAt(0));
  if (bin.length > 900 * 1024) fail(413, 'حجم الصورة كبير');
  const id = token(12) + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]);
  await D.run('INSERT INTO images (id, restaurant_id, mime, data, created_at) VALUES (?, ?, ?, ?, ?)', id, rest.id, 'image/' + m[1], bin.buffer, Date.now());
  return { url: '/uploads/' + id };
}, { auth: true, limit: 2.5e6 });

route('GET', '/api/admin/customers', ({ D, rest }) => D.all(`SELECT c.id, c.phone, c.name, c.area, c.points, c.blocked, c.created_at,
    COUNT(o.id) orders, COALESCE(SUM(o.total), 0) spent, MAX(o.created_at) last_at
  FROM customers c LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'completed'
  WHERE c.restaurant_id = ? GROUP BY c.id ORDER BY last_at DESC`, rest.id), { auth: true });
route('PATCH', '/api/admin/customers/:id', async ({ D, rest, params, body }) => {
  await D.run('UPDATE customers SET blocked = ? WHERE id = ? AND restaurant_id = ?', body.blocked ? 1 : 0, int(params.id), rest.id);
  return { ok: true };
}, { auth: true });

route('GET', '/api/admin/coupons', ({ D, rest }) => D.all('SELECT * FROM coupons WHERE restaurant_id = ? ORDER BY id DESC', rest.id), { auth: true });
function couponFields(b) {
  const code = str(b.code, 20).toUpperCase().replace(/\s+/g, '');
  if (!/^[A-Z0-9_-]{3,20}$/.test(code)) fail(400, 'الكود: أحرف إنجليزية وأرقام (3–20)');
  const kind = b.kind === 'fixed' ? 'fixed' : 'pct';
  return [code, kind, kind === 'pct' ? int(b.value, 1, 100) : int(b.value, 250, 1e7), int(b.min_order, 0, 1e8), int(b.max_uses, 0, 1e6), b.expires_at ? int(b.expires_at) : null, b.active === false ? 0 : 1];
}
const uniqueGuard = async fn => { try { await fn(); } catch (e) { if (String(e.message).includes('UNIQUE')) fail(409, 'هذا الكود موجود مسبقاً'); throw e; } };
route('POST', '/api/admin/coupons', async ({ D, rest, body }) => {
  await uniqueGuard(() => D.run('INSERT INTO coupons (code, kind, value, min_order, max_uses, expires_at, active, restaurant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ...couponFields(body), rest.id));
  return { ok: true };
}, { auth: true });
route('PUT', '/api/admin/coupons/:id', async ({ D, rest, params, body }) => {
  await uniqueGuard(() => D.run('UPDATE coupons SET code = ?, kind = ?, value = ?, min_order = ?, max_uses = ?, expires_at = ?, active = ? WHERE id = ? AND restaurant_id = ?', ...couponFields(body), int(params.id), rest.id));
  return { ok: true };
}, { auth: true });
route('DELETE', '/api/admin/coupons/:id', async ({ D, rest, params }) => {
  await D.run('DELETE FROM coupons WHERE id = ? AND restaurant_id = ?', int(params.id), rest.id);
  return { ok: true };
}, { auth: true });
route('GET', '/api/admin/stats', ({ D, rest, query }) => stats(D, rest, int(query.get('days') || 30, 1, 365)), { auth: true });

// --- تيليگرام ---
route('POST', '/api/admin/telegram/link', async ({ D, env, rest, url }) => {
  if (!tgReady(env)) fail(400, 'إشعارات تيليگرام غير مفعّلة على السيرفر بعد');
  if (url.protocol === 'https:') await tg(env, 'setWebhook', { url: `${url.origin}/api/telegram/webhook`, secret_token: await tgSecret(env), allowed_updates: ['message'] });
  const code = token(8);
  await D.run('DELETE FROM tg_links WHERE expires_at < ?', Date.now());
  await D.run('INSERT INTO tg_links (code, restaurant_id, expires_at) VALUES (?, ?, ?)', code, rest.id, Date.now() + 15 * 60e3);
  return { url: `https://t.me/${env.TELEGRAM_BOT_USERNAME}?start=${code}` };
}, { auth: true });
route('POST', '/api/admin/telegram/test', async ({ env, rest }) => {
  const s = settingsOf(rest);
  if (!s.telegram.chats.length) fail(400, 'ما اكو حساب تيليگرام مربوط');
  await Promise.all(s.telegram.chats.map(c => tg(env, 'sendMessage', { chat_id: c.id, text: `✅ إشعارات <b>${escHtml(rest.name)}</b> شغّالة — راح يوصلك هنا كل طلب جديد.`, parse_mode: 'HTML' })));
  return { ok: true };
}, { auth: true });
route('POST', '/api/admin/telegram/unlink', async ({ D, rest }) => {
  const s = json(rest.settings, {}); s.telegram = { chats: [] };
  await D.run('UPDATE restaurants SET settings = ? WHERE id = ?', JSON.stringify(s), rest.id);
  return { ok: true };
}, { auth: true });
route('POST', '/api/telegram/webhook', async ({ D, env, req, body }) => {
  if (!tgReady(env) || req.headers.get('X-Telegram-Bot-Api-Secret-Token') !== await tgSecret(env)) fail(403, 'forbidden');
  const msg = body.message; if (!msg?.chat?.id) return { ok: true };
  const m = /^\/start\s+([a-f0-9]{16})$/.exec(String(msg.text || '').trim());
  if (!m) { await tg(env, 'sendMessage', { chat_id: msg.chat.id, text: 'أهلاً 👋 حتى توصلك طلبات مطعمك هنا، افتح لوحة سُفرة ← الإعدادات ← "ربط تيليگرام".' }); return { ok: true }; }
  const link = await D.get('SELECT * FROM tg_links WHERE code = ? AND expires_at > ?', m[1], Date.now());
  if (!link) { await tg(env, 'sendMessage', { chat_id: msg.chat.id, text: 'رابط الربط منتهي — اضغط "ربط تيليگرام" من اللوحة مرة ثانية.' }); return { ok: true }; }
  const r = await D.get('SELECT * FROM restaurants WHERE id = ?', link.restaurant_id), s = json(r.settings, {});
  const chats = (s.telegram?.chats || []).filter(c => c.id !== msg.chat.id);
  chats.push({ id: msg.chat.id, name: [msg.chat.first_name, msg.chat.last_name].filter(Boolean).join(' ') || msg.chat.title || '' });
  s.telegram = { chats: chats.slice(-5) };
  await D.batch([D.st('UPDATE restaurants SET settings = ? WHERE id = ?', JSON.stringify(s), r.id), D.st('DELETE FROM tg_links WHERE code = ?', m[1])]);
  await tg(env, 'sendMessage', { chat_id: msg.chat.id, text: `✅ تم الربط وية <b>${escHtml(r.name)}</b>\nراح يوصلك هنا إشعار بكل طلب جديد، وتقرير أسبوعي كل سبت.`, parse_mode: 'HTML' });
  return { ok: true };
});

/* ---------- الصور وروابط المتجر ---------- */
function manifestFor(slug, name, tagline, color) {
  return {
    id: `./?r=${slug}`, name, short_name: name.replace(/^(مطعم|كافيه|قهوة)\s+/, '').slice(0, 14), description: tagline || `اطلب من ${name} مباشرة`,
    lang: 'ar', dir: 'rtl', start_url: `./?r=${slug}`, scope: './', display: 'standalone', orientation: 'portrait', background_color: '#f5f3ef', theme_color: color,
    icons: [{ src: '../icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '../icons/icon-512.png', sizes: '512x512', type: 'image/png' }, { src: '../icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }],
  };
}
async function special(req, env, url) {
  const p = url.pathname;
  const short = p.match(/^\/r\/([a-z0-9-]+)\/?$/i);
  if (short) { const t = url.searchParams.get('t'); return Response.redirect(`${url.origin}/store/?r=${short[1].toLowerCase()}${t ? '&t=' + encodeURIComponent(t) : ''}`, 302); }
  if (p === '/store/manifest.webmanifest') {
    const r = await db(env).get('SELECT * FROM restaurants WHERE slug = ?', String(url.searchParams.get('r') || '').toLowerCase());
    if (!r) return new Response('', { status: 404 });
    const s = settingsOf(r);
    return new Response(JSON.stringify(manifestFor(r.slug, r.name, s.tagline, s.color)), { headers: { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'no-cache' } });
  }
  const img = p.match(/^\/uploads\/([a-f0-9]{24}\.(?:jpg|png|webp))$/);
  if (img) {
    const row = await db(env).get('SELECT mime, data FROM images WHERE id = ?', img[1]);
    if (!row) return new Response('', { status: 404 });
    return new Response(new Uint8Array(row.data), { headers: { 'Content-Type': row.mime, 'Cache-Control': 'public, max-age=31536000, immutable' } });
  }
  return null;
}

/* ---------- نقطة الدخول ---------- */
async function readJson(req, max = 1e5) {
  if (!String(req.headers.get('content-type') || '').includes('application/json')) fail(415, 'نوع المحتوى يجب أن يكون JSON');
  const text = await req.text();
  if (text.length > max) fail(413, 'الطلب كبير جداً');
  try { return text ? JSON.parse(text) : {}; } catch { fail(400, 'بيانات غير صالحة'); }
}
async function handleApi(req, env, ctx, url) {
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  try {
    const p = decodeURIComponent(url.pathname);
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = p.match(r.re); if (!m) continue;
      const D = db(env);
      const c = { req, env, url, D, headers, query: url.searchParams, ip: req.headers.get('cf-connecting-ip') || '', params: Object.fromEntries(r.keys.map((k, i) => [k, m[i + 1]])), waitUntil: x => ctx.waitUntil(x) };
      if (r.opts.auth) { c.rest = await authRestaurant(D, req); if (!c.rest) fail(401, 'انتهت الجلسة، سجّل الدخول'); }
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) c.body = await readJson(req, r.opts.limit);
      const out = await r.handler(c);
      return new Response(JSON.stringify(out ?? { ok: true }), { status: 200, headers });
    }
    fail(404, 'غير موجود');
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    return new Response(JSON.stringify({ error: e.status ? e.message : 'خطأ في الخادم، حاول مرة أخرى' }), { status: e.status || 500, headers });
  }
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) return handleApi(req, env, ctx, url);
    const res = await special(req, env, url);
    return res || env.ASSETS.fetch(req);
  },
  // تقرير أسبوعي على تيليگرام (كل سبت صباحاً)
  async scheduled(event, env, ctx) {
    if (!tgReady(env)) return;
    const D = db(env);
    for (const r of await D.all('SELECT * FROM restaurants')) {
      const s = settingsOf(r);
      if (!s.telegram.chats.length) continue;
      const st = await stats(D, r, 7);
      const text = [
        `📊 <b>تقرير الأسبوع — ${escHtml(r.name)}</b>`, '',
        `🧾 الطلبات المباشرة: <b>${fmt(st.orders)}</b>`, `💰 الإيرادات: <b>${fmt(st.revenue)} ${escHtml(s.currency)}</b>`,
        `💸 العمولة اللي وفّرتها: <b>${fmt(st.saved)} ${escHtml(s.currency)}</b>`, `✨ زبائن جدد: <b>${fmt(st.newCustomers)}</b>`,
        `🔁 زبائن رجعوا يطلبون: <b>${fmt(st.returningPct, 0)}%</b>`,
        st.topItems[0] ? `🏆 الأكثر طلباً: ${escHtml(st.topItems[0].name)}` : '',
      ].filter(Boolean).join('\n');
      ctx.waitUntil(Promise.all(s.telegram.chats.map(c => tg(env, 'sendMessage', { chat_id: c.id, text, parse_mode: 'HTML' }))));
    }
  },
};
