'use strict';
/* سُفرة — لوحة المطعم */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n, d = 0) => (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: d });
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
const DAY = 864e5;
const timeOf = t => { const d = new Date(t); const h = d.getHours(); return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'ص' : 'م'}`; };
const dateOf = t => new Date(t).toLocaleDateString('ar-IQ-u-nu-latn', { day: 'numeric', month: 'short' });
const ago = t => { const m = Math.floor((Date.now() - t) / 60e3); return m < 1 ? 'الآن' : m < 60 ? `منذ ${m} د` : m < 1440 ? `منذ ${Math.floor(m / 60)} س` : `منذ ${Math.floor(m / 1440)} يوم`; };
const daysAgo = t => (t ? Math.floor((Date.now() - t) / DAY) : null);
const normPhone = v => { let p = String(v || '').replace(/[^\d+]/g, ''); if (p.startsWith('+964')) p = '0' + p.slice(4); else if (p.startsWith('964')) p = '0' + p.slice(3); return p; };
const waLink = (p, text = '') => `https://wa.me/964${normPhone(p).slice(1)}${text ? '?text=' + encodeURIComponent(text) : ''}`;

const I = {
  orders: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  menu: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  customers: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  coupons: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8Z"/><circle cx="7" cy="7" r="1.5"/>',
  marketing: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4h-4"/>',
  stats: '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/>',
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.6A8.4 8.4 0 1 1 21 11.5Z"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  ext: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2-6.2 3.2L7 14.2 2 9.3l6.9-1Z"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>', plus: '<path d="M12 5v14M5 12h14"/>', up: '<path d="m18 15-6-6-6 6"/>', down: '<path d="m6 9 6 6 6-6"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z"/>', trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>', image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  check: '<path d="M20 6 9 17l-5-5"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  menuBars: '<path d="M4 6h16M4 12h16M4 18h16"/>',
};
const icon = (k, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[k]}</svg>`;
const badge = (t, tone = '') => `<span class="badge ${tone}">${t}</span>`;

const NAV = [['orders', 'الطلبات'], ['menu', 'المنيو'], ['customers', 'الزبائن'], ['coupons', 'الكوبونات'], ['marketing', 'التسويق و QR'], ['stats', 'الإحصائيات'], ['settings', 'الإعدادات']];
const TYPE = { delivery: ['توصيل', 'info'], pickup: ['استلام', 'brand'], dine: ['طاولة', 'ok'] };
const STATUS = { pending: ['جديد', 'warn'], preparing: ['قيد التحضير', 'info'], ready: ['جاهز', 'ok'], on_way: ['بالطريق', 'ok'], completed: ['مكتمل', ''], rejected: ['مرفوض', 'bad'] };

let ME = null, ORDERS = [], MENU = null, view = 'orders', es = null;
const ui = { ordersTab: 'live', eta: {}, custSeg: 'all', custQ: '', statsDays: 30, tables: 12, sound: true };
try { ui.sound = localStorage.getItem('sufra:sound') !== '0'; } catch { /* */ }
const S = () => ME.settings;
const money = n => `${fmt(n)} <small>${esc(S().currency)}</small>`;
const moneyT = n => `${fmt(n)} ${S().currency}`;
const storeUrl = (t = '') => PWA.storeUrl(ME.slug, t);

async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    method: opts.method || 'GET', credentials: 'same-origin',
    headers: opts.body ? { 'Content-Type': 'application/json' } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith('/auth')) { authScreen(); throw new Error(data.error || 'سجّل الدخول'); }
  if (!res.ok) throw new Error(data.error || 'تعذّر الاتصال بالخادم');
  return data;
}
function toast(msg, tone = '') {
  const el = document.createElement('div');
  el.className = `toast ${tone}`; el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), 3000);
  setTimeout(() => el.remove(), 3400);
}
const run = async (fn, okMsg) => { try { const r = await fn(); if (okMsg) toast(okMsg, 'ok'); return r; } catch (e) { toast(e.message, 'bad'); return undefined; } };

/* ---------- الدخول والتسجيل ---------- */
function authScreen(mode = location.hash === '#signup' ? 'signup' : 'login') {
  stopStream();
  document.documentElement.style.removeProperty('--brand');
  $('#app').innerHTML = `
  <div class="auth">
    <section class="auth-side">
      <a href="../" class="brand light"><span class="logo-mark">س</span><b>سُفرة</b></a>
      <h1>قناة طلب مباشرة لمطعمك — <span>بدون عمولة</span></h1>
      <ul>
        <li>${icon('check')} منيو أونلاين وطلب من التلفون بدون تطبيق</li>
        <li>${icon('check')} الطلبات توصلك فوراً مع تنبيه صوتي</li>
        <li>${icon('check')} نقاط ولاء ترجّع زبونك يطلب منك مباشرة</li>
        <li>${icon('check')} بيانات زبائنك إلك — مو للتطبيقات</li>
      </ul>
    </section>
    <section class="auth-main">
      <div class="auth-box">
        <div class="seg">${[['login', 'تسجيل الدخول'], ['signup', 'حساب جديد']].map(([k, t]) => `<button class="${mode === k ? 'on' : ''}" data-act="auth-mode" data-v="${k}">${t}</button>`).join('')}</div>
        ${mode === 'login' ? `
        <form id="auth-form" class="form">
          <label class="field"><span>رقم الهاتف</span><input class="input ltr" name="phone" inputmode="tel" autocomplete="username" required placeholder="07XX XXX XXXX"></label>
          <label class="field"><span>كلمة المرور</span><input class="input" name="password" type="password" autocomplete="current-password" required></label>
          <button class="btn primary lg block" type="submit" data-act="login">دخول</button>
        </form>
        <div class="demo-box"><b>جرّب بحساب تجريبي</b><span>مطعم بيت بغداد أو قهوة الرصيف</span>
          <div class="demo-btns"><button class="btn soft sm" data-act="demo" data-v="1">مطعم بيت بغداد</button><button class="btn soft sm" data-act="demo" data-v="2">قهوة الرصيف</button></div></div>` : `
        <form id="auth-form" class="form">
          <label class="field"><span>اسم المطعم أو الكافيه</span><input class="input" name="name" required maxlength="60" placeholder="مثلاً: مطعم الأصيل"></label>
          <label class="field"><span>رابط المتجر</span><div class="slug-input"><span class="ltr">${esc(location.host)}/r/</span><input class="input ltr" name="slug" required pattern="[a-z0-9-]{3,30}" placeholder="al-aseel" autocapitalize="off"></div><small>أحرف إنجليزية صغيرة وأرقام وشرطة</small></label>
          <div class="row"><label class="field grow"><span>اسمك</span><input class="input" name="owner" maxlength="60"></label>
          <label class="field grow"><span>رقم الهاتف</span><input class="input ltr" name="phone" inputmode="tel" required placeholder="07XX XXX XXXX"></label></div>
          <label class="field"><span>كلمة المرور</span><input class="input" name="password" type="password" minlength="8" required autocomplete="new-password"><small>8 أحرف على الأقل</small></label>
          <button class="btn primary lg block" type="submit" data-act="signup">إنشاء المتجر مجاناً</button>
        </form>`}
      </div>
    </section>
  </div>`;
}
async function login(phone, password) {
  await api('/auth/login', { method: 'POST', body: { phone, password } });
  location.hash = ''; boot();
}

/* ---------- الهيكل ---------- */
function shell() {
  document.documentElement.style.setProperty('--brand', S().color);
  $('#app').innerHTML = `
  <div class="layout">
    <aside class="side" id="side">
      <a href="../" class="brand"><span class="logo-mark">س</span><b>سُفرة</b><small>طلب مباشر</small></a>
      <nav id="nav">${NAV.map(([k, t]) => `<a href="#${k}" data-v="${k}">${icon(k)}<span>${t}</span>${k === 'orders' ? '<em id="nb"></em>' : ''}</a>`).join('')}</nav>
      <div class="side-foot">
        <div class="me"><span class="avatar">${esc(ME.name.replace(/^(مطعم|كافيه|كافي|قهوة|مقهى)\s+/, '').replace(/^ال/, '').slice(0, 1))}</span><div><b>${esc(ME.name)}</b><small class="ltr">/r/${esc(ME.slug)}</small></div></div>
        <button class="btn ghost sm block" data-act="logout">${icon('logout')} خروج</button>
      </div>
    </aside>
    <div class="main-col">
      <header class="topbar">
        <button class="icon-btn mob-only" data-act="side-toggle" aria-label="القائمة">${icon('menuBars')}</button>
        <label class="live-toggle ${S().paused ? 'off' : ''}" id="live-toggle">
          <input type="checkbox" data-act="pause" ${S().paused ? '' : 'checked'}><span class="switch"></span>
          <span><b>${S().paused ? 'الاستقبال متوقف' : 'نستقبل الطلبات'}</b><small id="open-note">${openNote()}</small></span>
        </label>
        <span class="sp"></span>
        <button class="btn soft sm ${PWA.canInstall() ? '' : 'hidden'}" id="install-btn" data-act="install">📲 <span class="hide-sm">ثبّت التطبيق</span></button>
        <button class="icon-btn" data-act="sound" id="sound-btn" aria-label="التنبيه الصوتي" title="التنبيه الصوتي">${icon('bell')}</button>
        <a class="btn ghost sm" href="${storeUrl()}" target="_blank" rel="noopener">${icon('ext')} <span class="hide-sm">صفحة المتجر</span></a>
      </header>
      <div id="audio-banner" class="audio-banner hidden">${icon('bell')} اضغط بأي مكان لتفعيل التنبيه الصوتي للطلبات الجديدة</div>
      <main id="view"></main>
    </div>
    <nav class="bnav" aria-label="التنقل السريع">${[['orders', 'الطلبات'], ['menu', 'المنيو'], ['customers', 'الزبائن'], ['stats', 'الأرقام']].map(([k, t]) => `<a href="#${k}" data-v="${k}">${icon(k)}<span>${t}</span>${k === 'orders' ? '<em id="nb2"></em>' : ''}</a>`).join('')}
      <button data-act="side-toggle">${icon('menuBars')}<span>المزيد</span></button></nav>
  </div>`;
  updateSoundBtn();
  connectStream();
}
function openNote() {
  if (S().paused) return 'الزبائن يشوفون المنيو بس ما يكدرون يطلبون';
  if (S().hours.open === S().hours.close) return 'مفتوح 24 ساعة';
  return ME.open ? `من ${S().hours.open} إلى ${S().hours.close}` : `خارج أوقات العمل (${S().hours.open}–${S().hours.close})`;
}
function go() {
  const v = location.hash.slice(1) || 'orders';
  view = NAV.some(n => n[0] === v) ? v : 'orders';
  $$('#nav a, .bnav a').forEach(a => a.classList.toggle('on', a.dataset.v === view));
  $('#side')?.classList.remove('open');
  render();
  window.scrollTo(0, 0);
  keepAwake(view === 'orders');
}
/* إبقاء الشاشة شغّالة بصفحة الطلبات (للتابلت أو التلفون على الكاونتر) */
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && !wakeLock && 'wakeLock' in navigator && document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { wakeLock = null; }
}
document.addEventListener('visibilitychange', () => { if (ME) keepAwake(view === 'orders'); });
document.addEventListener('pwa:installable', () => $('#install-btn')?.classList.remove('hidden'));
document.addEventListener('pwa:installed', () => { $('#install-btn')?.classList.add('hidden'); toast('تم تثبيت التطبيق ✓', 'ok'); });
async function render() {
  const el = $('#view'); if (!el) return;
  try { el.innerHTML = await views[view](); } catch (e) { el.innerHTML = `<div class="card empty">${esc(e.message)}</div>`; }
  after[view]?.();
  updateBadge();
}
const views = {}, after = {};
const pageHead = (title, sub = '', actions = '') => `<header class="page-h"><div><h1>${title}</h1>${sub ? `<p class="muted">${sub}</p>` : ''}</div><div class="page-act">${actions}</div></header>`;
const kpi = (label, value, sub = '', tone = '') => `<div class="kpi ${tone}"><span class="kpi-l">${label}</span><b class="kpi-v num">${value}</b>${sub ? `<span class="kpi-s">${sub}</span>` : ''}</div>`;

/* ---------- التنبيهات الفورية ---------- */
let audioCtx = null;
function ensureAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch { /* */ }
}
function beep() {
  if (!ui.sound || !audioCtx) return;
  if (audioCtx.state !== 'running') { $('#audio-banner')?.classList.remove('hidden'); return; }
  [0, 0.22, 0.44].forEach((d, i) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = i === 2 ? 1175 : 880;
    o.connect(g); g.connect(audioCtx.destination);
    const t = audioCtx.currentTime + d;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.start(t); o.stop(t + 0.2);
  });
}
setInterval(() => { if (ORDERS.some(o => o.status === 'pending')) beep(); }, 4000);
function updateSoundBtn() { const b = $('#sound-btn'); if (b) b.classList.toggle('muted-btn', !ui.sound); }
let pollTimer = null, lastSig = '';
function stopStream() { if (es) { es.close(); es = null; } clearInterval(pollTimer); pollTimer = null; }
function notifyNew(o) {
  beep();
  toast(`طلب جديد #${o.number} — ${moneyT(o.total)}`, 'ok');
  if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
    try { new Notification(`طلب جديد #${o.number}`, { body: `${o.customer.name} · ${moneyT(o.total)}`, tag: 'order-' + o.id }); } catch { /* */ }
  }
}
function connectStream() {
  stopStream();
  if (ME.realtime === 'poll') { // الخطة المجانية: فحص كل 4 ثواني بدل الاتصال المفتوح
    lastSig = JSON.stringify(ORDERS.map(o => [o.id, o.status, o.eta]));
    pollTimer = setInterval(pollOrders, 4000);
    return;
  }
  es = new EventSource('/api/admin/stream');
  es.onopen = () => loadOrders();
  es.addEventListener('order', ev => {
    const o = JSON.parse(ev.data);
    const i = ORDERS.findIndex(x => x.id === o.id);
    const isNew = i < 0;
    if (isNew) ORDERS.push(o); else ORDERS[i] = o;
    if (isNew && o.status === 'pending') notifyNew(o);
    if (view === 'orders' && !$('#modal-root').innerHTML) renderOrdersBoard();
    updateBadge();
  });
}
let polling = false;
async function pollOrders() {
  if (polling) return;
  polling = true;
  try {
    const fresh = await api('/admin/orders?scope=active');
    const known = new Set(ORDERS.map(o => o.id));
    const sig = JSON.stringify(fresh.map(o => [o.id, o.status, o.eta]));
    ORDERS = fresh;
    fresh.filter(o => !known.has(o.id) && o.status === 'pending').forEach(notifyNew);
    if (sig !== lastSig) {
      lastSig = sig;
      if (view === 'orders' && !$('#modal-root').innerHTML) renderOrdersBoard();
      updateBadge();
    }
  } catch { /* انقطاع مؤقت — نحاول بالدورة الجاية */ } finally { polling = false; }
}
async function loadOrders() {
  ORDERS = await api('/admin/orders?scope=active').catch(() => ORDERS);
  if (view === 'orders' && $('#board')) renderOrdersBoard();
  updateBadge();
}
function updateBadge() {
  const n = ORDERS.filter(o => o.status === 'pending').length;
  ['#nb', '#nb2'].forEach(s => { const b = $(s); if (b) { b.textContent = n || ''; b.hidden = !n; } });
  if ('setAppBadge' in navigator) (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => { /* */ });
  document.title = n ? `(${n}) طلب جديد · ${ME?.name || 'سُفرة'}` : `لوحة المطعم · ${ME?.name || 'سُفرة'}`;
}

/* ---------- الطلبات ---------- */
views.orders = async () => {
  if (!MENU) MENU = await api('/admin/menu');
  const onboarding = !MENU.items.length;
  return pageHead('الطلبات', `${new Date().toLocaleDateString('ar-IQ-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' })}`,
    `<div class="seg">${[['live', 'الحالية'], ['done', 'مكتملة اليوم'], ['history', 'السجل']].map(([k, t]) => `<button class="${ui.ordersTab === k ? 'on' : ''}" data-act="otab" data-v="${k}">${t}</button>`).join('')}</div>`) + `
  ${onboarding ? onboardingCard() : ''}
  <div class="kpis" id="okpis">${ordersKpis()}</div>
  <div id="board"></div>`;
};
function ordersKpis() {
  const today = ORDERS.filter(o => o.created_at >= startToday());
  const done = today.filter(o => o.status === 'completed');
  return `${kpi('طلبات اليوم', fmt(today.filter(o => o.status !== 'rejected').length))}
    ${kpi('مبيعات اليوم المكتملة', money(sum(done, o => o.total)))}
    ${kpi('قيد التنفيذ', fmt(ORDERS.filter(o => ['pending', 'preparing', 'ready', 'on_way'].includes(o.status)).length))}
    ${kpi('عمولة وفّرتها اليوم', money(sum(done, o => o.total) * S().commissionPct / 100), `مقارنة بعمولة ${S().commissionPct}%`, 'ok')}`;
}
after.orders = () => renderOrdersBoard();
const startToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
function onboardingCard() {
  return `<section class="card onboard"><h2>أهلاً بك في سُفرة 👋 — ثلاث خطوات وتستقبل أول طلب</h2>
    <ol><li><a href="#menu"><b>أضف أصناف المنيو</b><span>الأسعار والصور والخيارات</span></a></li>
    <li><a href="#settings"><b>حدد مناطق التوصيل والأوقات</b><span>وأجور التوصيل لكل منطقة</span></a></li>
    <li><a href="#marketing"><b>شارك رابط متجرك</b><span>ببايو إنستغرام وعلى الطاولات بـ QR</span></a></li></ol></section>`;
}
async function renderOrdersBoard() {
  const el = $('#board'); if (!el) return;
  const k = $('#okpis'); if (k) k.innerHTML = ordersKpis();
  if (ui.ordersTab === 'history') {
    const rows = await api('/admin/orders?scope=history').catch(() => []);
    el.innerHTML = `<section class="card flush"><div class="table-wrap"><table class="tbl">
      <thead><tr><th>#</th><th>التاريخ</th><th>الزبون</th><th>النوع</th><th>الأصناف</th><th>المبلغ</th><th>الحالة</th></tr></thead>
      <tbody>${rows.map(o => `<tr class="click" data-act="order-view" data-id="${o.id}"><td>${o.number}</td><td>${dateOf(o.created_at)} ${timeOf(o.created_at)}</td><td>${esc(o.customer.name)}<small class="block muted ltr">${esc(o.customer.phone)}</small></td>
        <td>${badge(TYPE[o.type][0], TYPE[o.type][1])}</td><td class="wrap">${esc(o.lines.map(l => `${l.qty}× ${l.name}`).join('، '))}</td><td class="num">${fmt(o.total)}</td><td>${badge(...STATUS[o.status])}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">لا توجد طلبات بعد</td></tr>'}</tbody></table></div></section>`;
    return;
  }
  if (ui.ordersTab === 'done') {
    const list = ORDERS.filter(o => ['completed', 'rejected'].includes(o.status) && o.created_at >= startToday()).sort((a, b) => b.created_at - a.created_at);
    el.innerHTML = list.length ? `<div class="done-grid">${list.map(o => `<button class="done-card" data-act="order-view" data-id="${o.id}"><b>#${o.number}</b><span>${esc(o.customer.name)}</span><span class="num">${fmt(o.total)}</span>${badge(...STATUS[o.status])}<small class="muted">${timeOf(o.created_at)}</small></button>`).join('')}</div>` : '<div class="card empty">لا توجد طلبات مكتملة اليوم بعد</div>';
    return;
  }
  const col = (title, sts, emptyMsg) => {
    const list = ORDERS.filter(o => sts.includes(o.status)).sort((a, b) => a.created_at - b.created_at);
    return `<section class="col col-${sts[0]}"><h2>${title} <span class="pill">${list.length}</span></h2><div class="col-body">${list.map(orderCard).join('') || `<p class="col-empty">${emptyMsg}</p>`}</div></section>`;
  };
  el.innerHTML = `<div class="board">
    ${col('جديدة', ['pending'], 'بانتظار الطلبات… <a href="#marketing">شارك رابط متجرك</a>')}
    ${col('قيد التحضير', ['preparing'], 'لا يوجد')}
    ${col('جاهزة / بالطريق', ['ready', 'on_way'], 'لا يوجد')}
  </div>`;
}
function defaultEta(o) { return o.type === 'delivery' ? S().delivery.eta : S().pickup.eta; }
function orderCard(o) {
  const c = o.customer, t = TYPE[o.type];
  const lines = o.lines.map(l => `<li><b>${l.qty}×</b><div>${esc(l.name)}${l.choices.length ? `<small>${esc(l.choices.join('، '))}</small>` : ''}${l.note ? `<small class="lnote">📝 ${esc(l.note)}</small>` : ''}</div></li>`).join('');
  let actions = '';
  if (o.status === 'pending') {
    const sel = ui.eta[o.id] || defaultEta(o);
    const opts = [...new Set([10, 20, 30, 45, 60, defaultEta(o)])].sort((a, b) => a - b);
    actions = `<div class="eta-pick"><span>${icon('clock')} يجهز خلال</span>${opts.map(m => `<button class="${sel === m ? 'on' : ''}" data-act="eta" data-id="${o.id}" data-m="${m}">${m}د</button>`).join('')}</div>
      <div class="oc-btns"><button class="btn ghost danger" data-act="reject" data-id="${o.id}">رفض</button><button class="btn primary grow" data-act="accept" data-id="${o.id}">قبول الطلب</button></div>`;
  } else if (o.status === 'preparing') {
    const elapsed = (Date.now() - o.accepted_at) / 60e3, left = Math.round(o.eta - elapsed);
    const label = o.type === 'delivery' ? 'خرج للتوصيل 🛵' : o.type === 'dine' ? 'جاهز للتقديم' : 'جاهز للاستلام';
    actions = `<div class="prog ${left < 0 ? 'late' : ''}"><i style="width:${Math.min(100, elapsed / o.eta * 100).toFixed(0)}%"></i></div>
      <div class="prog-l"><span>${left >= 0 ? `متبقي ${left} د من ${o.eta}` : `متأخر ${-left} د`}</span><span>الموعد ${timeOf(o.accepted_at + o.eta * 60e3)}</span></div>
      <div class="oc-btns"><button class="icon-btn" data-act="print" data-id="${o.id}" aria-label="طباعة">${icon('print')}</button><button class="btn ok grow" data-act="next" data-id="${o.id}">${label}</button></div>`;
  } else {
    actions = `<div class="oc-btns"><button class="icon-btn" data-act="print" data-id="${o.id}" aria-label="طباعة">${icon('print')}</button><button class="btn primary grow" data-act="next" data-id="${o.id}">${o.type === 'delivery' ? 'تم التوصيل ✓' : 'تم التسليم ✓'}</button></div>`;
  }
  return `<article class="oc st-${o.status}">
    <header><div class="oc-h"><b>#${o.number}</b>${badge(t[0] + (o.type === 'dine' ? ' ' + esc(o.table) : ''), t[1])}${o.status === 'on_way' ? badge('بالطريق', 'ok') : o.status === 'ready' ? badge('جاهز', 'ok') : ''}</div><span class="oc-time">${ago(o.created_at)}</span></header>
    <div class="oc-cust">
      <div><b>${esc(c.name)}</b> ${c.previous ? badge(`الطلب رقم ${c.previous + 1}`, 'ok') : badge('زبون جديد ✨', 'warn')}</div>
      <div class="oc-contact"><a class="icon-btn sm" href="tel:${esc(c.phone)}" aria-label="اتصال">${icon('phone')}</a><a class="icon-btn sm" href="${waLink(c.phone)}" target="_blank" rel="noopener" aria-label="واتساب">${icon('chat')}</a></div>
    </div>
    ${o.type === 'delivery' ? `<div class="oc-addr">${icon('pin')}<span><b>${esc(o.address.area)}</b> — ${esc(o.address.details)}</span>${o.address.lat ? `<a href="https://maps.google.com/?q=${o.address.lat},${o.address.lng}" target="_blank" rel="noopener">الخريطة</a>` : ''}</div>` : ''}
    <ul class="oc-lines">${lines}</ul>
    ${o.note ? `<p class="oc-note">📝 ${esc(o.note)}</p>` : ''}
    <div class="oc-total"><span>${o.coupon ? badge(esc(o.coupon), 'brand') : ''}${o.points_used ? badge('استخدم نقاط', 'brand') : ''}${o.delivery_fee ? `<small class="muted">+ توصيل ${fmt(o.delivery_fee)}</small>` : ''}</span><b class="num">${money(o.total)}</b></div>
    ${actions}
  </article>`;
}
function orderModal(o) {
  openModal(`طلب #${o.number}`, `<div class="om">
    <div class="om-row">${badge(...STATUS[o.status])} ${badge(TYPE[o.type][0], TYPE[o.type][1])} <span class="muted">${dateOf(o.created_at)} · ${timeOf(o.created_at)}</span></div>
    <p><b>${esc(o.customer.name)}</b> · <a class="ltr" href="tel:${esc(o.customer.phone)}">${esc(o.customer.phone)}</a></p>
    ${o.address?.area ? `<p class="muted">${esc(o.address.area)} — ${esc(o.address.details)}</p>` : ''}
    <ul class="oc-lines">${o.lines.map(l => `<li><b>${l.qty}×</b><div>${esc(l.name)}${l.choices.length ? `<small>${esc(l.choices.join('، '))}</small>` : ''}</div><span class="num">${fmt(l.unit * l.qty)}</span></li>`).join('')}</ul>
    <div class="om-sum"><span>المجموع</span><b class="num">${fmt(o.subtotal)}</b></div>
    ${o.delivery_fee ? `<div class="om-sum"><span>التوصيل</span><b class="num">${fmt(o.delivery_fee)}</b></div>` : ''}
    ${o.discount ? `<div class="om-sum"><span>الخصم ${o.coupon ? `(${esc(o.coupon)})` : ''}${o.points_used ? ' + نقاط' : ''}</span><b class="num" dir="ltr">−${fmt(o.discount)}</b></div>` : ''}
    <div class="om-sum g"><span>الإجمالي</span><b class="num">${money(o.total)}</b></div>
    ${o.reject_reason ? `<p class="warn-line">سبب الرفض: ${esc(o.reject_reason)}</p>` : ''}
  </div>`, `<button class="btn ghost" data-act="print" data-id="${o.id}">${icon('print')} طباعة</button><button class="btn primary" data-act="modal-close">إغلاق</button>`);
}
function printOrder(o) {
  $('#print-area').innerHTML = `<div class="ticket-print"><h2>${esc(ME.name)}</h2><p class="big">#${o.number} · ${TYPE[o.type][0]}${o.type === 'dine' ? ' ' + esc(o.table) : ''}</p>
    <p>${dateOf(o.created_at)} ${timeOf(o.created_at)}</p><p>${esc(o.customer.name)} · ${esc(o.customer.phone)}</p>
    ${o.address?.area ? `<p>${esc(o.address.area)} — ${esc(o.address.details)}</p>` : ''}
    <table>${o.lines.map(l => `<tr><td><b>${l.qty}×</b> ${esc(l.name)}${l.choices.length ? `<br><small>${esc(l.choices.join('، '))}</small>` : ''}${l.note ? `<br><small>* ${esc(l.note)}</small>` : ''}</td><td>${fmt(l.unit * l.qty)}</td></tr>`).join('')}</table>
    ${o.note ? `<p>ملاحظة: ${esc(o.note)}</p>` : ''}
    <table class="t"><tr><td>المجموع</td><td>${fmt(o.subtotal)}</td></tr>${o.delivery_fee ? `<tr><td>التوصيل</td><td>${fmt(o.delivery_fee)}</td></tr>` : ''}${o.discount ? `<tr><td>الخصم</td><td>-${fmt(o.discount)}</td></tr>` : ''}
    <tr class="g"><td>الإجمالي</td><td>${moneyT(o.total)}</td></tr></table><p>الدفع نقداً عند الاستلام</p></div>`;
  window.print();
}
setInterval(() => { if (view === 'orders' && ui.ordersTab === 'live' && !$('#modal-root').innerHTML) renderOrdersBoard(); }, 30000);

/* ---------- المنيو ---------- */
views.menu = async () => {
  MENU = await api('/admin/menu');
  const { categories: cats, items } = MENU;
  const loose = items.filter(i => !cats.some(c => c.id === i.category_id));
  return pageHead('المنيو', `${items.length} صنف في ${cats.length} قسم · التغييرات تظهر للزبائن فوراً`,
    `<button class="btn ghost" data-act="cat-new">${icon('plus')} قسم</button><button class="btn primary" data-act="item-new">${icon('plus')} صنف جديد</button>`) +
    cats.map((c, ci) => `<section class="card flush mcat">
      <div class="mcat-h"><h2>${esc(c.name)} <span class="pill">${items.filter(i => i.category_id === c.id).length}</span></h2>
        <div class="row-acts"><button class="icon-btn sm" data-act="cat-move" data-id="${c.id}" data-d="-1" ${ci === 0 ? 'disabled' : ''} aria-label="لفوق">${icon('up')}</button><button class="icon-btn sm" data-act="cat-move" data-id="${c.id}" data-d="1" ${ci === cats.length - 1 ? 'disabled' : ''} aria-label="لجوة">${icon('down')}</button>
        <button class="icon-btn sm" data-act="cat-edit" data-id="${c.id}" aria-label="تعديل">${icon('edit')}</button><button class="icon-btn sm" data-act="cat-del" data-id="${c.id}" aria-label="حذف">${icon('trash')}</button></div></div>
      ${items.filter(i => i.category_id === c.id).map(itemRow).join('') || `<p class="col-empty">لا توجد أصناف — <button class="link-btn" data-act="item-new" data-cat="${c.id}">أضف صنف</button></p>`}
    </section>`).join('') + (loose.length ? `<section class="card flush mcat"><div class="mcat-h"><h2>بدون قسم</h2></div>${loose.map(itemRow).join('')}</section>` : '') +
    (!cats.length ? `<div class="card empty">ابدأ بإضافة قسم مثل "المشويات" أو "المشروبات"</div>` : '');
};
function itemRow(it) {
  return `<div class="mitem ${it.available ? '' : 'off'}">
    ${it.image ? `<img class="mthumb" src="${esc(it.image)}" alt="" loading="lazy">` : `<span class="mthumb emo">${esc(it.emoji || '🍽️')}</span>`}
    <div class="mi-body"><b>${esc(it.name)} ${it.popular ? `<span class="star-on">${icon('star')}</span>` : ''}</b><small class="muted">${esc(it.description || '')}</small>
      <span class="mi-meta"><b class="num">${money(it.price)}</b>${it.options.length ? badge(`${it.options.length} خيارات`) : ''}${it.available ? '' : badge('نفد', 'bad')}</span></div>
    <label class="mini-switch" title="متوفر"><input type="checkbox" data-act="avail" data-id="${it.id}" ${it.available ? 'checked' : ''}><span class="switch"></span><span class="hide-sm">${it.available ? 'متوفر' : 'نفد'}</span></label>
    <button class="icon-btn sm" data-act="item-edit" data-id="${it.id}" aria-label="تعديل">${icon('edit')}</button>
  </div>`;
}
let draft = null;
function itemModal(it, catId) {
  draft = it ? JSON.parse(JSON.stringify(it)) : { id: null, name: '', description: '', price: '', emoji: '🍽️', image: '', category_id: catId || MENU.categories[0]?.id || null, available: true, popular: false, options: [] };
  openModal(it ? 'تعديل صنف' : 'صنف جديد', `<form id="mform" class="form">
    <div class="img-pick">
      <div class="img-prev" id="img-prev">${draft.image ? `<img src="${esc(draft.image)}" alt="">` : `<span>${esc(draft.emoji)}</span>`}</div>
      <div class="img-acts"><label class="btn ghost sm">${icon('image')} ${draft.image ? 'تغيير الصورة' : 'رفع صورة'}<input type="file" accept="image/*" hidden data-upload="item"></label>
        ${draft.image ? '<button type="button" class="btn ghost sm danger" data-act="img-clear">إزالة الصورة</button>' : ''}
        <label class="field emo-f"><span>أو إيموجي</span><input class="input" data-d="emoji" value="${esc(draft.emoji)}" maxlength="4"></label></div>
    </div>
    <label class="field"><span>اسم الصنف</span><input class="input" data-d="name" value="${esc(draft.name)}" required maxlength="60"></label>
    <label class="field"><span>الوصف <small>(يساعد الزبون يقرر)</small></span><textarea class="input" data-d="description" rows="2" maxlength="300">${esc(draft.description)}</textarea></label>
    <div class="row"><label class="field grow"><span>السعر (${esc(S().currency)})</span><input class="input" type="number" min="0" step="250" data-d="price" value="${draft.price}" required></label>
      <label class="field grow"><span>القسم</span><select class="input" data-d="category_id">${MENU.categories.map(c => `<option value="${c.id}" ${c.id === draft.category_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label></div>
    <div class="row checks"><label class="check"><input type="checkbox" data-d="available" ${draft.available ? 'checked' : ''}> متوفر</label><label class="check"><input type="checkbox" data-d="popular" ${draft.popular ? 'checked' : ''}> يظهر بـ "الأكثر طلباً"</label></div>
    <div class="opts-h"><h3>الخيارات والإضافات</h3><button type="button" class="btn soft sm" data-act="g-add">${icon('plus')} مجموعة خيارات</button></div>
    <p class="muted small">مثل: الحجم (مطلوب)، نوع الحليب، إضافات بسعر — كل خيار يضيف سعره على سعر الصنف.</p>
    <div id="groups">${groupsHtml()}</div>
  </form>`, `${it ? '<button class="btn ghost danger" data-act="item-del">حذف</button><span class="sp"></span>' : ''}<button class="btn ghost" data-act="modal-close">إلغاء</button><button class="btn primary" type="submit" form="mform" data-act="item-save">حفظ</button>`, true);
}
function groupsHtml() {
  return draft.options.map((g, gi) => `<div class="grp">
    <div class="grp-h"><input class="input" data-g="${gi}" data-gf="name" value="${esc(g.name)}" placeholder="اسم المجموعة (مثلاً: الحجم)">
      <label class="check sm"><input type="checkbox" data-g="${gi}" data-gf="required" ${g.required ? 'checked' : ''}> مطلوب</label>
      <label class="check sm"><input type="checkbox" data-g="${gi}" data-gf="multi" ${g.multi ? 'checked' : ''}> أكثر من خيار</label>
      <button type="button" class="icon-btn sm" data-act="g-del" data-g="${gi}" aria-label="حذف المجموعة">${icon('trash')}</button></div>
    ${g.choices.map((c, ci) => `<div class="ch-row"><input class="input" data-g="${gi}" data-c="${ci}" data-cf="name" value="${esc(c.name)}" placeholder="الخيار"><input class="input num-in" type="number" min="0" step="250" data-g="${gi}" data-c="${ci}" data-cf="price" value="${c.price || ''}" placeholder="+0"><button type="button" class="icon-btn sm" data-act="c-del" data-g="${gi}" data-c="${ci}" aria-label="حذف">${icon('x')}</button></div>`).join('')}
    <button type="button" class="link-btn" data-act="c-add" data-g="${gi}">+ خيار</button>
  </div>`).join('');
}
async function uploadImage(file) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  const max = 900, k = Math.min(1, max / Math.max(img.width, img.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  URL.revokeObjectURL(img.src);
  return (await api('/admin/upload', { method: 'POST', body: { data: cv.toDataURL('image/jpeg', 0.82) } })).url;
}

/* ---------- الزبائن ---------- */
let CUSTOMERS = [];
const SEG = {
  all: ['الكل', () => true],
  regular: ['زبائن دائمين', c => c.orders >= 3 && daysAgo(c.last_at) <= 30],
  lost: ['منقطعين +30 يوم', c => c.orders >= 1 && daysAgo(c.last_at) > 30],
  reward: ['عندهم مكافأة', c => c.points >= S().loyalty.rewardPoints],
  new: ['جدد هذا الشهر', c => daysAgo(c.created_at) <= 30],
};
views.customers = async () => {
  CUSTOMERS = await api('/admin/customers');
  const count = k => CUSTOMERS.filter(SEG[k][1]).length;
  return pageHead('الزبائن', 'زبائنك إلك — رجّعهم بحملة واتساب وكوبون',
    `<button class="btn primary" data-act="campaign">${icon('chat')} حملة واتساب</button>`) + `
  <div class="kpis">${kpi('كل الزبائن', fmt(CUSTOMERS.length))}${kpi('دائمين', fmt(count('regular')), '3 طلبات أو أكثر ونشطين', 'ok')}
    ${kpi('منقطعين', fmt(count('lost')), 'ما طلبوا من 30 يوم — رجّعهم', 'warn')}${kpi('عندهم مكافأة', fmt(count('reward')), 'نقاطهم تكفي لخصم')}</div>
  <section class="card flush">
    <div class="pad toolbar"><div class="chips">${Object.entries(SEG).map(([k, [t]]) => `<button class="chip ${ui.custSeg === k ? 'on' : ''}" data-act="seg" data-v="${k}">${t} <span>${count(k)}</span></button>`).join('')}</div>
      <label class="search-in">${icon('search')}<input type="search" placeholder="اسم أو رقم…" value="${esc(ui.custQ)}" data-in="cust-q"></label></div>
    <div class="table-wrap" id="cust-table">${custTable()}</div>
  </section>`;
};
function custList() {
  const q = ui.custQ.trim();
  return CUSTOMERS.filter(SEG[ui.custSeg][1]).filter(c => !q || c.name.includes(q) || c.phone.includes(q));
}
function custTable() {
  const list = custList();
  return `<table class="tbl"><thead><tr><th>الزبون</th><th>الطلبات</th><th>مجموع الإنفاق</th><th>آخر طلب</th><th>النقاط</th><th>المنطقة</th><th></th></tr></thead>
  <tbody>${list.slice(0, 300).map(c => {
    const d = daysAgo(c.last_at);
    return `<tr class="${c.blocked ? 'off' : ''}"><td><b>${esc(c.name)}</b> ${c.blocked ? badge('محظور', 'bad') : ''}<small class="block muted ltr">${esc(c.phone)}</small></td><td class="num">${fmt(c.orders)}</td><td class="num">${fmt(c.spent)}</td>
      <td>${c.last_at ? `<span class="${d > 30 ? 't-warn' : ''}">${d === 0 ? 'اليوم' : `منذ ${d} يوم`}</span>` : '—'}</td><td class="num">${fmt(c.points)}</td><td>${esc(c.area || '—')}</td>
      <td class="acts"><a class="btn ghost sm" href="${waLink(c.phone)}" target="_blank" rel="noopener">${icon('chat')} واتساب</a><button class="btn ghost sm ${c.blocked ? '' : 'danger'}" data-act="block" data-id="${c.id}">${c.blocked ? 'إلغاء الحظر' : 'حظر'}</button></td></tr>`;
  }).join('') || '<tr><td colspan="7" class="empty">لا يوجد زبائن بهذه الشريحة</td></tr>'}</tbody></table>`;
}
const TEMPLATES = {
  lost: 'هلا {الاسم} 🧡 اشتاقينالك بـ {المطعم}! استخدم كود {الكود} وخذ خصم على طلبك الجاي من رابطنا المباشر: {الرابط}',
  reward: 'هلا {الاسم} ⭐ عندك {النقاط} نقطة بـ {المطعم} — يعني خصم جاهز تستخدمه بطلبك الجاي: {الرابط}',
  regular: 'هلا {الاسم} 🙏 شكراً لأنك من زبائننا الدائمين بـ {المطعم}! هدية إلك: كود {الكود} على طلبك الجاي: {الرابط}',
  new: 'هلا {الاسم} 👋 شكراً لطلبك الأول من {المطعم}! اطلب مرة ثانية من رابطنا واجمع نقاط: {الرابط}',
  all: 'هلا {الاسم} 👋 عدنا عرض جديد بـ {المطعم}! اطلب مباشرة من رابطنا: {الرابط}',
};
async function campaignModal() {
  const coupons = await api('/admin/coupons').catch(() => []);
  const active = coupons.filter(c => c.active);
  const list = custList();
  if (!list.length) return toast('ما اكو زبائن بهذه الشريحة', 'bad');
  const fill = (tpl, c, code) => tpl.replaceAll('{الاسم}', c.name.split(' ')[0]).replaceAll('{المطعم}', ME.name).replaceAll('{الرابط}', storeUrl()).replaceAll('{الكود}', code || '').replaceAll('{النقاط}', fmt(c.points));
  const draw = () => {
    const tpl = $('#cmp-text').value, code = $('#cmp-coupon').value;
    $('#cmp-list').innerHTML = list.slice(0, 200).map((c, i) => `<div class="cmp-row" id="cmp-${i}"><div><b>${esc(c.name)}</b><small class="muted ltr block">${esc(c.phone)}</small></div>
      <a class="btn soft sm" href="${waLink(c.phone, fill(tpl, c, code))}" target="_blank" rel="noopener" data-act="cmp-sent" data-i="${i}">${icon('chat')} إرسال</a></div>`).join('');
    $('#cmp-preview').textContent = fill(tpl, list[0], code);
  };
  openModal(`حملة واتساب — ${SEG[ui.custSeg][0]} (${list.length})`, `<div class="form">
    <label class="field"><span>نص الرسالة</span><textarea class="input" id="cmp-text" rows="4">${esc(TEMPLATES[ui.custSeg])}</textarea><small>المتغيرات: {الاسم} {المطعم} {الرابط} {الكود} {النقاط}</small></label>
    <label class="field"><span>الكوبون المرفق</span><select class="input" id="cmp-coupon"><option value="">بدون كوبون</option>${active.map(c => `<option ${c.code === 'BACK5' ? 'selected' : ''}>${esc(c.code)}</option>`).join('')}</select></label>
    <div class="preview-bubble"><small>معاينة</small><p id="cmp-preview"></p></div>
    <p class="muted small">كل زر يفتح واتساب برسالة جاهزة لهذا الزبون. الإرسال الآلي الجماعي يحتاج حساب WhatsApp Business API (مرحلة لاحقة).</p>
    <div class="cmp-list" id="cmp-list"></div>
  </div>`, '<button class="btn primary" data-act="modal-close">تم</button>', true);
  $('#cmp-text').addEventListener('input', draw);
  $('#cmp-coupon').addEventListener('change', draw);
  draw();
}

/* ---------- الكوبونات ---------- */
views.coupons = async () => {
  const list = await api('/admin/coupons');
  return pageHead('الكوبونات', 'أكواد خصم للحملات والزبائن الجدد', `<button class="btn primary" data-act="coupon-new">${icon('plus')} كوبون جديد</button>`) + `
  <section class="card flush"><div class="table-wrap"><table class="tbl">
    <thead><tr><th>الكود</th><th>الخصم</th><th>الحد الأدنى</th><th>الاستخدام</th><th>ينتهي</th><th>الحالة</th><th></th></tr></thead>
    <tbody>${list.map(c => `<tr class="${c.active ? '' : 'off'}"><td><b class="ltr code">${esc(c.code)}</b></td><td>${c.kind === 'pct' ? `${c.value}%` : moneyT(c.value)}</td><td class="num">${c.min_order ? fmt(c.min_order) : '—'}</td>
      <td class="num">${fmt(c.used)}${c.max_uses ? ` / ${fmt(c.max_uses)}` : ''}</td><td>${c.expires_at ? (c.expires_at < Date.now() ? badge('منتهي', 'bad') : dateOf(c.expires_at)) : '—'}</td>
      <td>${c.active ? badge('فعّال', 'ok') : badge('متوقف')}</td>
      <td class="acts"><button class="btn ghost sm" data-act="coupon-edit" data-id="${c.id}">تعديل</button><button class="icon-btn sm" data-act="coupon-del" data-id="${c.id}" aria-label="حذف">${icon('trash')}</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty">لا توجد كوبونات</td></tr>'}</tbody></table></div></section>
  <script type="application/json" id="coupons-data">${JSON.stringify(list).replace(/</g, '\\u003c')}</script>`;
};
function couponModal(c) {
  const v = c || { code: '', kind: 'pct', value: 10, min_order: 0, max_uses: 0, expires_at: null, active: 1 };
  const exp = v.expires_at ? new Date(v.expires_at).toISOString().slice(0, 10) : '';
  openModal(c ? 'تعديل كوبون' : 'كوبون جديد', `<form id="mform" class="form">
    <label class="field"><span>الكود</span><input class="input ltr code" name="code" value="${esc(v.code)}" required maxlength="20" placeholder="SUMMER10" autocapitalize="characters"></label>
    <div class="row"><label class="field grow"><span>نوع الخصم</span><select class="input" name="kind"><option value="pct" ${v.kind === 'pct' ? 'selected' : ''}>نسبة %</option><option value="fixed" ${v.kind === 'fixed' ? 'selected' : ''}>مبلغ ثابت</option></select></label>
      <label class="field grow"><span>القيمة</span><input class="input" type="number" min="1" name="value" value="${v.value}" required></label></div>
    <div class="row"><label class="field grow"><span>الحد الأدنى للطلب</span><input class="input" type="number" min="0" step="250" name="min_order" value="${v.min_order || ''}" placeholder="0"></label>
      <label class="field grow"><span>أقصى عدد استخدامات</span><input class="input" type="number" min="0" name="max_uses" value="${v.max_uses || ''}" placeholder="بدون حد"></label></div>
    <label class="field"><span>تاريخ الانتهاء <small>(اختياري)</small></span><input class="input" type="date" name="expires" value="${exp}"></label>
    <label class="check"><input type="checkbox" name="active" ${v.active ? 'checked' : ''}> فعّال</label>
    <input type="hidden" name="id" value="${c ? c.id : ''}"></form>`,
  '<button class="btn ghost" data-act="modal-close">إلغاء</button><button class="btn primary" type="submit" form="mform" data-act="coupon-save">حفظ</button>');
}

/* ---------- التسويق ---------- */
views.marketing = async () => pageHead('التسويق و QR', 'أوصل رابطك لكل زبون — كل طلب يجي منه بدون عمولة') + `
  <div class="grid2">
    <section class="card"><h2>رابط متجرك</h2>
      <div class="link-box"><span class="ltr">${esc(storeUrl())}</span><button class="icon-btn sm" data-act="copy" data-v="${esc(storeUrl())}" aria-label="نسخ">${icon('copy')}</button></div>
      <div class="btn-row"><a class="btn ghost sm" href="${storeUrl()}" target="_blank" rel="noopener">${icon('ext')} فتح</a><a class="btn ghost sm" href="https://wa.me/?text=${encodeURIComponent(`اطلب من ${ME.name} مباشرة واجمع نقاط 🎁 ${storeUrl()}`)}" target="_blank" rel="noopener">${icon('chat')} مشاركة بالواتساب</a></div>
      <h3 class="mt">وين تحط الرابط؟</h3>
      <ul class="tips">
        <li><b>بايو إنستغرام وتيك توك</b><span>"اطلب مباشرة واجمع نقاط ⬇️" + الرابط</span></li>
        <li><b>ستيكر على أكياس التوصيل</b><span>زبون التطبيقات يصير زبونك المباشر بالطلب الجاي — اطبع البطاقة الجاهزة</span></li>
        <li><b>حالة الواتساب ورسالة الشكر</b><span>بعد كل طلب هاتفي ابعث الرابط</span></li>
        <li><b>QR على الطاولات</b><span>الزبون يطلب من مكانه بدون انتظار النادل</span></li>
      </ul>
    </section>
    <section class="card qr-card"><h2>رمز QR للمتجر</h2>
      <div class="qr" id="qr-main"><span class="spinner"></span></div>
      <div class="btn-row center"><button class="btn ghost sm" data-act="qr-png">تنزيل PNG</button><button class="btn primary sm" data-act="print-flyer">${icon('print')} طباعة بطاقة للأكياس</button></div>
    </section>
  </div>
  <section class="card"><div class="card-h"><h2>QR للطاولات</h2><div class="row-inline"><label class="field inline"><span>عدد الطاولات</span><input class="input xs" type="number" min="1" max="100" value="${ui.tables}" data-in="tables"></label><button class="btn primary sm" data-act="print-tables">${icon('print')} طباعة الكل</button></div></div>
    <p class="muted small">كل رمز يفتح المنيو ويحدد رقم الطاولة تلقائياً — الطلب يوصلك مكتوب عليه رقم الطاولة.</p>
    <div class="tables-grid" id="tables-grid"></div></section>`;
let qrLib = null;
function loadQr() {
  if (window.qrcode) return Promise.resolve(window.qrcode);
  if (qrLib) return qrLib;
  qrLib = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
    s.onload = () => res(window.qrcode); s.onerror = () => { qrLib = null; rej(new Error('تعذّر تحميل مولد QR — تأكد من الإنترنت')); };
    document.head.appendChild(s);
  });
  return qrLib;
}
function qrSvg(text, cell = 6) { const q = window.qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: cell, margin: 2, scalable: true }); }
after.marketing = async () => {
  try { await loadQr(); } catch (e) { $('#qr-main').innerHTML = `<p class="muted small">${esc(e.message)}</p>`; return; }
  $('#qr-main').innerHTML = qrSvg(storeUrl());
  drawTables();
};
function drawTables() {
  const g = $('#tables-grid'); if (!g || !window.qrcode) return;
  g.innerHTML = Array.from({ length: ui.tables }, (_, i) => `<div class="tqr"><div class="qr sm">${qrSvg(storeUrl(String(i + 1)), 4)}</div><b>طاولة ${i + 1}</b></div>`).join('');
}
function printSheet(html) { $('#print-area').innerHTML = html; window.print(); }

/* ---------- الإحصائيات ---------- */
views.stats = async () => {
  const st = await api(`/admin/stats?days=${ui.statsDays}`);
  const labelDay = t => { const d = new Date(t); return `${d.getDate()}/${d.getMonth() + 1}`; };
  const hrs = st.hours.map((v, h) => ({ h, v })).filter(x => x.v);
  const hData = hrs.length ? st.hours.slice(hrs[0].h, hrs[hrs.length - 1].h + 1).map((v, i) => ({ label: hourLabel(hrs[0].h + i), v })) : [];
  return pageHead('الإحصائيات', '', `<div class="seg">${[[7, '7 أيام'], [30, '30 يوم'], [90, '90 يوم']].map(([d, t]) => `<button class="${ui.statsDays === d ? 'on' : ''}" data-act="sdays" data-v="${d}">${t}</button>`).join('')}</div>`) + `
  <section class="card saved-hero">
    <div><span>العمولة اللي وفّرتها خلال ${st.days} يوم</span><b class="num">${money(st.saved)}</b>
    <p>لو هاي الطلبات (${fmt(st.orders)} طلب بقيمة ${moneyT(st.revenue)}) جت عن طريق تطبيقات التوصيل بعمولة ${st.commissionPct}%.</p></div>
    <div class="saved-side"><b class="num">${fmt(st.returningPct, 0)}%</b><span>من زبائنك رجعوا طلبوا مرة ثانية</span></div>
  </section>
  <div class="kpis six">
    ${kpi('الطلبات المكتملة', fmt(st.orders))}${kpi('الإيرادات', money(st.revenue))}${kpi('متوسط الطلب', money(st.avg))}
    ${kpi('زبائن جدد', fmt(st.newCustomers))}${kpi('مكافآت مستخدمة', fmt(st.rewards), 'خصومات النقاط')}${kpi('نسبة الرفض', fmt(st.total ? st.rejected / st.total * 100 : 0, 1) + '%', `${fmt(st.rejected)} طلب`, st.rejected / Math.max(1, st.total) > 0.08 ? 'warn' : '')}
  </div>
  <div class="grid2">
    <section class="card span2"><h2>الإيرادات اليومية</h2>${barChart(st.series.map((d, i) => ({ label: labelDay(d.day), v: d.revenue, hl: i === st.series.length - 1 })), { f: moneyT })}</section>
    <section class="card"><h2>أوقات الذروة</h2>${barChart(hData, { h: 180, f: v => `${fmt(v)} طلب` })}</section>
    <section class="card"><h2>أعلى الأصناف إيراداً</h2>${hbars(st.topItems.map(i => ({ label: i.name, v: i.revenue })))}</section>
    <section class="card"><h2>نوع الطلب</h2>${hbars([['delivery', 'توصيل'], ['pickup', 'استلام'], ['dine', 'من الطاولة']].map(([k, t]) => ({ label: t, v: st.types[k] || 0 })), v => fmt(v) + ' طلب')}</section>
    <section class="card"><h2>الزبائن</h2>${hbars([{ label: 'زبائن طلبوا', v: st.customers }, { label: 'رجعوا مرة ثانية', v: st.returning }, { label: 'جدد', v: st.newCustomers }])}</section>
  </div>`;
};
const hourLabel = h => `${h % 12 || 12}${h < 12 ? 'ص' : 'م'}`;
function barChart(data, opt = {}) {
  if (!data.length) return '<p class="empty">لا توجد بيانات بعد</p>';
  const W = 640, H = opt.h || 210, pt = 22, pb = 26, px = 6, f = opt.f || fmt;
  const max = Math.max(1, ...data.map(d => d.v)), bw = (W - px * 2) / data.length, step = Math.ceil(data.length / 12);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img"><line x1="${px}" x2="${W - px}" y1="${H - pb}" y2="${H - pb}" class="base"/><line x1="${px}" x2="${W - px}" y1="${pt}" y2="${pt}" class="grid"/>
    <text x="${px}" y="14" class="axis start">${esc(f(max))}</text>
    ${data.map((d, i) => { const h = d.v / max * (H - pt - pb), x = px + i * bw + bw * 0.18, w = bw * 0.64; return `<rect x="${x.toFixed(1)}" y="${(H - pb - h).toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(h, d.v ? 2 : 0).toFixed(1)}" rx="${Math.min(4, w / 3).toFixed(1)}" class="bar${d.hl ? ' hl' : ''}"><title>${esc(d.label)}: ${esc(f(d.v))}</title></rect>${i % step === 0 ? `<text x="${(x + w / 2).toFixed(1)}" y="${H - 8}" class="axis">${esc(d.label)}</text>` : ''}`; }).join('')}</svg>`;
}
function hbars(rows, f = fmt) {
  if (!rows.length) return '<p class="empty">لا توجد بيانات بعد</p>';
  const max = Math.max(1, ...rows.map(r => r.v));
  return `<div class="hbars">${rows.map(r => `<div class="hb"><span class="hb-l">${esc(r.label)}</span><span class="hb-t"><i style="width:${(r.v / max * 100).toFixed(1)}%"></i></span><b class="hb-v num">${f(r.v)}</b></div>`).join('')}</div>`;
}

/* ---------- الإعدادات ---------- */
let setDraft = null;
const PRESETS = ['#c2410c', '#d9480f', '#b91c1c', '#be185d', '#7c3aed', '#1d4ed8', '#0f766e', '#15803d', '#8a5a3c', '#1c1915'];
views.settings = async () => {
  setDraft = JSON.parse(JSON.stringify({ name: ME.name, owner: ME.owner, settings: S() }));
  const s = setDraft.settings;
  return pageHead('الإعدادات', 'كل تغيير يظهر بصفحة متجرك بعد الحفظ', '<button class="btn primary" data-act="settings-save">حفظ التغييرات</button>') + `
  <div class="grid2 settings">
    <section class="card"><h2>معلومات المتجر</h2>
      <label class="field"><span>اسم المطعم</span><input class="input" data-s="name" value="${esc(setDraft.name)}" maxlength="60"></label>
      <label class="field"><span>الوصف المختصر</span><input class="input" data-s="settings.tagline" value="${esc(s.tagline)}" maxlength="120" placeholder="مثلاً: أكلات بغدادية على الفحم"></label>
      <div class="row"><label class="field grow"><span>رقم الواتساب</span><input class="input ltr" data-s="settings.whatsapp" value="${esc(s.whatsapp)}" inputmode="tel"></label>
        <label class="field grow"><span>اسم المالك</span><input class="input" data-s="owner" value="${esc(setDraft.owner)}"></label></div>
      <label class="field"><span>العنوان</span><input class="input" data-s="settings.address" value="${esc(s.address)}" maxlength="200"></label>
    </section>
    <section class="card"><h2>الهوية</h2>
      <div class="field"><span>لون المتجر</span><div class="swatches">${PRESETS.map(c => `<button type="button" class="sw ${c === s.color ? 'on' : ''}" style="--c:${c}" data-act="color" data-v="${c}" aria-label="${c}"></button>`).join('')}<input type="color" value="${esc(s.color)}" data-s="settings.color" aria-label="لون مخصص"></div></div>
      <div class="row"><div class="field grow"><span>الشعار</span><div class="up-box" id="logo-box">${s.logo ? `<img src="${esc(s.logo)}" alt="">` : icon('image')}</div><label class="btn ghost sm">${s.logo ? 'تغيير' : 'رفع'}<input type="file" accept="image/*" hidden data-upload="logo"></label></div>
        <div class="field grow"><span>صورة الغلاف</span><div class="up-box wide" id="cover-box">${s.cover ? `<img src="${esc(s.cover)}" alt="">` : icon('image')}</div><label class="btn ghost sm">${s.cover ? 'تغيير' : 'رفع'}<input type="file" accept="image/*" hidden data-upload="cover"></label></div></div>
    </section>
    <section class="card"><h2>أوقات استقبال الطلبات</h2>
      <div class="row"><label class="field grow"><span>من</span><input class="input" type="time" data-s="settings.hours.open" value="${esc(s.hours.open)}"></label><label class="field grow"><span>إلى</span><input class="input" type="time" data-s="settings.hours.close" value="${esc(s.hours.close)}"></label></div>
      <p class="muted small">إذا وقت الإغلاق بعد منتصف الليل (مثلاً 02:00) النظام يفهمها تلقائياً. للإيقاف المؤقت استخدم الزر بأعلى الصفحة.</p>
      <h2 class="mt">أنواع الطلب</h2>
      <label class="check"><input type="checkbox" data-s="settings.pickup.enabled" ${s.pickup.enabled ? 'checked' : ''}> استلام من المحل — جاهز خلال <input class="input xs inl" type="number" min="5" data-s="settings.pickup.eta" value="${s.pickup.eta}"> د</label>
      <label class="check"><input type="checkbox" data-s="settings.dineIn.enabled" ${s.dineIn.enabled ? 'checked' : ''}> الطلب من الطاولة (QR)</label>
    </section>
    <section class="card"><h2>التوصيل</h2>
      <label class="check"><input type="checkbox" data-s="settings.delivery.enabled" ${s.delivery.enabled ? 'checked' : ''}> تفعيل التوصيل</label>
      <div class="row"><label class="field grow"><span>الحد الأدنى للطلب</span><input class="input" type="number" min="0" step="500" data-s="settings.delivery.minOrder" value="${s.delivery.minOrder}"></label><label class="field grow"><span>وقت التوصيل التقريبي (د)</span><input class="input" type="number" min="5" data-s="settings.delivery.eta" value="${s.delivery.eta}"></label></div>
      <div class="field"><span>المناطق وأجور التوصيل</span><div id="areas">${areasHtml()}</div><button type="button" class="link-btn" data-act="area-add">+ منطقة</button></div>
    </section>
    <section class="card"><h2>نقاط الولاء</h2>
      <label class="check"><input type="checkbox" data-s="settings.loyalty.enabled" ${s.loyalty.enabled ? 'checked' : ''}> تفعيل نقاط الولاء</label>
      <div class="row"><label class="field grow"><span>نقطة لكل (${esc(s.currency)})</span><input class="input" type="number" min="100" step="100" data-s="settings.loyalty.per" value="${s.loyalty.per}"></label>
        <label class="field grow"><span>النقاط المطلوبة للمكافأة</span><input class="input" type="number" min="1" data-s="settings.loyalty.rewardPoints" value="${s.loyalty.rewardPoints}"></label>
        <label class="field grow"><span>قيمة الخصم</span><input class="input" type="number" min="0" step="250" data-s="settings.loyalty.rewardValue" value="${s.loyalty.rewardValue}"></label></div>
      <p class="muted small" id="loyalty-note">${loyaltyNote()}</p>
    </section>
    ${ME.telegram ? `<section class="card tg-card"><h2>إشعارات تيليگرام</h2>
      <p class="muted small">يوصلك إشعار بكل طلب جديد حتى لو التلفون مقفول أو اللوحة مسكّرة، ويا تقرير أسبوعي كل سبت.</p>
      ${!ME.telegram.configured ? '<p class="warn-line">لم تُفعّل على السيرفر بعد — تحتاج إعداد بوت تيليگرام.</p>'
      : ME.telegram.chats ? `<p class="ok-line">${icon('check')} مربوط بـ ${ME.telegram.chats} ${ME.telegram.chats > 1 ? 'حسابات' : 'حساب'}</p>
        <div class="btn-row"><button class="btn ghost sm" data-act="tg-test">إرسال إشعار تجريبي</button><button class="btn ghost sm" data-act="tg-link">ربط حساب آخر</button><button class="btn ghost sm danger" data-act="tg-unlink">إلغاء الربط</button></div>`
        : `<button class="btn primary" data-act="tg-link">${icon('chat')} ربط تيليگرام</button><p class="muted small" id="tg-hint"></p>`}
    </section>` : ''}
    <section class="card"><h2>الحساب</h2>
      <label class="field"><span>نسبة عمولة تطبيقات التوصيل % <small>(لحساب التوفير بالإحصائيات)</small></span><input class="input" type="number" min="0" max="60" data-s="settings.commissionPct" value="${s.commissionPct}"></label>
      <button class="btn ghost" data-act="pw">تغيير كلمة المرور</button>
    </section>
  </div>`;
};
function areasHtml() {
  return setDraft.settings.delivery.areas.map((a, i) => `<div class="ch-row"><input class="input" data-area="${i}" data-af="name" value="${esc(a.name)}" placeholder="اسم المنطقة"><input class="input num-in" type="number" min="0" step="250" data-area="${i}" data-af="fee" value="${a.fee}" placeholder="الأجرة"><button type="button" class="icon-btn sm" data-act="area-del" data-i="${i}" aria-label="حذف">${icon('x')}</button></div>`).join('') || '<p class="muted small">لا توجد مناطق — أضف منطقة واحدة على الأقل</p>';
}
function loyaltyNote() {
  const L = setDraft.settings.loyalty;
  const spend = L.per * L.rewardPoints;
  return `الزبون يحتاج يصرف ${fmt(spend)} حتى ياخذ خصم ${fmt(L.rewardValue)} — يعني ${fmt(spend ? L.rewardValue / spend * 100 : 0, 1)}% يرجعله. (المعدل الشائع 3–7%)`;
}
function setPath(obj, path, val) { const k = path.split('.'); let o = obj; k.slice(0, -1).forEach(p => { o = o[p]; }); o[k.at(-1)] = val; }

/* ---------- النافذة ---------- */
function openModal(title, body, foot = '', wide = false) {
  $('#modal-root').innerHTML = `<div class="modal-bg" data-act="modal-bg"><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <header><h3>${title}</h3><button class="icon-btn sm" data-act="modal-close" aria-label="إغلاق">${icon('x')}</button></header>
    <div class="modal-body">${body}</div>${foot ? `<footer>${foot}</footer>` : ''}</div></div>`;
  setTimeout(() => $('.modal-body input:not([type=hidden]):not([type=file]), .modal-body select, .modal-body textarea')?.focus(), 40);
}
function closeModal() { $('#modal-root').innerHTML = ''; draft = null; if (view === 'orders') renderOrdersBoard(); }

/* ---------- الإجراءات ---------- */
const findOrder = id => ORDERS.find(o => o.id === +id);
const A = {
  'auth-mode': el => { location.hash = el.dataset.v === 'signup' ? '#signup' : ''; authScreen(el.dataset.v); },
  login: () => { const f = Object.fromEntries(new FormData($('#auth-form'))); run(() => login(f.phone, f.password)); },
  demo: el => run(() => login(el.dataset.v === '1' ? '07700000001' : '07700000002', 'demo1234')),
  signup: () => {
    const f = Object.fromEntries(new FormData($('#auth-form')));
    run(async () => { await api('/auth/signup', { method: 'POST', body: f }); location.hash = ''; boot(); }, 'تم إنشاء متجرك 🎉');
  },
  logout: () => run(async () => { await api('/auth/logout', { method: 'POST', body: {} }); ME = null; MENU = null; ORDERS = []; authScreen('login'); }),
  'side-toggle': () => $('#side').classList.toggle('open'),
  install: async () => {
    const r = await PWA.install();
    if (r === 'ios') openModal('ثبّت سُفرة على الآيفون', `<p class="muted">افتح هذه الصفحة بمتصفح سفاري، بعدها:</p>${PWA.iosSteps}<p class="muted small">التطبيق يفتح بشاشة كاملة ويوصلك تنبيه الطلبات الجديدة طول ما هو مفتوح.</p>`, '<button class="btn primary" data-act="modal-close">فهمت</button>');
  },
  pause: el => run(async () => {
    ME = await api('/admin/settings', { method: 'PUT', body: { settings: { paused: !el.checked } } });
    const lt = $('#live-toggle'); lt.classList.toggle('off', S().paused);
    $('b', lt).textContent = S().paused ? 'الاستقبال متوقف' : 'نستقبل الطلبات'; $('#open-note').textContent = openNote();
  }, el.checked ? 'رجع استقبال الطلبات' : 'تم إيقاف الاستقبال مؤقتاً'),
  sound: () => {
    ui.sound = !ui.sound; try { localStorage.setItem('sufra:sound', ui.sound ? '1' : '0'); } catch { /* */ }
    updateSoundBtn(); ensureAudio();
    if (ui.sound) { beep(); if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); }
    toast(ui.sound ? 'التنبيه الصوتي مفعّل 🔔' : 'التنبيه الصوتي متوقف');
  },
  'modal-close': () => closeModal(),
  'modal-bg': (el, e) => { if (e.target === el) closeModal(); },
  otab: el => { ui.ordersTab = el.dataset.v; $$('[data-act=otab]').forEach(b => b.classList.toggle('on', b === el)); renderOrdersBoard(); },
  eta: el => { ui.eta[el.dataset.id] = +el.dataset.m; renderOrdersBoard(); },
  accept: el => { const o = findOrder(el.dataset.id); el.disabled = true; run(async () => { Object.assign(o, await api(`/admin/orders/${o.id}`, { method: 'PATCH', body: { action: 'accept', eta: ui.eta[o.id] || defaultEta(o) } })); renderOrdersBoard(); updateBadge(); }, `تم قبول الطلب #${o.number} — الزبون وصله إشعار`); },
  next: el => { const o = findOrder(el.dataset.id); el.disabled = true; run(async () => { Object.assign(o, await api(`/admin/orders/${o.id}`, { method: 'PATCH', body: { action: 'next' } })); renderOrdersBoard(); }); },
  reject: el => {
    const o = findOrder(el.dataset.id);
    openModal(`رفض الطلب #${o.number}`, `<form id="mform" class="form"><p class="muted">اختر السبب — راح يظهر للزبون بصفحة الطلب.</p>
      ${['نفدت بعض المواد', 'ضغط طلبات عالي حالياً', 'خارج منطقة التوصيل', 'المطعم على وشك الإغلاق'].map((r, i) => `<label class="radio-row"><input type="radio" name="reason" value="${r}" ${i === 0 ? 'checked' : ''}> ${r}</label>`).join('')}
      <label class="radio-row"><input type="radio" name="reason" value="other"> سبب آخر</label><input class="input" name="other" placeholder="اكتب السبب" maxlength="120">
      <label class="check danger-check"><input type="checkbox" name="block"> طلب وهمي — احظر هذا الرقم (${esc(o.customer.phone)})</label>
      <input type="hidden" name="id" value="${o.id}"></form>`,
    '<button class="btn ghost" data-act="modal-close">رجوع</button><button class="btn primary danger-bg" type="submit" form="mform" data-act="reject-confirm">رفض الطلب</button>');
  },
  'reject-confirm': () => {
    const f = Object.fromEntries(new FormData($('#mform'))), o = findOrder(f.id);
    const reason = f.reason === 'other' ? f.other : f.reason;
    run(async () => {
      Object.assign(o, await api(`/admin/orders/${o.id}`, { method: 'PATCH', body: { action: 'reject', reason } }));
      if (f.block) await api(`/admin/customers/${o.customer.id}`, { method: 'PATCH', body: { blocked: true } });
      closeModal();
    }, f.block ? 'تم رفض الطلب وحظر الرقم' : 'تم رفض الطلب وإبلاغ الزبون');
  },
  print: el => { const o = findOrder(el.dataset.id) || $('#modal-root')._order; if (o) printOrder(o); },
  'order-view': async el => {
    let o = findOrder(el.dataset.id);
    if (!o) { const rows = await api('/admin/orders?scope=history').catch(() => []); o = rows.find(x => x.id === +el.dataset.id); }
    if (o) { orderModal(o); $('#modal-root')._order = o; }
  },

  'cat-new': () => openModal('قسم جديد', '<form id="mform" class="form"><label class="field"><span>اسم القسم</span><input class="input" name="name" required maxlength="40" placeholder="مثلاً: المشويات"></label></form>',
    '<button class="btn ghost" data-act="modal-close">إلغاء</button><button class="btn primary" type="submit" form="mform" data-act="cat-save">إضافة</button>'),
  'cat-edit': el => { const c = MENU.categories.find(x => x.id === +el.dataset.id); openModal('تعديل القسم', `<form id="mform" class="form"><label class="field"><span>اسم القسم</span><input class="input" name="name" value="${esc(c.name)}" required maxlength="40"></label><input type="hidden" name="id" value="${c.id}"></form>`, '<button class="btn ghost" data-act="modal-close">إلغاء</button><button class="btn primary" type="submit" form="mform" data-act="cat-save">حفظ</button>'); },
  'cat-save': () => {
    const f = Object.fromEntries(new FormData($('#mform')));
    run(async () => { await api(f.id ? `/admin/categories/${f.id}` : '/admin/categories', { method: f.id ? 'PUT' : 'POST', body: { name: f.name } }); closeModal(); render(); }, 'تم الحفظ');
  },
  'cat-del': el => { if (confirm('حذف القسم؟')) run(async () => { await api(`/admin/categories/${el.dataset.id}`, { method: 'DELETE' }); render(); }, 'تم حذف القسم'); },
  'cat-move': el => {
    const ids = MENU.categories.map(c => c.id), i = ids.indexOf(+el.dataset.id), j = i + +el.dataset.d;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run(async () => { await api('/admin/categories/order', { method: 'PUT', body: { ids } }); render(); });
  },
  'item-new': el => (MENU.categories.length ? itemModal(null, +el.dataset.cat || null) : toast('أضف قسماً أولاً', 'bad')),
  'item-edit': el => itemModal(MENU.items.find(i => i.id === +el.dataset.id)),
  avail: el => run(async () => { await api(`/admin/items/${el.dataset.id}`, { method: 'PATCH', body: { available: el.checked } }); const it = MENU.items.find(i => i.id === +el.dataset.id); it.available = el.checked; el.closest('.mitem').outerHTML = itemRow(it); }, el.checked ? 'الصنف متوفر' : 'تم تعليم الصنف "نفد" — ما يكدر الزبون يطلبه'),
  'img-clear': () => { draft.image = ''; $('#img-prev').innerHTML = `<span>${esc(draft.emoji)}</span>`; },
  'g-add': () => { draft.options.push({ name: '', required: false, multi: false, choices: [{ name: '', price: 0 }] }); $('#groups').innerHTML = groupsHtml(); $$('#groups .grp-h input')?.at(-1)?.focus(); },
  'g-del': el => { draft.options.splice(+el.dataset.g, 1); $('#groups').innerHTML = groupsHtml(); },
  'c-add': el => { draft.options[+el.dataset.g].choices.push({ name: '', price: 0 }); $('#groups').innerHTML = groupsHtml(); },
  'c-del': el => { draft.options[+el.dataset.g].choices.splice(+el.dataset.c, 1); $('#groups').innerHTML = groupsHtml(); },
  'item-save': () => {
    if (!String(draft.name).trim()) return toast('اكتب اسم الصنف', 'bad');
    if (draft.price === '' || +draft.price < 0) return toast('حدد السعر', 'bad');
    const body = { ...draft, price: +draft.price, category_id: +draft.category_id || null };
    run(async () => { await api(draft.id ? `/admin/items/${draft.id}` : '/admin/items', { method: draft.id ? 'PUT' : 'POST', body }); closeModal(); render(); }, 'تم حفظ الصنف');
  },
  'item-del': () => { if (confirm(`حذف "${draft.name}"؟`)) run(async () => { await api(`/admin/items/${draft.id}`, { method: 'DELETE' }); closeModal(); render(); }, 'تم حذف الصنف'); },

  seg: el => { ui.custSeg = el.dataset.v; $$('[data-act=seg]').forEach(b => b.classList.toggle('on', b === el)); $('#cust-table').innerHTML = custTable(); },
  campaign: () => campaignModal(),
  'cmp-sent': el => setTimeout(() => { el.closest('.cmp-row').classList.add('sent'); el.innerHTML = `${icon('check')} أُرسلت`; }, 300),

  'coupon-new': () => couponModal(null),
  'coupon-edit': el => couponModal(JSON.parse($('#coupons-data').textContent).find(c => c.id === +el.dataset.id)),
  'coupon-save': () => {
    const f = Object.fromEntries(new FormData($('#mform')));
    const body = { code: f.code, kind: f.kind, value: +f.value, min_order: +f.min_order || 0, max_uses: +f.max_uses || 0, expires_at: f.expires ? new Date(f.expires + 'T23:59:59').getTime() : null, active: !!f.active };
    run(async () => { await api(f.id ? `/admin/coupons/${f.id}` : '/admin/coupons', { method: f.id ? 'PUT' : 'POST', body }); closeModal(); render(); }, 'تم حفظ الكوبون');
  },
  'coupon-del': el => { if (confirm('حذف الكوبون؟')) run(async () => { await api(`/admin/coupons/${el.dataset.id}`, { method: 'DELETE' }); render(); }, 'تم الحذف'); },

  copy: el => navigator.clipboard.writeText(el.dataset.v).then(() => toast('تم نسخ الرابط ✓', 'ok'), () => toast('انسخ الرابط يدوياً', 'bad')),
  'qr-png': () => {
    const svg = $('#qr-main svg'); if (!svg) return;
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 1024;
      const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1024, 1024); ctx.drawImage(img, 0, 0, 1024, 1024);
      const a = document.createElement('a'); a.href = cv.toDataURL('image/png'); a.download = `qr-${ME.slug}.png`; a.click();
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
  },
  'print-flyer': () => {
    if (!window.qrcode) return;
    const L = S().loyalty;
    const card = `<div class="flyer"><h2>${esc(ME.name)}</h2><p class="big">اطلب مباشرة من تلفونك</p><div class="fqr">${qrSvg(storeUrl(), 5)}</div>
      <p>${L.enabled ? `اجمع نقاط مع كل طلب — كل ${fmt(L.rewardPoints)} نقطة = خصم ${fmt(L.rewardValue)}` : 'بدون تطبيق وبدون تسجيل'}</p><p class="url">${esc(storeUrl())}</p></div>`;
    printSheet(`<div class="flyers">${card.repeat(4)}</div>`);
  },
  'print-tables': () => { if (window.qrcode) printSheet(`<div class="tprint">${Array.from({ length: ui.tables }, (_, i) => `<div class="tp"><h3>${esc(ME.name)}</h3><div class="fqr">${qrSvg(storeUrl(String(i + 1)), 5)}</div><b>طاولة ${i + 1}</b><p>امسح الرمز واطلب من مكانك</p></div>`).join('')}</div>`); },

  sdays: el => { ui.statsDays = +el.dataset.v; render(); },

  color: el => { setDraft.settings.color = el.dataset.v; $$('.sw').forEach(s => s.classList.toggle('on', s === el)); $('[data-s="settings.color"]').value = el.dataset.v; document.documentElement.style.setProperty('--brand', el.dataset.v); },
  'area-add': () => { setDraft.settings.delivery.areas.push({ name: '', fee: 2000 }); $('#areas').innerHTML = areasHtml(); $$('#areas input[data-af=name]').at(-1)?.focus(); },
  'area-del': el => { setDraft.settings.delivery.areas.splice(+el.dataset.i, 1); $('#areas').innerHTML = areasHtml(); },
  'settings-save': () => run(async () => {
    setDraft.settings.delivery.areas = setDraft.settings.delivery.areas.filter(a => String(a.name).trim());
    if (setDraft.settings.delivery.enabled && !setDraft.settings.delivery.areas.length) throw new Error('أضف منطقة توصيل واحدة على الأقل أو أوقف التوصيل');
    ME = await api('/admin/settings', { method: 'PUT', body: setDraft });
    shell(); go();
  }, 'تم حفظ الإعدادات'),
  pw: () => openModal('تغيير كلمة المرور', `<form id="mform" class="form"><label class="field"><span>الحالية</span><input class="input" type="password" name="current" required autocomplete="current-password"></label>
    <label class="field"><span>الجديدة</span><input class="input" type="password" name="next" minlength="8" required autocomplete="new-password"></label></form>`,
  '<button class="btn ghost" data-act="modal-close">إلغاء</button><button class="btn primary" type="submit" form="mform" data-act="pw-save">حفظ</button>'),
  'tg-link': async el => {
    const w = window.open('', '_blank'); // نفتح النافذة مباشرة حتى ما يمنعها المتصفح
    const r = await run(() => api('/admin/telegram/link', { method: 'POST', body: {} }));
    if (!r) { w?.close(); return; }
    if (w) w.location = r.url; else location.href = r.url;
    const hint = $('#tg-hint'); if (hint) hint.textContent = 'اضغط "Start" بتيليگرام، وبعدها ارجع هنا — راح تتحدث الحالة تلقائياً.';
    let tries = 0;
    const t = setInterval(async () => {
      tries++;
      const me = await api('/admin/me').catch(() => null);
      if (me && me.telegram.chats > (ME.telegram.chats || 0)) { clearInterval(t); ME = me; toast('تم ربط تيليگرام ✓', 'ok'); if (view === 'settings') render(); }
      if (tries > 60) clearInterval(t);
    }, 4000);
  },
  'tg-test': () => run(() => api('/admin/telegram/test', { method: 'POST', body: {} }), 'انبعث إشعار تجريبي — شيك تيليگرام'),
  'tg-unlink': () => { if (confirm('إلغاء ربط تيليگرام؟ ما راح توصلك إشعارات الطلبات هناك.')) run(async () => { await api('/admin/telegram/unlink', { method: 'POST', body: {} }); ME = await api('/admin/me'); render(); }, 'تم إلغاء الربط'); },
  block: el => {
    const c = CUSTOMERS.find(x => x.id === +el.dataset.id), next = !c.blocked;
    if (next && !confirm(`حظر ${c.name} (${c.phone})؟ ما راح يكدر يطلب من متجرك.`)) return;
    run(async () => { await api(`/admin/customers/${c.id}`, { method: 'PATCH', body: { blocked: next } }); c.blocked = next ? 1 : 0; $('#cust-table').innerHTML = custTable(); }, next ? 'تم حظر الرقم' : 'تم إلغاء الحظر');
  },
  'pw-save': () => { const f = Object.fromEntries(new FormData($('#mform'))); run(async () => { await api('/admin/password', { method: 'POST', body: f }); closeModal(); }, 'تم تغيير كلمة المرور'); },
};

document.addEventListener('click', e => {
  ensureAudio();
  if (audioCtx?.state === 'running') $('#audio-banner')?.classList.add('hidden');
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled || el.getAttribute('type') === 'submit') return;
  if (el.type === 'checkbox') return; // تُعالج بحدث change
  A[el.dataset.act]?.(el, e);
});
document.addEventListener('submit', e => {
  e.preventDefault();
  const b = e.submitter || $(`[type=submit][form="${e.target.id}"]`) || e.target.querySelector('[type=submit]');
  if (b && !b.disabled) A[b.dataset.act]?.(b, e);
});
document.addEventListener('change', async e => {
  const el = e.target;
  if (el.type === 'checkbox' && el.dataset.act) return A[el.dataset.act]?.(el, e);
  if (el.dataset.upload && el.files[0]) {
    const kind = el.dataset.upload;
    toast('جاري رفع الصورة…');
    const url = await run(() => uploadImage(el.files[0]));
    el.value = '';
    if (!url) return;
    if (kind === 'item') { draft.image = url; $('#img-prev').innerHTML = `<img src="${esc(url)}" alt="">`; }
    else { setDraft.settings[kind] = url; $(`#${kind}-box`).innerHTML = `<img src="${esc(url)}" alt="">`; toast('اضغط "حفظ التغييرات" لتطبيق الصورة'); }
    return;
  }
  handleField(el);
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.in === 'cust-q') { ui.custQ = el.value; $('#cust-table').innerHTML = custTable(); return; }
  if (el.dataset.in === 'tables') { ui.tables = Math.min(100, Math.max(1, +el.value || 1)); drawTables(); return; }
  if (el.type !== 'checkbox') handleField(el);
});
function handleField(el) {
  if (draft && el.dataset.d) {
    draft[el.dataset.d] = el.type === 'checkbox' ? el.checked : el.value;
    if (el.dataset.d === 'emoji' && !draft.image) $('#img-prev').innerHTML = `<span>${esc(el.value)}</span>`;
  } else if (draft && el.dataset.g !== undefined) {
    const g = draft.options[+el.dataset.g];
    if (el.dataset.c !== undefined) { const c = g.choices[+el.dataset.c]; c[el.dataset.cf] = el.dataset.cf === 'price' ? +el.value || 0 : el.value; }
    else g[el.dataset.gf] = el.type === 'checkbox' ? el.checked : el.value;
  } else if (setDraft && el.dataset.s) {
    const v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? +el.value : el.value;
    setPath(setDraft, el.dataset.s, v);
    if (el.dataset.s === 'settings.color') { $$('.sw').forEach(s => s.classList.remove('on')); document.documentElement.style.setProperty('--brand', v); }
    if (el.dataset.s.startsWith('settings.loyalty')) $('#loyalty-note').textContent = loyaltyNote();
  } else if (setDraft && el.dataset.area !== undefined) {
    const a = setDraft.settings.delivery.areas[+el.dataset.area];
    a[el.dataset.af] = el.dataset.af === 'fee' ? +el.value || 0 : el.value;
  }
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#modal-root').innerHTML) closeModal(); });
window.addEventListener('hashchange', () => { if (ME) go(); else authScreen(); });

async function boot() {
  try { ME = await api('/admin/me'); } catch { return; }
  ORDERS = await api('/admin/orders?scope=active').catch(() => []);
  shell(); go();
}
boot();
