'use strict';
/* سُفرة — وضع العرض (GitHub Pages)
   خادم وهمي يشتغل داخل المتصفح: يعترض طلبات /api ويطبّق نفس منطق server.js
   على بيانات محفوظة في IndexedDB، ويبث التحديثات بين التبويبات عبر BroadcastChannel. */
(function () {
  window.SUFRA_DEMO = true;
  const ROOT = new URL('../', location.href).href;
  const DATA_URL = ROOT + 'demo/data.json';
  const DB_NAME = 'sufra-demo', OS = 'kv', KEY = 'state', SESSION = 'sufra-demo-session';
  const DEMO_PASSWORD = 'demo1234';
  const realFetch = window.fetch.bind(window);
  const RealES = window.EventSource;
  const bc = 'BroadcastChannel' in window ? new BroadcastChannel('sufra-demo') : null;

  /* ---------- التخزين ---------- */
  let dbp = null;
  const idb = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(OS);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const idbReq = (mode, fn) => idb().then(d => new Promise((res, rej) => {
    const tx = d.transaction(OS, mode), rq = fn(tx.objectStore(OS));
    tx.oncomplete = () => res(rq && rq.result); tx.onerror = () => rej(tx.error);
  }));
  let S = null;
  async function freshState() {
    const d = await realFetch(DATA_URL, { cache: 'no-cache' }).then(r => r.json());
    const shift = Date.now() - d.exportedAt;
    const sh = (o, ...keys) => keys.forEach(k => { if (o[k]) o[k] += shift; });
    // مفتوح 24 ساعة حتى العرض يشتغل بأي وقت
    d.restaurants.forEach(r => { sh(r, 'created_at'); r.settings.hours = { open: '00:00', close: '00:00' }; });
    d.customers.forEach(c => sh(c, 'created_at'));
    d.orders.forEach(o => sh(o, 'created_at', 'accepted_at', 'ready_at', 'done_at'));
    d.coupons.forEach(c => sh(c, 'expires_at'));
    delete d.exportedAt;
    return d;
  }
  async function sync() {
    try { const v = await idbReq('readonly', s => s.get(KEY)); if (v) S = v; } catch { /* IndexedDB غير متاح: نكمل بالذاكرة */ }
    if (!S) { S = await freshState(); await persist(); }
  }
  async function persist() { try { await idbReq('readwrite', s => s.put(S, KEY)); } catch { /* */ } }
  async function resetDemo() {
    try { await idbReq('readwrite', s => s.delete(KEY)); } catch { /* */ }
    localStorage.removeItem(SESSION);
    Object.keys(localStorage).filter(k => k.startsWith('sufra:')).forEach(k => localStorage.removeItem(k));
    bc?.postMessage({ reset: true });
    location.reload();
  }

  /* ---------- أدوات (نفس منطق الخادم) ---------- */
  class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
  const fail = (status, msg) => { throw new HttpError(status, msg); };
  const DAY = 864e5;
  const dayStart = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);
  const int = (v, min = 0, max = 1e9) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min; };
  const token = (n = 16) => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, '0')).join('');
  const clone = o => JSON.parse(JSON.stringify(o));
  const nextId = arr => arr.reduce((m, x) => Math.max(m, x.id), 0) + 1;
  function normPhone(v) {
    let p = String(v ?? '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^\d+]/g, '');
    if (p.startsWith('+964')) p = '0' + p.slice(4); else if (p.startsWith('00964')) p = '0' + p.slice(5);
    else if (p.startsWith('964')) p = '0' + p.slice(3); else if (p.startsWith('7') && p.length === 10) p = '0' + p;
    return p;
  }
  const validPhone = p => /^07\d{9}$/.test(p);
  async function sha256(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('sufra:' + s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }

  const DEFAULT_SETTINGS = {
    tagline: '', color: '#d9480f', logo: '', cover: '', whatsapp: '', address: '', paused: false, hours: { open: '10:00', close: '23:59' },
    delivery: { enabled: true, minOrder: 10000, eta: 40, areas: [] }, pickup: { enabled: true, eta: 20 }, dineIn: { enabled: true },
    loyalty: { enabled: true, per: 1000, rewardPoints: 100, rewardValue: 5000 }, commissionPct: 20, currency: 'د.ع',
  };
  function merge(base, over) {
    if (Array.isArray(base)) return Array.isArray(over) ? over : base;
    if (base && typeof base === 'object') { const out = { ...base }; for (const k of Object.keys(base)) if (over && over[k] !== undefined) out[k] = merge(base[k], over[k]); return out; }
    return over === undefined ? base : over;
  }
  const settingsOf = r => merge(DEFAULT_SETTINGS, r.settings || {});
  function isOpen(s, t = Date.now()) {
    if (s.paused) return false;
    const toM = h => { const [a, b] = String(h || '0:0').split(':').map(Number); return (a || 0) * 60 + (b || 0); };
    const o = toM(s.hours.open); let c = toM(s.hours.close); if (c === 0) c = 1440; if (o === c) return true;
    const d = new Date(t), m = d.getHours() * 60 + d.getMinutes();
    return o < c ? m >= o && m < c : m >= o || m < c;
  }
  const itemOut = i => ({ id: i.id, category_id: i.category_id, name: i.name, description: i.description, price: i.price, emoji: i.emoji, image: i.image, available: !!i.available, popular: !!i.popular, options: clone(i.options || []), sort: i.sort });
  const custById = id => S.customers.find(c => c.id === id);
  function orderOut(o, admin = false) {
    const out = {
      id: o.id, number: o.number, status: o.status, type: o.type, table: o.table_no, address: clone(o.address || {}), lines: clone(o.lines),
      subtotal: o.subtotal, delivery_fee: o.delivery_fee, discount: o.discount, points_used: o.points_used, points_earned: o.points_earned,
      total: o.total, coupon: o.coupon, note: o.note, eta: o.eta, reject_reason: o.reject_reason, created_at: o.created_at,
      accepted_at: o.accepted_at, ready_at: o.ready_at, done_at: o.done_at,
    };
    if (admin) {
      const c = custById(o.customer_id);
      out.customer = { id: o.customer_id, name: c?.name || '', phone: c?.phone || '', previous: S.orders.filter(x => x.customer_id === o.customer_id && x.status === 'completed' && x.id !== o.id).length };
    }
    return out;
  }

  /* ---------- البث ---------- */
  const listeners = new Map();
  let outbox = [];
  const emit = (key, event, data) => outbox.push({ key, event, data });
  function deliver({ key, event, data }) { (listeners.get(key) || new Set()).forEach(es => es._fire(event, data)); }
  function flush() { const msgs = outbox; outbox = []; msgs.forEach(m => { deliver(m); bc?.postMessage(m); }); }
  if (bc) bc.onmessage = e => { if (e.data?.reset) return location.reload(); deliver(e.data); };
  function notifyOrder(o) { emit(`admin:${o.restaurant_id}`, 'order', orderOut(o, true)); emit(`order:${o.id}`, 'status', orderOut(o)); }

  /* ---------- منطق الطلبات ---------- */
  function couponCheck(rid, code, subtotal) {
    const c = S.coupons.find(x => x.restaurant_id === rid && x.code.toUpperCase() === str(code, 30).toUpperCase());
    if (!c || !c.active) fail(400, 'الكوبون غير صالح');
    if (c.expires_at && c.expires_at < Date.now()) fail(400, 'انتهت صلاحية الكوبون');
    if (c.max_uses && c.used >= c.max_uses) fail(400, 'انتهى عدد استخدامات هذا الكوبون');
    if (subtotal < c.min_order) fail(400, `الكوبون يحتاج طلب بقيمة ${fmt(c.min_order)} أو أكثر`);
    const d = c.kind === 'pct' ? Math.round(subtotal * c.value / 100 / 250) * 250 : c.value;
    return { coupon: c, discount: Math.min(d, subtotal), label: c.kind === 'pct' ? `خصم ${c.value}%` : `خصم ${fmt(c.value)}` };
  }
  function buildLines(rid, items) {
    if (!Array.isArray(items) || !items.length) fail(400, 'السلة فارغة');
    let subtotal = 0;
    const lines = items.map(x => {
      const it = S.items.find(i => i.id === int(x.itemId) && i.restaurant_id === rid);
      if (!it) fail(400, 'أحد الأصناف لم يعد موجوداً، حدّث الصفحة');
      if (!it.available) fail(409, `"${it.name}" نفد حالياً`);
      const qty = int(x.qty, 1, 50), chosen = new Set(Array.isArray(x.choices) ? x.choices.map(String) : []), names = [];
      let unit = it.price;
      for (const g of it.options || []) {
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
  function createOrder(r, b, force = false) {
    const s = settingsOf(r);
    if (!force && !isOpen(s)) fail(409, 'المطعم لا يستقبل طلبات حالياً');
    const type = ['delivery', 'pickup', 'dine'].includes(b.type) ? b.type : fail(400, 'نوع الطلب غير صحيح');
    if (type === 'delivery' && !s.delivery.enabled) fail(400, 'التوصيل غير متاح حالياً');
    if (type === 'pickup' && !s.pickup.enabled) fail(400, 'الاستلام غير متاح حالياً');
    if (type === 'dine' && !s.dineIn.enabled) fail(400, 'الطلب من الطاولة غير متاح');
    const name = str(b.name, 60); if (name.length < 2) fail(400, 'اكتب اسمك');
    const phone = normPhone(b.phone); if (!validPhone(phone)) fail(400, 'رقم الهاتف غير صحيح — مثال: 07701234567');
    const { lines, subtotal } = buildLines(r.id, b.items);
    let fee = 0, address = {};
    if (type === 'delivery') {
      const area = s.delivery.areas.find(a => a.name === b.area); if (!area) fail(400, 'اختر منطقة التوصيل');
      if (subtotal < s.delivery.minOrder) fail(400, `الحد الأدنى للتوصيل ${fmt(s.delivery.minOrder)} ${s.currency}`);
      const details = str(b.address, 300); if (details.length < 4) fail(400, 'اكتب تفاصيل العنوان');
      fee = int(area.fee, 0); address = { area: area.name, details };
      const lat = Number(b.lat), lng = Number(b.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng) && b.lat != null) Object.assign(address, { lat, lng });
    }
    const tableNo = type === 'dine' ? str(b.table, 10) : '';
    if (type === 'dine' && !tableNo) fail(400, 'رقم الطاولة مفقود — امسح رمز QR الموجود على الطاولة');
    let c = S.customers.find(x => x.restaurant_id === r.id && x.phone === phone);
    if (!c) { c = { id: nextId(S.customers), restaurant_id: r.id, phone, name, area: address.area || '', points: 0, created_at: Date.now() }; S.customers.push(c); }
    else { c.name = name; if (address.area) c.area = address.area; }
    let discount = 0, couponCode = '', pointsUsed = 0;
    if (str(b.coupon)) { const cc = couponCheck(r.id, b.coupon, subtotal); discount += cc.discount; couponCode = cc.coupon.code; cc.coupon.used++; }
    if (b.redeem && s.loyalty.enabled && c.points >= s.loyalty.rewardPoints) { pointsUsed = s.loyalty.rewardPoints; discount += s.loyalty.rewardValue; c.points -= pointsUsed; }
    discount = Math.min(discount, subtotal);
    const now = Date.now();
    const o = {
      id: nextId(S.orders), restaurant_id: r.id, customer_id: c.id, number: S.orders.filter(x => x.restaurant_id === r.id && x.created_at >= dayStart(now)).length + 1,
      token: token(), type, table_no: tableNo, address, lines, subtotal, delivery_fee: fee, discount, points_used: pointsUsed, points_earned: 0,
      total: subtotal + fee - discount, coupon: couponCode, note: str(b.note, 300), status: 'pending', eta: 0, reject_reason: '', created_at: now,
      accepted_at: null, ready_at: null, done_at: null,
    };
    S.orders.push(o);
    return o;
  }
  const NEXT = { preparing: o => (o.type === 'delivery' ? 'on_way' : 'ready'), ready: () => 'completed', on_way: () => 'completed' };
  function updateOrder(r, id, b) {
    const o = S.orders.find(x => x.id === int(id) && x.restaurant_id === r.id); if (!o) fail(404, 'الطلب غير موجود');
    const s = settingsOf(r), now = Date.now();
    if (b.action === 'accept') {
      if (o.status !== 'pending') fail(409, 'تم التعامل مع هذا الطلب مسبقاً');
      Object.assign(o, { status: 'preparing', eta: int(b.eta, 5, 240), accepted_at: now });
    } else if (b.action === 'reject') {
      if (['completed', 'rejected'].includes(o.status)) fail(409, 'لا يمكن رفض هذا الطلب');
      Object.assign(o, { status: 'rejected', reject_reason: str(b.reason, 120) || 'تعذّر تنفيذ الطلب', done_at: now });
      if (o.points_used) custById(o.customer_id).points += o.points_used;
      if (o.coupon) { const c = S.coupons.find(x => x.restaurant_id === r.id && x.code === o.coupon); if (c) c.used = Math.max(0, c.used - 1); }
    } else if (b.action === 'next') {
      const nx = NEXT[o.status]?.(o); if (!nx) fail(409, 'لا توجد مرحلة تالية');
      if (nx === 'completed') {
        const earned = s.loyalty.enabled ? Math.floor((o.total - o.delivery_fee) / Math.max(1, s.loyalty.per)) : 0;
        Object.assign(o, { status: 'completed', done_at: now, points_earned: earned });
        if (earned) custById(o.customer_id).points += earned;
      } else Object.assign(o, { status: nx, ready_at: now });
    } else if (b.action === 'eta') o.eta = int(b.eta, 5, 240);
    else fail(400, 'إجراء غير معروف');
    notifyOrder(o);
    return orderOut(o, true);
  }
  function stats(r, days) {
    const s = settingsOf(r), now = Date.now(), from = dayStart(now) - (days - 1) * DAY;
    const os = S.orders.filter(o => o.restaurant_id === r.id && o.created_at >= from), done = os.filter(o => o.status === 'completed');
    const revenue = done.reduce((a, o) => a + o.total, 0), series = [];
    for (let t = from; t <= now; t += DAY) { const d = done.filter(o => o.created_at >= t && o.created_at < t + DAY); series.push({ day: t, orders: d.length, revenue: d.reduce((a, o) => a + o.total, 0) }); }
    const items = {}, hours = Array(24).fill(0), types = { delivery: 0, pickup: 0, dine: 0 };
    for (const o of done) {
      hours[new Date(o.created_at).getHours()]++; types[o.type]++;
      for (const l of o.lines) { items[l.name] = items[l.name] || { name: l.name, qty: 0, revenue: 0 }; items[l.name].qty += l.qty; items[l.name].revenue += l.unit * l.qty; }
    }
    const count = {}; S.orders.forEach(o => { if (o.status === 'completed') count[o.customer_id] = (count[o.customer_id] || 0) + 1; });
    const custIds = [...new Set(done.map(o => o.customer_id))], returning = custIds.filter(id => count[id] >= 2).length;
    return {
      days, orders: done.length, revenue, avg: done.length ? revenue / done.length : 0, saved: Math.round(revenue * s.commissionPct / 100), commissionPct: s.commissionPct,
      rejected: os.filter(o => o.status === 'rejected').length, total: os.length, customers: custIds.length, returning,
      returningPct: custIds.length ? returning / custIds.length * 100 : 0, newCustomers: S.customers.filter(c => c.restaurant_id === r.id && c.created_at >= from).length,
      rewards: Math.round(done.reduce((a, o) => a + o.points_used, 0) / Math.max(1, s.loyalty.rewardPoints)), series, hours, types,
      topItems: Object.values(items).sort((a, b) => b.revenue - a.revenue).slice(0, 8),
    };
  }

  /* ---------- المسارات ---------- */
  const routes = [];
  function route(method, pattern, handler, auth = false) {
    const keys = [], re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    routes.push({ method, re, keys, handler, auth });
  }
  const session = () => +localStorage.getItem(SESSION) || null;
  const storeBySlug = slug => S.restaurants.find(r => r.slug === String(slug).toLowerCase()) || fail(404, 'المتجر غير موجود');
  const RESERVED = new Set(['admin', 'api', 'r', 'uploads', 'store', 'www', 'app', 'demo', 'icons']);

  route('GET', '/store/:slug', ({ params }) => {
    const r = storeBySlug(params.slug), s = settingsOf(r);
    return {
      restaurant: { slug: r.slug, name: r.name, phone: r.phone, tagline: s.tagline, color: s.color, logo: s.logo, cover: s.cover, whatsapp: s.whatsapp, address: s.address, open: isOpen(s), paused: s.paused, hours: s.hours, delivery: s.delivery, pickup: s.pickup, dineIn: s.dineIn, loyalty: s.loyalty, currency: s.currency },
      categories: S.categories.filter(c => c.restaurant_id === r.id).sort((a, b) => a.sort - b.sort || a.id - b.id).map(c => ({ id: c.id, name: c.name })),
      items: S.items.filter(i => i.restaurant_id === r.id).sort((a, b) => a.sort - b.sort || a.id - b.id).map(itemOut),
    };
  });
  route('GET', '/store/:slug/points', ({ params, query }) => {
    const r = storeBySlug(params.slug), phone = normPhone(query.get('phone'));
    if (!validPhone(phone)) return { points: 0, known: false };
    const c = S.customers.find(x => x.restaurant_id === r.id && x.phone === phone);
    return { points: c ? c.points : 0, known: !!c };
  });
  route('POST', '/store/:slug/coupon', ({ params, body }) => { const r = storeBySlug(params.slug); const { coupon, discount, label } = couponCheck(r.id, body.code, int(body.subtotal)); return { code: coupon.code, discount, label }; });
  route('POST', '/store/:slug/orders', ({ params, body }) => { const r = storeBySlug(params.slug), o = createOrder(r, body); notifyOrder(o); return { id: o.id, token: o.token, number: o.number }; });
  route('GET', '/orders/:id', ({ params, query }) => {
    const o = S.orders.find(x => x.id === int(params.id));
    if (!o || o.token !== query.get('token')) fail(404, 'الطلب غير موجود');
    const r = S.restaurants.find(x => x.id === o.restaurant_id), s = settingsOf(r);
    return { order: orderOut(o), restaurant: { name: r.name, slug: r.slug, phone: r.phone, whatsapp: s.whatsapp, color: s.color, currency: s.currency, loyalty: s.loyalty }, points: custById(o.customer_id)?.points || 0 };
  });

  route('POST', '/auth/signup', async ({ body }) => {
    const name = str(body.name, 60), slug = str(body.slug, 30).toLowerCase(), phone = normPhone(body.phone), pw = String(body.password || '');
    if (name.length < 2) fail(400, 'اكتب اسم المطعم');
    if (!/^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/.test(slug) || RESERVED.has(slug)) fail(400, 'رابط المتجر: أحرف إنجليزية صغيرة وأرقام وشرطة فقط (3–30 حرف)');
    if (!validPhone(phone)) fail(400, 'رقم الهاتف غير صحيح');
    if (pw.length < 8) fail(400, 'كلمة المرور 8 أحرف على الأقل');
    if (S.restaurants.some(r => r.slug === slug)) fail(409, 'رابط المتجر مستخدم، اختر غيره');
    if (S.restaurants.some(r => r.phone === phone)) fail(409, 'هذا الرقم مسجّل مسبقاً — سجّل الدخول');
    const id = nextId(S.restaurants);
    S.restaurants.push({ id, slug, name, phone, owner_name: str(body.owner, 60), passHash: await sha256(pw), settings: { whatsapp: phone, delivery: { areas: [{ name: 'المنطقة القريبة', fee: 2000 }] } }, created_at: Date.now() });
    ['الأطباق الرئيسية', 'المشروبات'].forEach((c, i) => S.categories.push({ id: nextId(S.categories), restaurant_id: id, name: c, sort: i }));
    localStorage.setItem(SESSION, id);
    return { ok: true };
  });
  route('POST', '/auth/login', async ({ body }) => {
    const r = S.restaurants.find(x => x.phone === normPhone(body.phone)), pw = String(body.password || '');
    const ok = r && (r.demo ? pw === DEMO_PASSWORD : r.passHash === await sha256(pw));
    if (!ok) fail(401, 'رقم الهاتف أو كلمة المرور غير صحيحة');
    localStorage.setItem(SESSION, r.id);
    return { ok: true };
  });
  route('POST', '/auth/logout', () => { localStorage.removeItem(SESSION); return { ok: true }; });

  const meOut = r => ({ id: r.id, slug: r.slug, name: r.name, phone: r.phone, owner: r.owner_name, settings: settingsOf(r), open: isOpen(settingsOf(r)) });
  route('GET', '/admin/me', ({ rest }) => meOut(rest), true);
  route('PUT', '/admin/settings', ({ rest, body }) => {
    const cur = settingsOf(rest), b = body.settings || {}, time = v => (/^\d{1,2}:\d{2}$/.test(v) ? v : null);
    rest.settings = {
      tagline: str(b.tagline ?? cur.tagline, 120), color: /^#[0-9a-f]{6}$/i.test(b.color) ? b.color : cur.color,
      logo: b.logo ?? cur.logo, cover: b.cover ?? cur.cover, whatsapp: b.whatsapp !== undefined ? normPhone(b.whatsapp) : cur.whatsapp,
      address: str(b.address ?? cur.address, 200), paused: b.paused !== undefined ? !!b.paused : cur.paused,
      hours: { open: time(b.hours?.open) || cur.hours.open, close: time(b.hours?.close) || cur.hours.close },
      delivery: b.delivery ? { enabled: !!b.delivery.enabled, minOrder: int(b.delivery.minOrder, 0, 1e7), eta: int(b.delivery.eta, 5, 240), areas: (b.delivery.areas || []).map(a => ({ name: str(a.name, 40), fee: int(a.fee, 0, 1e6) })).filter(a => a.name) } : cur.delivery,
      pickup: b.pickup ? { enabled: !!b.pickup.enabled, eta: int(b.pickup.eta, 5, 240) } : cur.pickup,
      dineIn: b.dineIn ? { enabled: !!b.dineIn.enabled } : cur.dineIn,
      loyalty: b.loyalty ? { enabled: !!b.loyalty.enabled, per: int(b.loyalty.per, 100, 1e6), rewardPoints: int(b.loyalty.rewardPoints, 1, 1e5), rewardValue: int(b.loyalty.rewardValue, 0, 1e7) } : cur.loyalty,
      commissionPct: b.commissionPct !== undefined ? int(b.commissionPct, 0, 60) : cur.commissionPct, currency: str(b.currency ?? cur.currency, 10) || 'د.ع',
    };
    rest.name = str(body.name ?? rest.name, 60) || rest.name;
    rest.owner_name = str(body.owner ?? rest.owner_name, 60);
    return meOut(rest);
  }, true);
  route('POST', '/admin/password', async ({ rest, body }) => {
    const ok = rest.demo ? body.current === DEMO_PASSWORD : rest.passHash === await sha256(String(body.current || ''));
    if (!ok) fail(400, 'كلمة المرور الحالية غير صحيحة');
    if (String(body.next || '').length < 8) fail(400, 'كلمة المرور الجديدة 8 أحرف على الأقل');
    rest.passHash = await sha256(String(body.next)); delete rest.demo;
    return { ok: true };
  }, true);
  route('GET', '/admin/orders', ({ rest, query }) => {
    const mine = S.orders.filter(o => o.restaurant_id === rest.id);
    const rows = query.get('scope') === 'history' ? mine.sort((a, b) => b.created_at - a.created_at).slice(0, 200)
      : mine.filter(o => ['pending', 'preparing', 'ready', 'on_way'].includes(o.status) || o.created_at >= dayStart(Date.now())).sort((a, b) => a.created_at - b.created_at);
    return rows.map(o => orderOut(o, true));
  }, true);
  route('PATCH', '/admin/orders/:id', ({ rest, params, body }) => updateOrder(rest, params.id, body), true);
  route('GET', '/admin/menu', ({ rest }) => ({
    categories: S.categories.filter(c => c.restaurant_id === rest.id).sort((a, b) => a.sort - b.sort || a.id - b.id).map(c => ({ id: c.id, name: c.name, sort: c.sort })),
    items: S.items.filter(i => i.restaurant_id === rest.id).sort((a, b) => a.sort - b.sort || a.id - b.id).map(itemOut),
  }), true);
  route('POST', '/admin/categories', ({ rest, body }) => {
    const name = str(body.name, 40) || fail(400, 'اكتب اسم القسم'), mine = S.categories.filter(c => c.restaurant_id === rest.id);
    const c = { id: nextId(S.categories), restaurant_id: rest.id, name, sort: mine.reduce((m, x) => Math.max(m, x.sort), -1) + 1 };
    S.categories.push(c); return { id: c.id };
  }, true);
  route('PUT', '/admin/categories/order', ({ rest, body }) => { (body.ids || []).forEach((id, i) => { const c = S.categories.find(x => x.id === int(id) && x.restaurant_id === rest.id); if (c) c.sort = i; }); return { ok: true }; }, true);
  route('PUT', '/admin/categories/:id', ({ rest, params, body }) => { const c = S.categories.find(x => x.id === int(params.id) && x.restaurant_id === rest.id); if (c) c.name = str(body.name, 40) || fail(400, 'اكتب اسم القسم'); return { ok: true }; }, true);
  route('DELETE', '/admin/categories/:id', ({ rest, params }) => {
    if (S.items.some(i => i.category_id === int(params.id) && i.restaurant_id === rest.id)) fail(409, 'انقل أو احذف أصناف هذا القسم أولاً');
    S.categories = S.categories.filter(c => !(c.id === int(params.id) && c.restaurant_id === rest.id)); return { ok: true };
  }, true);
  const cleanOptions = opts => (Array.isArray(opts) ? opts : []).slice(0, 10).map((g, gi) => ({
    id: str(g.id, 20) || 'g' + gi + token(2), name: str(g.name, 40), required: !!g.required, multi: !!g.multi,
    choices: (g.choices || []).slice(0, 20).map((c, ci) => ({ id: str(c.id, 20) || 'c' + ci + token(2), name: str(c.name, 40), price: int(c.price, 0, 1e7) })).filter(c => c.name),
  })).filter(g => g.name && g.choices.length);
  function itemFields(rest, b) {
    const name = str(b.name, 60); if (!name) fail(400, 'اكتب اسم الصنف');
    const cat = S.categories.find(c => c.id === int(b.category_id) && c.restaurant_id === rest.id);
    return { category_id: cat ? cat.id : null, name, description: str(b.description, 300), price: int(b.price, 0, 1e8), emoji: str(b.emoji, 8), image: String(b.image || ''), available: b.available === false ? 0 : 1, popular: b.popular ? 1 : 0, options: cleanOptions(b.options) };
  }
  route('POST', '/admin/items', ({ rest, body }) => {
    const it = { id: nextId(S.items), restaurant_id: rest.id, sort: S.items.filter(i => i.restaurant_id === rest.id).reduce((m, x) => Math.max(m, x.sort), -1) + 1, ...itemFields(rest, body) };
    S.items.push(it); return itemOut(it);
  }, true);
  const myItem = (rest, id) => S.items.find(i => i.id === int(id) && i.restaurant_id === rest.id) || fail(404, 'الصنف غير موجود');
  route('PUT', '/admin/items/:id', ({ rest, params, body }) => { const it = myItem(rest, params.id); Object.assign(it, itemFields(rest, body)); return itemOut(it); }, true);
  route('PATCH', '/admin/items/:id', ({ rest, params, body }) => {
    const it = myItem(rest, params.id);
    if (body.available !== undefined) it.available = body.available ? 1 : 0;
    if (body.popular !== undefined) it.popular = body.popular ? 1 : 0;
    return { ok: true };
  }, true);
  route('DELETE', '/admin/items/:id', ({ rest, params }) => { S.items = S.items.filter(i => !(i.id === int(params.id) && i.restaurant_id === rest.id)); return { ok: true }; }, true);
  route('POST', '/admin/upload', ({ body }) => {
    const data = String(body.data || '');
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(data)) fail(400, 'صيغة الصورة غير مدعومة');
    if (data.length > 2e6) fail(413, 'حجم الصورة كبير');
    return { url: data }; // بوضع العرض تنحفظ الصورة داخل البيانات نفسها
  }, true);
  route('GET', '/admin/customers', ({ rest }) => {
    const agg = {};
    S.orders.forEach(o => { if (o.restaurant_id !== rest.id || o.status !== 'completed') return; const a = agg[o.customer_id] = agg[o.customer_id] || { orders: 0, spent: 0, last_at: null }; a.orders++; a.spent += o.total; a.last_at = Math.max(a.last_at || 0, o.created_at); });
    return S.customers.filter(c => c.restaurant_id === rest.id).map(c => ({ id: c.id, phone: c.phone, name: c.name, area: c.area, points: c.points, created_at: c.created_at, ...(agg[c.id] || { orders: 0, spent: 0, last_at: null }) }))
      .sort((a, b) => (b.last_at || 0) - (a.last_at || 0));
  }, true);
  route('GET', '/admin/coupons', ({ rest }) => clone(S.coupons.filter(c => c.restaurant_id === rest.id).sort((a, b) => b.id - a.id)), true);
  function couponFields(rest, b, id) {
    const code = str(b.code, 20).toUpperCase().replace(/\s+/g, '');
    if (!/^[A-Z0-9_-]{3,20}$/.test(code)) fail(400, 'الكود: أحرف إنجليزية وأرقام (3–20)');
    if (S.coupons.some(c => c.restaurant_id === rest.id && c.code.toUpperCase() === code && c.id !== id)) fail(409, 'هذا الكود موجود مسبقاً');
    const kind = b.kind === 'fixed' ? 'fixed' : 'pct';
    return { code, kind, value: kind === 'pct' ? int(b.value, 1, 100) : int(b.value, 250, 1e7), min_order: int(b.min_order, 0, 1e8), max_uses: int(b.max_uses, 0, 1e6), expires_at: b.expires_at ? int(b.expires_at) : null, active: b.active === false ? 0 : 1 };
  }
  route('POST', '/admin/coupons', ({ rest, body }) => { S.coupons.push({ id: nextId(S.coupons), restaurant_id: rest.id, used: 0, ...couponFields(rest, body, 0) }); return { ok: true }; }, true);
  route('PUT', '/admin/coupons/:id', ({ rest, params, body }) => { const c = S.coupons.find(x => x.id === int(params.id) && x.restaurant_id === rest.id); if (c) Object.assign(c, couponFields(rest, body, c.id)); return { ok: true }; }, true);
  route('DELETE', '/admin/coupons/:id', ({ rest, params }) => { S.coupons = S.coupons.filter(c => !(c.id === int(params.id) && c.restaurant_id === rest.id)); return { ok: true }; }, true);
  route('GET', '/admin/stats', ({ rest, query }) => stats(rest, int(query.get('days') || 30, 1, 365)), true);

  /* ---------- اعتراض fetch ---------- */
  let queue = Promise.resolve();
  async function handle(method, url, body) {
    await sync();
    const p = url.pathname.slice(url.pathname.indexOf('/api/') + 4);
    for (const r of routes) {
      if (r.method !== method) continue;
      const m = p.match(r.re); if (!m) continue;
      const ctx = { params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])), query: url.searchParams, body };
      if (r.auth) { ctx.rest = S.restaurants.find(x => x.id === session()); if (!ctx.rest) fail(401, 'انتهت الجلسة، سجّل الدخول'); }
      const out = await r.handler(ctx);
      if (method !== 'GET') { await persist(); flush(); }
      return out ?? { ok: true };
    }
    fail(404, 'غير موجود');
  }
  window.fetch = function (input, init = {}) {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (!url.pathname.includes('/api/')) return realFetch(input, init);
    const method = (init.method || 'GET').toUpperCase();
    let body = {};
    try { body = init.body ? JSON.parse(init.body) : {}; } catch { body = {}; }
    const job = queue.then(async () => {
      await new Promise(r => setTimeout(r, 60)); // إحساس طبيعي بالشبكة
      try {
        const out = await handle(method, url, body);
        return new Response(JSON.stringify(out), { status: 200, headers: { 'Content-Type': 'application/json' } });
      } catch (e) {
        if (!(e instanceof HttpError)) console.error(e);
        return new Response(JSON.stringify({ error: e.status ? e.message : 'خطأ غير متوقع' }), { status: e.status || 500, headers: { 'Content-Type': 'application/json' } });
      }
    });
    queue = job.catch(() => null);
    return job;
  };

  /* ---------- اعتراض EventSource ---------- */
  class FakeES extends EventTarget {
    constructor(url) {
      super();
      this.url = String(url); this.readyState = 0; this.onopen = null; this.onmessage = null; this.onerror = null;
      const p = new URL(this.url, location.href).pathname, m = p.match(/\/api\/orders\/(\d+)\/stream$/);
      this.key = p.endsWith('/api/admin/stream') ? `admin:${session()}` : m ? `order:${m[1]}` : null;
      if (this.key) { if (!listeners.has(this.key)) listeners.set(this.key, new Set()); listeners.get(this.key).add(this); }
      setTimeout(() => { if (this.readyState === 2) return; this.readyState = 1; const ev = new Event('open'); this.onopen?.(ev); this.dispatchEvent(ev); }, 30);
    }
    _fire(type, data) { if (this.readyState !== 1) return; this.dispatchEvent(new MessageEvent(type, { data: JSON.stringify(data) })); }
    close() { this.readyState = 2; listeners.get(this.key)?.delete(this); }
  }
  window.EventSource = function (url, opts) { return String(url).includes('/api/') ? new FakeES(url) : new RealES(url, opts); };

  /* ---------- محاكاة طلب جديد (للعرض على أصحاب المطاعم) ---------- */
  async function simulateOrder() {
    await sync();
    const r = S.restaurants.find(x => x.id === session()); if (!r) return;
    const s = settingsOf(r), items = S.items.filter(i => i.restaurant_id === r.id && i.available);
    if (!items.length) return alert('أضف أصناف للمنيو أولاً');
    const pick = a => a[Math.floor(Math.random() * a.length)];
    const lines = [...new Set(Array.from({ length: 1 + Math.floor(Math.random() * 3) }, () => pick(items)))].map(it => ({
      itemId: it.id, qty: Math.random() < 0.2 ? 2 : 1, choices: (it.options || []).filter(g => g.required || Math.random() < 0.3).map(g => pick(g.choices).id),
    }));
    const custs = S.customers.filter(c => c.restaurant_id === r.id);
    const c = custs.length && Math.random() < 0.75 ? pick(custs) : { name: pick(['زينب', 'حيدر', 'مريم', 'مصطفى', 'نور', 'علي']), phone: '07' + '785'[Math.floor(Math.random() * 3)] + String(Math.floor(Math.random() * 1e8)).padStart(8, '0') };
    const types = [s.delivery.enabled && s.delivery.areas.length && 'delivery', s.pickup.enabled && 'pickup', s.dineIn.enabled && 'dine'].filter(Boolean);
    const type = pick(types.length ? types : ['pickup']);
    try {
      const o = createOrder(r, {
        type, name: c.name, phone: c.phone, items: lines, table: String(1 + Math.floor(Math.random() * 12)),
        area: c.area && s.delivery.areas.some(a => a.name === c.area) ? c.area : s.delivery.areas[0]?.name, address: pick(['قرب الجامع', 'زقاق 12 دار 7', 'عمارة 3 شقة 5', 'مقابل الصيدلية']),
        note: Math.random() < 0.3 ? pick(['بدون بصل لطفاً', 'حار شوية', 'رجاءً بسرعة', 'زيادة صلصة']) : '',
      }, true);
      notifyOrder(o); await persist(); flush();
    } catch (e) { alert(e.message); }
  }

  /* ---------- شريط وضع العرض ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    const isAdmin = location.pathname.includes('/admin');
    const bar = document.createElement('div');
    bar.className = 'demo-ribbon';
    bar.innerHTML = `<span>🧪 نسخة عرض · البيانات على جهازك فقط</span>${isAdmin ? '<button type="button" data-demo="sim">🔔 محاكاة طلب جديد</button>' : ''}<button type="button" data-demo="reset">إعادة ضبط</button>`;
    document.body.prepend(bar);
    bar.addEventListener('click', e => {
      const b = e.target.closest('[data-demo]'); if (!b) return;
      if (b.dataset.demo === 'sim') { if (!session()) return alert('سجّل الدخول للوحة المطعم أولاً'); simulateOrder(); }
      if (b.dataset.demo === 'reset' && confirm('إرجاع كل البيانات التجريبية للبداية؟')) resetDemo();
    });
  });
})();
