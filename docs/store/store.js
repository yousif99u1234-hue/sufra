'use strict';
/* سُفرة — صفحة الطلب للزبون */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Math.round(Number(n) || 0).toLocaleString('en-US');
const DAY_MS = 864e5;
const slug = (new URLSearchParams(location.search).get('r') || location.pathname.split('/').filter(Boolean)[1] || '').toLowerCase();
const TABLE = (new URLSearchParams(location.search).get('t') || '').slice(0, 10);
const store = {
  get(k, d) { try { const v = localStorage.getItem(`sufra:${slug}:${k}`); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`sufra:${slug}:${k}`, JSON.stringify(v)); } catch { /* التخزين غير متاح */ } },
};

const I = {
  back: '<path d="M9 18l6-6-6-6"/>',
  receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m16 6-4-4-4 4M12 2v13"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  bike: '<circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h2l3 11.5M5.5 17.5 9 10h7l-4.5 7.5M9 10 7.5 6H5"/>',
  bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/>',
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.6A8.4 8.4 0 1 1 21 11.5Z"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2-6.2 3.2L7 14.2 2 9.3l6.9-1Z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>', check: '<path d="M20 6 9 17l-5-5"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8Z"/><circle cx="7" cy="7" r="1.5"/>',
  dine: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
};
const icon = (k, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[k]}</svg>`;

let R = null, CATS = [], ITEMS = [], byId = {};
const st = {
  cart: store.get('cart', []),
  mode: TABLE ? 'dine' : store.get('mode', 'delivery'),
  profile: store.get('profile', { name: '', phone: '', area: '', address: '' }),
  orders: store.get('orders', []),
  q: '', coupon: null, redeem: false, points: null, loc: null, placing: false,
};
let stream = null, tick = null;

const money = n => `${fmt(n)} <small>${esc(R.currency)}</small>`;
const moneyT = n => `${fmt(n)} ${R.currency}`;
const timeOf = t => { const d = new Date(t); const h = d.getHours(); return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'ص' : 'م'}`; };
const hourLabel = hm => { const [h, m] = String(hm).split(':').map(Number); return `${h % 12 || 12}${m ? ':' + String(m).padStart(2, '0') : ''} ${h < 12 || h === 24 ? 'ص' : 'م'}`; };
const normPhone = v => {
  let p = String(v || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^\d+]/g, '');
  if (p.startsWith('+964')) p = '0' + p.slice(4); else if (p.startsWith('964')) p = '0' + p.slice(3); else if (p.startsWith('7') && p.length === 10) p = '0' + p;
  return p;
};
const validPhone = p => /^07\d{9}$/.test(normPhone(p));
const wa = p => `https://wa.me/964${normPhone(p).slice(1)}`;

async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    method: opts.method || 'GET',
    headers: opts.body ? { 'Content-Type': 'application/json' } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'تعذّر الاتصال، تأكد من الإنترنت'), { status: res.status });
  return data;
}
function toast(msg, tone = '') {
  const el = document.createElement('div');
  el.className = `toast ${tone}`; el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), 2800);
  setTimeout(() => el.remove(), 3200);
}

/* ---------- السلة ---------- */
const saveCart = () => store.set('cart', st.cart);
function unitPrice(item, choices) {
  let p = item.price;
  for (const g of item.options) for (const c of g.choices) if (choices.includes(c.id)) p += c.price;
  return p;
}
const choiceNames = (item, choices) => item.options.flatMap(g => g.choices.filter(c => choices.includes(c.id)).map(c => c.name));
const cartCount = () => st.cart.reduce((a, l) => a + l.qty, 0);
const subtotal = () => st.cart.reduce((a, l) => a + unitPrice(byId[l.itemId], l.choices) * l.qty, 0);
function addToCart(itemId, qty, choices, note) {
  const key = itemId + '|' + [...choices].sort().join(',') + '|' + note;
  const ex = st.cart.find(l => l.key === key);
  if (ex) ex.qty = Math.min(50, ex.qty + qty); else st.cart.push({ key, itemId, qty, choices, note });
  st.coupon = null; saveCart();
}
function modes() {
  const m = [];
  if (TABLE && R.dineIn.enabled) return ['dine'];
  if (R.delivery.enabled) m.push('delivery');
  if (R.pickup.enabled) m.push('pickup');
  return m;
}
function fixMode() { const m = modes(); if (!m.includes(st.mode)) st.mode = m[0] || 'pickup'; }
function feeNow() {
  if (st.mode !== 'delivery') return 0;
  return R.delivery.areas.find(a => a.name === st.profile.area)?.fee ?? 0;
}
function totals() {
  const sub = subtotal(), fee = feeNow();
  const coupon = st.coupon ? Math.min(st.coupon.discount, sub) : 0;
  const pts = st.redeem && R.loyalty.enabled && (st.points ?? 0) >= R.loyalty.rewardPoints ? R.loyalty.rewardValue : 0;
  const discount = Math.min(sub, coupon + pts);
  return { sub, fee, coupon, pts, discount, total: sub + fee - discount };
}

/* ---------- التوجيه ---------- */
function route() {
  if (stream) { stream.close(); stream = null; }
  clearInterval(tick);
  closeSheet();
  const h = location.hash.slice(1) || '/';
  const m = h.match(/^\/order\/(\d+)\/([a-f0-9]+)$/);
  if (m) return viewTrack(m[1], m[2]);
  if (h === '/checkout') return st.cart.length ? viewCheckout() : (location.hash = '#/');
  if (h === '/orders') return viewOrders();
  viewMenu();
}

/* ---------- المنيو ---------- */
function viewMenu() {
  fixMode();
  const minFee = R.delivery.areas.length ? Math.min(...R.delivery.areas.map(a => a.fee)) : 0;
  const eta = st.mode === 'delivery' ? R.delivery.eta : R.pickup.eta;
  const popular = ITEMS.filter(i => i.popular && i.available);
  const m = modes();
  $('#app').innerHTML = `
  <div class="store">
    <header class="hero" ${R.cover ? `style="--cover:url('${esc(R.cover)}')"` : ''}>
      <div class="hero-bar">
        <a class="icon-btn glass" href="#/orders" aria-label="طلباتي">${icon('receipt')}</a>
        <button class="icon-btn glass" data-act="share" aria-label="مشاركة">${icon('share')}</button>
      </div>
    </header>
    <section class="head">
      <div class="logo">${R.logo ? `<img src="${esc(R.logo)}" alt="">` : esc(R.name.replace(/^(مطعم|كافيه|كافي|قهوة|مقهى)\s+/, '').replace(/^ال/, '').slice(0, 1))}</div>
      <h1>${esc(R.name)}</h1>
      ${R.tagline ? `<p class="tagline">${esc(R.tagline)}</p>` : ''}
      <div class="meta">
        <span class="status ${R.open ? 'on' : 'off'}"><i></i>${R.open ? 'مفتوح الآن' : R.paused ? 'متوقف مؤقتاً' : 'مغلق الآن'}</span>
        <span>${icon('clock')} ${st.mode === 'dine' ? 'يوصل لطاولتك' : `${eta}–${eta + 10} د`}</span>
        ${st.mode === 'delivery' ? `<span>${icon('bike')} من ${fmt(minFee)}</span>` : ''}
      </div>
    </section>
    ${st.mode === 'dine' ? `<div class="table-banner">${icon('dine')}<div><b>أنت على طاولة ${esc(TABLE)}</b><span>اطلب من هنا وراح يوصلك الطلب لطاولتك</span></div></div>`
    : m.length > 1 ? `<div class="mode seg">${m.map(k => `<button class="${st.mode === k ? 'on' : ''}" data-act="mode" data-v="${k}">${k === 'delivery' ? icon('bike') + 'توصيل' : icon('bag') + 'استلام من المحل'}</button>`).join('')}</div>` : ''}
    ${!R.open ? `<div class="closed">${R.paused ? 'المطعم أوقف استقبال الطلبات مؤقتاً — تكدر تتصفح المنيو.' : `مغلق حالياً — نستقبل الطلبات من ${hourLabel(R.hours.open)} إلى ${hourLabel(R.hours.close)}`}</div>` : ''}
    ${loyaltyCard()}
    <div id="install-slot">${installCard(st.orders.length > 0)}</div>
    <label class="search">${icon('search')}<input type="search" placeholder="ابحث بالمنيو…" value="${esc(st.q)}" data-in="q" aria-label="بحث"></label>
    ${popular.length && !st.q ? `<section class="popular"><h2>الأكثر طلباً</h2><div class="pop-row">${popular.map(popCard).join('')}</div></section>` : ''}
    <nav class="tabs" id="tabs">${CATS.filter(c => ITEMS.some(i => i.category_id === c.id)).map(c => `<a href="#c${c.id}" data-act="tab" data-id="${c.id}">${esc(c.name)}</a>`).join('')}</nav>
    <main id="menu">${menuHtml()}</main>
    <footer class="foot">
      ${R.address ? `<p>${icon('pin')} ${esc(R.address)}</p>` : ''}
      <p class="powered">الطلب المباشر عبر <b>سُفرة</b> — بدون عمولة على مطعمك المفضّل</p>
    </footer>
    <div class="cart-slot" id="cart-slot">${cartBar()}</div>
  </div>`;
  spy();
  if (st.points === null && validPhone(st.profile.phone)) loadPoints().then(() => { const el = $('#loyalty'); if (el) el.outerHTML = loyaltyCard(); });
}
function loyaltyCard() {
  const L = R.loyalty;
  if (!L.enabled) return '';
  const p = st.points;
  const left = p == null ? null : Math.max(0, L.rewardPoints - p);
  const pct = p == null ? 0 : Math.min(100, p / L.rewardPoints * 100);
  return `<section class="loyalty" id="loyalty">
    <div class="l-icon">${icon('star')}</div>
    <div class="l-body">
      ${p == null ? `<b>اجمع نقاط مع كل طلب</b><span>كل ${fmt(L.per)} ${esc(R.currency)} = نقطة · ${fmt(L.rewardPoints)} نقطة = خصم ${fmt(L.rewardValue)}</span>`
      : left === 0 ? `<b>عندك ${fmt(p)} نقطة 🎉</b><span>تكدر تستخدم خصم ${fmt(L.rewardValue)} ${esc(R.currency)} بطلبك هذا</span>`
        : `<b>رصيدك ${fmt(p)} نقطة</b><span>باقي ${fmt(left)} نقطة على خصم ${fmt(L.rewardValue)} ${esc(R.currency)}</span>`}
      ${p != null ? `<div class="l-bar"><i style="width:${pct}%"></i></div>` : ''}
    </div>
  </section>`;
}
const media = (it, cls) => (it.image ? `<img class="${cls}" src="${esc(it.image)}" alt="" loading="lazy">` : `<span class="${cls} emo">${esc(it.emoji || '🍽️')}</span>`);
const inCart = id => st.cart.filter(l => l.itemId === id).reduce((a, l) => a + l.qty, 0);
function popCard(it) {
  return `<button class="pop" data-act="item" data-id="${it.id}">${media(it, 'pop-media')}<b>${esc(it.name)}</b><span class="num">${money(it.price)}</span></button>`;
}
function itemRow(it) {
  const n = inCart(it.id);
  return `<button class="item ${it.available ? '' : 'soldout'}" data-act="item" data-id="${it.id}" ${it.available ? '' : 'aria-disabled="true"'}>
    <div class="item-body">
      <b>${esc(it.name)}</b>
      ${it.description ? `<p>${esc(it.description)}</p>` : ''}
      <span class="price num">${money(it.price)}${it.options.length ? '<em>+ خيارات</em>' : ''}${it.available ? '' : '<em class="so">نفد اليوم</em>'}</span>
    </div>
    <div class="item-side">${media(it, 'item-media')}${it.available ? (n ? `<span class="add has">${n}</span>` : `<span class="add">${icon('plus')}</span>`) : ''}</div>
  </button>`;
}
function menuHtml() {
  const q = st.q.trim();
  const list = q ? ITEMS.filter(i => i.name.includes(q) || i.description.includes(q)) : ITEMS;
  if (!list.length) return `<p class="empty">ما لكينا "${esc(q)}" بالمنيو</p>`;
  const groups = CATS.map(c => [c, list.filter(i => i.category_id === c.id)]).filter(g => g[1].length);
  const loose = list.filter(i => !CATS.some(c => c.id === i.category_id));
  if (loose.length) groups.push([{ id: 0, name: 'أخرى' }, loose]);
  return groups.map(([c, items]) => `<section class="cat" id="c${c.id}" data-cat="${c.id}"><h2>${esc(c.name)}</h2>${items.map(itemRow).join('')}</section>`).join('');
}
function cartBar() {
  const n = cartCount();
  if (!n) return '';
  return `<a class="cart-bar" href="#/checkout"><span class="cb-count">${n}</span><span class="cb-label">عرض السلة</span><b class="num">${money(subtotal())}</b></a>`;
}
function refreshMenu() {
  const m = $('#menu'); if (m) m.innerHTML = menuHtml();
  const c = $('#cart-slot'); if (c) c.innerHTML = cartBar();
  spy();
}
let observer = null;
function spy() {
  if (observer) observer.disconnect();
  const tabs = $('#tabs'); if (!tabs) return;
  observer = new IntersectionObserver(entries => {
    const vis = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (!vis) return;
    const id = vis.target.dataset.cat;
    $$('#tabs a').forEach(a => {
      const on = a.dataset.id === id;
      a.classList.toggle('on', on);
      if (on) tabs.scrollTo({ left: a.offsetLeft - tabs.clientWidth / 2 + a.clientWidth / 2, behavior: 'smooth' });
    });
  }, { rootMargin: '-120px 0px -60% 0px' });
  $$('.cat').forEach(s => observer.observe(s));
}

/* ---------- نافذة الصنف ---------- */
let sheetItem = null, sheetQty = 1;
function openItem(id) {
  const it = byId[id];
  if (!it || !it.available) return;
  sheetItem = it; sheetQty = 1;
  $('#sheet-root').innerHTML = `<div class="sheet-bg" data-act="sheet-bg"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(it.name)}">
    <div class="sheet-media">${media(it, 'sm')}<button class="icon-btn glass close" data-act="sheet-close" aria-label="إغلاق">${icon('x')}</button></div>
    <div class="sheet-body">
      <h2>${esc(it.name)}</h2>
      ${it.description ? `<p class="desc">${esc(it.description)}</p>` : ''}
      <div class="sheet-price num">${money(it.price)}</div>
      <form id="opts">${it.options.map(g => `<fieldset class="opt">
        <legend><b>${esc(g.name)}</b><span class="badge ${g.required ? 'brand' : ''}">${g.required ? 'مطلوب' : g.multi ? 'اختياري · أكثر من خيار' : 'اختياري'}</span></legend>
        ${g.choices.map((c, i) => `<label class="choice"><input type="${g.multi ? 'checkbox' : 'radio'}" name="${esc(g.id)}" value="${esc(c.id)}" ${g.required && !g.multi && i === 0 ? 'checked' : ''}>
          <span class="mark"></span><span class="c-name">${esc(c.name)}</span>${c.price ? `<em class="num" dir="ltr">+${fmt(c.price)}</em>` : ''}</label>`).join('')}
      </fieldset>`).join('')}
      <label class="field note"><span>ملاحظة للمطبخ <small>(اختياري)</small></span><input class="input" name="note" maxlength="120" placeholder="مثلاً: بدون بصل"></label>
      </form>
    </div>
    <div class="sheet-foot">
      <div class="qty"><button data-act="sq" data-d="1" aria-label="زيادة">${icon('plus')}</button><span id="sq">1</span><button data-act="sq" data-d="-1" aria-label="إنقاص">${icon('minus')}</button></div>
      <button class="btn primary lg grow" data-act="add">أضف للسلة · <span id="sheet-total" class="num">${moneyT(it.price)}</span></button>
    </div>
  </div></div>`;
  document.body.classList.add('locked');
  requestAnimationFrame(() => $('.sheet-bg')?.classList.add('in'));
}
function sheetChoices() { return $$('#opts input:checked').map(i => i.value).filter(v => v !== 'on'); }
function updateSheet() {
  if (!sheetItem) return;
  $('#sq').textContent = sheetQty;
  $('#sheet-total').textContent = moneyT(unitPrice(sheetItem, sheetChoices()) * sheetQty);
}
function closeSheet() {
  const bg = $('.sheet-bg');
  document.body.classList.remove('locked');
  sheetItem = null;
  if (!bg) return;
  bg.classList.remove('in');
  setTimeout(() => { if (!$('.sheet-bg.in')) $('#sheet-root').innerHTML = ''; }, 220);
}

/* ---------- إتمام الطلب ---------- */
async function loadPoints() {
  if (!R.loyalty.enabled || !validPhone(st.profile.phone)) { st.points = null; return; }
  try { st.points = (await api(`/store/${slug}/points?phone=${encodeURIComponent(normPhone(st.profile.phone))}`)).points; } catch { st.points = null; }
}
function viewCheckout() {
  fixMode();
  const p = st.profile, m = modes();
  if (st.mode === 'delivery' && !R.delivery.areas.some(a => a.name === p.area)) p.area = '';
  $('#app').innerHTML = `
  <div class="page">
    <header class="topbar"><a class="icon-btn" href="#/" aria-label="رجوع">${icon('back')}</a><h1>إتمام الطلب</h1><span class="tb-sp"></span></header>
    <div class="co">
      <section class="card">
        <div class="card-h"><h2>طلبك من ${esc(R.name)}</h2><a href="#/" class="link">+ أضف أصناف</a></div>
        <div id="co-lines">${linesHtml()}</div>
      </section>
      <section class="card">
        <h2>طريقة الاستلام</h2>
        ${st.mode === 'dine' ? `<div class="table-banner in-card">${icon('dine')}<div><b>طاولة ${esc(TABLE)}</b><span>راح يوصل الطلب لطاولتك</span></div></div>`
        : m.length > 1 ? `<div class="seg">${m.map(k => `<button class="${st.mode === k ? 'on' : ''}" data-act="co-mode" data-v="${k}">${k === 'delivery' ? icon('bike') + 'توصيل' : icon('bag') + 'استلام'}</button>`).join('')}</div>` : ''}
        ${st.mode === 'delivery' ? `
          <label class="field"><span>المنطقة</span><select class="input" data-bind="area" id="f-area"><option value="">— اختر منطقتك —</option>${R.delivery.areas.map(a => `<option value="${esc(a.name)}" ${a.name === p.area ? 'selected' : ''}>${esc(a.name)} · توصيل ${fmt(a.fee)}</option>`).join('')}</select></label>
          <label class="field"><span>العنوان بالتفصيل</span><textarea class="input" data-bind="address" id="f-address" rows="2" placeholder="المحلة، الزقاق، رقم الدار، أقرب نقطة دالة">${esc(p.address)}</textarea></label>
          <button class="btn soft block" data-act="locate">${icon('pin')} <span id="loc-label">${st.loc ? 'تم تحديد موقعك ✓' : 'أرسل موقعي الحالي (اختياري)'}</span></button>`
        : st.mode === 'pickup' ? `<p class="hint">${icon('clock')} يكون جاهز خلال ~${R.pickup.eta} دقيقة من قبول الطلب${R.address ? ` · ${esc(R.address)}` : ''}</p>` : ''}
      </section>
      <section class="card">
        <h2>معلوماتك</h2>
        <div class="row2">
          <label class="field"><span>الاسم</span><input class="input" data-bind="name" id="f-name" value="${esc(p.name)}" autocomplete="name" maxlength="60"></label>
          <label class="field"><span>رقم الهاتف</span><input class="input ltr" data-bind="phone" id="f-phone" value="${esc(p.phone)}" inputmode="tel" autocomplete="tel" placeholder="07XX XXX XXXX" maxlength="16"></label>
        </div>
        <label class="field"><span>ملاحظات <small>(اختياري)</small></span><input class="input" id="f-note" maxlength="300" placeholder="أي شي تحب يعرفه المطعم"></label>
      </section>
      <section class="card">
        <h2>الخصومات</h2>
        <div class="coupon"><input class="input ltr" id="f-coupon" placeholder="كود الخصم" value="${esc(st.coupon?.code || '')}" ${st.coupon ? 'disabled' : ''} autocapitalize="characters">
          ${st.coupon ? `<button class="btn ghost" data-act="coupon-clear">إزالة</button>` : `<button class="btn ghost" data-act="coupon">تطبيق</button>`}</div>
        ${st.coupon ? `<p class="ok-line">${icon('check')} ${esc(st.coupon.label)} — وفّرت ${moneyT(st.coupon.discount)}</p>` : ''}
        <div id="points-box">${pointsBox()}</div>
      </section>
      <section class="card" id="summary">${summaryHtml()}</section>
      <p class="pay-note">${icon('check')} الدفع نقداً عند الاستلام</p>
    </div>
    <div class="cta"><button class="btn primary lg block" data-act="place" id="place" ${R.open ? '' : 'disabled'}>${R.open ? `تأكيد الطلب · <span class="num" id="cta-total">${moneyT(totals().total)}</span>` : 'المطعم مغلق حالياً'}</button></div>
  </div>`;
  window.scrollTo(0, 0);
  if (st.points === null) loadPoints().then(refreshCheckout);
}
function linesHtml() {
  return st.cart.map((l, i) => {
    const it = byId[l.itemId], names = choiceNames(it, l.choices);
    return `<div class="line">
      <div class="l-main"><b>${esc(it.name)}</b>${names.length ? `<small>${esc(names.join('، '))}</small>` : ''}${l.note ? `<small>📝 ${esc(l.note)}</small>` : ''}</div>
      <div class="qty sm"><button data-act="lq" data-i="${i}" data-d="1" aria-label="زيادة">${icon('plus')}</button><span>${l.qty}</span><button data-act="lq" data-i="${i}" data-d="-1" aria-label="${l.qty === 1 ? 'حذف' : 'إنقاص'}">${icon(l.qty === 1 ? 'trash' : 'minus')}</button></div>
      <b class="l-total num">${fmt(unitPrice(it, l.choices) * l.qty)}</b>
    </div>`;
  }).join('');
}
function pointsBox() {
  const L = R.loyalty;
  if (!L.enabled) return '';
  if (st.points == null) return `<p class="hint">${icon('star')} اكتب رقمك لتشوف نقاطك — كل ${fmt(L.per)} ${esc(R.currency)} = نقطة</p>`;
  if (st.points < L.rewardPoints) {
    const after = Math.floor((totals().total - feeNow()) / L.per);
    return `<p class="hint">${icon('star')} رصيدك <b>${fmt(st.points)}</b> نقطة · راح تربح ~<b>${fmt(after)}</b> نقطة من هذا الطلب</p>`;
  }
  return `<label class="redeem"><input type="checkbox" data-act="redeem" ${st.redeem ? 'checked' : ''}><span class="switch"></span>
    <span><b>استخدم ${fmt(L.rewardPoints)} نقطة</b><small>خصم ${fmt(L.rewardValue)} ${esc(R.currency)} · رصيدك ${fmt(st.points)}</small></span></label>`;
}
function summaryHtml() {
  const t = totals();
  const minOk = st.mode !== 'delivery' || t.sub >= R.delivery.minOrder;
  return `<h2>الملخص</h2>
    <div class="sum"><span>المجموع</span><b class="num">${fmt(t.sub)}</b></div>
    ${st.mode === 'delivery' ? `<div class="sum"><span>التوصيل</span><b class="num">${st.profile.area ? fmt(t.fee) : '—'}</b></div>` : ''}
    ${t.coupon ? `<div class="sum ok"><span>الكوبون</span><b class="num" dir="ltr">−${fmt(t.coupon)}</b></div>` : ''}
    ${t.pts ? `<div class="sum ok"><span>النقاط</span><b class="num" dir="ltr">−${fmt(t.pts)}</b></div>` : ''}
    <div class="sum grand"><span>الإجمالي</span><b class="num">${money(t.total)}</b></div>
    ${minOk ? '' : `<p class="warn-line">الحد الأدنى للتوصيل ${moneyT(R.delivery.minOrder)} — أضف ${moneyT(R.delivery.minOrder - t.sub)}</p>`}`;
}
function refreshCheckout() {
  if (!$('#summary')) return;
  $('#co-lines').innerHTML = linesHtml();
  $('#points-box').innerHTML = pointsBox();
  $('#summary').innerHTML = summaryHtml();
  const c = $('#cta-total'); if (c) c.textContent = moneyT(totals().total);
}
function fieldError(id, msg) {
  const el = $(id);
  if (el) { el.classList.add('err'); el.focus(); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  toast(msg, 'bad');
  return false;
}
function validate() {
  $$('.input.err').forEach(e => e.classList.remove('err'));
  const p = st.profile, t = totals();
  if (st.mode === 'delivery') {
    if (!p.area) return fieldError('#f-area', 'اختر منطقة التوصيل');
    if (p.address.trim().length < 4) return fieldError('#f-address', 'اكتب العنوان بالتفصيل');
    if (t.sub < R.delivery.minOrder) return fieldError(null, `الحد الأدنى للتوصيل ${moneyT(R.delivery.minOrder)}`);
  }
  if (p.name.trim().length < 2) return fieldError('#f-name', 'اكتب اسمك');
  if (!validPhone(p.phone)) return fieldError('#f-phone', 'رقم الهاتف غير صحيح — مثال: 07701234567');
  return true;
}
async function placeOrder() {
  if (st.placing || !validate()) return;
  st.placing = true;
  const btn = $('#place');
  btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> جاري الإرسال…';
  const p = st.profile;
  try {
    const res = await api(`/store/${slug}/orders`, {
      method: 'POST',
      body: {
        type: st.mode, table: TABLE, name: p.name, phone: normPhone(p.phone), area: p.area, address: p.address,
        lat: st.loc?.lat, lng: st.loc?.lng, note: $('#f-note').value, coupon: st.coupon?.code || '', redeem: st.redeem,
        items: st.cart.map(l => ({ itemId: l.itemId, qty: l.qty, choices: l.choices, note: l.note })),
      },
    });
    st.orders.unshift({ id: res.id, token: res.token, number: res.number, at: Date.now(), total: totals().total, mode: st.mode, items: st.cart.map(({ itemId, qty, choices, note }) => ({ itemId, qty, choices, note })) });
    st.orders = st.orders.slice(0, 20);
    store.set('orders', st.orders);
    store.set('profile', st.profile);
    st.cart = []; st.coupon = null; st.redeem = false; st.points = null; saveCart();
    location.hash = `#/order/${res.id}/${res.token}`;
  } catch (e) {
    toast(e.message, 'bad');
    if (e.status === 409 || e.status === 400) { await reloadStore(); }
    btn.disabled = false; btn.innerHTML = `تأكيد الطلب · <span class="num" id="cta-total">${moneyT(totals().total)}</span>`;
  } finally { st.placing = false; }
}

/* ---------- تتبّع الطلب ---------- */
const STEPS = {
  delivery: [['pending', 'استلمنا طلبك'], ['preparing', 'قيد التحضير'], ['on_way', 'بالطريق إليك'], ['completed', 'تم التوصيل']],
  pickup: [['pending', 'استلمنا طلبك'], ['preparing', 'قيد التحضير'], ['ready', 'جاهز للاستلام'], ['completed', 'تم الاستلام']],
  dine: [['pending', 'استلمنا طلبك'], ['preparing', 'قيد التحضير'], ['ready', 'جاهز'], ['completed', 'تم التقديم']],
};
let track = null;
async function viewTrack(id, tk) {
  $('#app').innerHTML = `<div class="page"><header class="topbar"><a class="icon-btn" href="#/" aria-label="المنيو">${icon('back')}</a><h1>تتبّع الطلب</h1><span class="tb-sp"></span></header><div class="boot"><span class="spinner"></span></div></div>`;
  try { track = await api(`/orders/${id}?token=${tk}`); } catch (e) {
    $('.boot').outerHTML = `<p class="empty">${esc(e.message)}</p>`; return;
  }
  renderTrack();
  if (!['completed', 'rejected'].includes(track.order.status)) {
    stream = new EventSource(`/api/orders/${id}/stream?token=${tk}`);
    stream.addEventListener('status', ev => {
      const o = JSON.parse(ev.data), prev = track.order.status;
      track.order = o;
      if (o.status !== prev) {
        if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
        if (o.status === 'completed') api(`/orders/${id}?token=${tk}`).then(d => { track = d; renderTrack(); }).catch(() => renderTrack());
        else renderTrack();
      }
      if (['completed', 'rejected'].includes(o.status)) { stream.close(); stream = null; }
    });
  }
  tick = setInterval(() => { const e = $('#eta-left'); if (e) e.textContent = etaLeft(); }, 30000);
}
function etaLeft() {
  const o = track.order;
  if (!o.accepted_at || !o.eta) return '';
  const left = Math.round((o.accepted_at + o.eta * 60e3 - Date.now()) / 60e3);
  return left > 1 ? `خلال ~${left} دقيقة` : 'خلال دقائق';
}
function renderTrack() {
  const { order: o, restaurant: r } = track;
  document.documentElement.style.setProperty('--brand', r.color);
  const steps = STEPS[o.type] || STEPS.pickup;
  const idx = o.status === 'completed' ? steps.length : steps.findIndex(s => s[0] === o.status);
  const hero = {
    pending: ['⏳', 'بانتظار تأكيد المطعم', 'عادةً خلال دقيقة أو دقيقتين'],
    preparing: ['👨‍🍳', 'المطعم يحضّر طلبك', o.eta ? `الوقت المتوقع ${timeOf(o.accepted_at + o.eta * 60e3)} · <span id="eta-left">${etaLeft()}</span>` : ''],
    on_way: ['🛵', 'طلبك بالطريق إليك', 'خلّي تلفونك قريب منك'],
    ready: o.type === 'dine' ? ['🍽️', 'طلبك جاهز', 'راح يوصل لطاولتك هسه'] : ['🛍️', 'طلبك جاهز للاستلام', 'تفضل للمحل واذكر رقم الطلب'],
    completed: ['🎉', 'بالعافية!', o.points_earned ? `ربحت <b>${fmt(o.points_earned)}</b> نقطة · رصيدك ${fmt(track.points)} نقطة` : 'شكراً لطلبك المباشر'],
    rejected: ['😔', 'عذراً، ما كدرنا نقبل الطلب', esc(o.reject_reason || '')],
  }[o.status];
  document.title = `${hero[1]} · ${r.name}`;
  $('#app').innerHTML = `
  <div class="page">
    <header class="topbar"><a class="icon-btn" href="#/" aria-label="المنيو">${icon('back')}</a><h1>طلب #${o.number}</h1><span class="tb-sp"></span></header>
    <div class="co">
      <section class="card track-hero st-${o.status}">
        <div class="t-emo">${hero[0]}</div>
        <h2>${hero[1]}</h2>
        <p>${hero[2]}</p>
        ${o.status !== 'rejected' ? `<ol class="steps">${steps.map((s, i) => `<li class="${i < idx ? 'done' : i === idx ? 'now' : ''}"><i>${i < idx ? icon('check') : ''}</i><span>${s[1]}</span></li>`).join('')}</ol>` : ''}
      </section>
      <div class="contact">
        <a class="btn ghost" href="tel:${esc(r.phone)}">${icon('phone')} اتصال</a>
        ${r.whatsapp ? `<a class="btn ghost" href="${wa(r.whatsapp)}?text=${encodeURIComponent(`مرحبا، بخصوص طلبي رقم ${o.number}`)}" target="_blank" rel="noopener">${icon('chat')} واتساب</a>` : ''}
      </div>
      <div id="install-slot">${installCard(true)}</div>
      <section class="card">
        <div class="card-h"><h2>تفاصيل الطلب</h2><span class="badge">${o.type === 'delivery' ? 'توصيل' : o.type === 'pickup' ? 'استلام' : 'طاولة ' + esc(o.table)}</span></div>
        ${o.lines.map(l => `<div class="line ro"><div class="l-main"><b>${l.qty}× ${esc(l.name)}</b>${l.choices.length ? `<small>${esc(l.choices.join('، '))}</small>` : ''}</div><b class="l-total num">${fmt(l.unit * l.qty)}</b></div>`).join('')}
        <div class="sum"><span>المجموع</span><b class="num">${fmt(o.subtotal)}</b></div>
        ${o.delivery_fee ? `<div class="sum"><span>التوصيل</span><b class="num">${fmt(o.delivery_fee)}</b></div>` : ''}
        ${o.discount ? `<div class="sum ok"><span>الخصم</span><b class="num" dir="ltr">−${fmt(o.discount)}</b></div>` : ''}
        <div class="sum grand"><span>الإجمالي</span><b class="num">${fmt(o.total)} <small>${esc(r.currency)}</small></b></div>
        ${o.address?.area ? `<p class="hint">${icon('pin')} ${esc(o.address.area)} — ${esc(o.address.details)}</p>` : ''}
      </section>
      ${['completed', 'rejected'].includes(o.status) ? `<button class="btn primary lg block" data-act="reorder-track">اطلب نفس الطلب مرة ثانية</button>` : ''}
      <a class="btn ghost block" href="#/">العودة للمنيو</a>
    </div>
  </div>`;
}

/* ---------- التثبيت على الشاشة الرئيسية ---------- */
function installCard(show) {
  if (!show || !PWA.canInstall() || store.get('install-dismissed', 0) > Date.now()) return '';
  return `<div class="install-card">
    <div class="ic-icon">${R.logo ? `<img src="${esc(R.logo)}" alt="">` : '📲'}</div>
    <div class="ic-body"><b>ثبّت ${esc(R.name)} على تلفونك</b><span>اطلب بضغطة وحدة من الشاشة الرئيسية</span></div>
    <button class="btn primary sm" data-act="install">تثبيت</button>
    <button class="icon-btn ic-x" data-act="install-x" aria-label="إخفاء">${icon('x')}</button>
  </div>`;
}

/* ---------- طلباتي ---------- */
function viewOrders() {
  $('#app').innerHTML = `
  <div class="page">
    <header class="topbar"><a class="icon-btn" href="#/" aria-label="رجوع">${icon('back')}</a><h1>طلباتي</h1><span class="tb-sp"></span></header>
    <div class="co">
      ${st.orders.length ? st.orders.map((o, i) => `<section class="card past">
        <a href="#/order/${o.id}/${o.token}" class="past-main"><b>طلب #${o.number}</b><span class="muted">${new Date(o.at).toLocaleDateString('ar-IQ-u-nu-latn', { day: 'numeric', month: 'long' })} · ${timeOf(o.at)}</span>
          <span class="muted small">${esc(o.items.map(x => byId[x.itemId]?.name).filter(Boolean).join('، '))}</span></a>
        <div class="past-side"><b class="num">${moneyT(o.total)}</b><button class="btn soft sm" data-act="reorder" data-i="${i}">اطلب مرة ثانية</button></div>
      </section>`).join('') : `<div class="empty-state"><div class="t-emo">🧾</div><p>ما عندك طلبات سابقة على هذا الجهاز</p><a class="btn primary" href="#/">تصفّح المنيو</a></div>`}
    </div>
  </div>`;
}
function reorder(items) {
  let added = 0, skipped = 0;
  for (const x of items) {
    const it = byId[x.itemId];
    if (!it || !it.available) { skipped++; continue; }
    const valid = new Set(it.options.flatMap(g => g.choices.map(c => c.id)));
    addToCart(it.id, x.qty, (x.choices || []).filter(c => valid.has(c)), x.note || '');
    added++;
  }
  if (!added) return toast('الأصناف غير متوفرة حالياً', 'bad');
  if (skipped) toast(`${skipped} صنف غير متوفر حالياً وما انضاف`);
  location.hash = '#/checkout';
}

/* ---------- الأحداث ---------- */
const A = {
  share: async () => {
    const data = { title: R.name, text: `اطلب من ${R.name} مباشرة`, url: PWA.storeUrl(slug) };
    try { if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(data.url); toast('تم نسخ الرابط ✓', 'ok'); } } catch { /* أُلغيت المشاركة */ }
  },
  mode: el => { st.mode = el.dataset.v; store.set('mode', st.mode); viewMenu(); },
  'co-mode': el => { st.mode = el.dataset.v; store.set('mode', st.mode); viewCheckout(); },
  tab: (el, e) => { e.preventDefault(); const s = $(`#c${el.dataset.id}`); if (s) window.scrollTo({ top: s.getBoundingClientRect().top + scrollY - 64, behavior: 'smooth' }); },
  item: el => openItem(+el.dataset.id),
  'sheet-bg': (el, e) => { if (e.target === el) closeSheet(); },
  'sheet-close': () => closeSheet(),
  sq: el => { sheetQty = Math.max(1, Math.min(50, sheetQty + +el.dataset.d)); updateSheet(); },
  add: () => {
    const it = sheetItem, chosen = sheetChoices();
    for (const g of it.options) if (g.required && !g.choices.some(c => chosen.includes(c.id))) return toast(`اختر "${g.name}"`, 'bad');
    addToCart(it.id, sheetQty, chosen, ($('#opts [name=note]').value || '').trim());
    closeSheet(); refreshMenu();
    toast(`انضاف ${it.name} للسلة`, 'ok');
  },
  lq: el => {
    const l = st.cart[+el.dataset.i];
    l.qty += +el.dataset.d;
    if (l.qty <= 0) st.cart.splice(+el.dataset.i, 1);
    st.coupon = null; saveCart();
    if (!st.cart.length) { location.hash = '#/'; return; }
    viewCheckout();
  },
  locate: () => {
    if (!navigator.geolocation) return toast('المتصفح لا يدعم تحديد الموقع', 'bad');
    $('#loc-label').textContent = 'جاري تحديد موقعك…';
    navigator.geolocation.getCurrentPosition(
      pos => { st.loc = { lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6) }; $('#loc-label').textContent = 'تم تحديد موقعك ✓'; },
      () => { $('#loc-label').textContent = 'أرسل موقعي الحالي (اختياري)'; toast('ما كدرنا نحدد موقعك — اكتب العنوان بالتفصيل', 'bad'); },
      { enableHighAccuracy: true, timeout: 12000 });
  },
  coupon: async () => {
    const code = $('#f-coupon').value.trim();
    if (!code) return toast('اكتب كود الخصم', 'bad');
    try { st.coupon = await api(`/store/${slug}/coupon`, { method: 'POST', body: { code, subtotal: subtotal() } }); toast(`${st.coupon.label} ✓`, 'ok'); viewCheckout(); }
    catch (e) { toast(e.message, 'bad'); }
  },
  'coupon-clear': () => { st.coupon = null; viewCheckout(); },
  redeem: el => { st.redeem = el.checked; refreshCheckout(); },
  place: () => placeOrder(),
  install: async () => {
    const r = await PWA.install();
    if (r === 'ios') {
      $('#sheet-root').innerHTML = `<div class="sheet-bg" data-act="sheet-bg"><div class="sheet ios-sheet" role="dialog" aria-modal="true" aria-label="التثبيت على الآيفون">
        <div class="sheet-body"><h2>ثبّت ${esc(R.name)} على الآيفون</h2>${PWA.iosSteps}</div>
        <div class="sheet-foot"><button class="btn primary lg grow" data-act="sheet-close">فهمت</button></div></div></div>`;
      document.body.classList.add('locked');
      requestAnimationFrame(() => $('.sheet-bg')?.classList.add('in'));
    }
  },
  'install-x': () => { store.set('install-dismissed', Date.now() + 7 * DAY_MS); $$('#install-slot').forEach(s => { s.innerHTML = ''; }); },
  reorder: el => reorder(st.orders[+el.dataset.i].items),
  'reorder-track': () => reorder(track.order.lines.map(l => {
    const it = byId[l.itemId];
    const ids = it ? it.options.flatMap(g => g.choices.filter(c => l.choices.includes(c.name)).map(c => c.id)) : [];
    return { itemId: l.itemId, qty: l.qty, choices: ids, note: l.note };
  })),
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  if (el.dataset.act === 'redeem') return; // يُعالج بحدث change
  A[el.dataset.act]?.(el, e);
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.act === 'redeem') A.redeem(el);
  if (el.closest('#opts')) updateSheet();
  if (el.dataset.bind === 'area') { st.profile.area = el.value; store.set('profile', st.profile); refreshCheckout(); }
});
let phoneTimer = null;
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.in === 'q') { st.q = el.value; const m = $('#menu'); if (m) { m.innerHTML = menuHtml(); spy(); } const pop = $('.popular'); if (pop) pop.classList.toggle('hidden', !!st.q.trim()); }
  if (el.dataset.bind && el.dataset.bind !== 'area') {
    st.profile[el.dataset.bind] = el.value;
    el.classList.remove('err');
    store.set('profile', st.profile);
    if (el.dataset.bind === 'phone') {
      clearTimeout(phoneTimer);
      phoneTimer = setTimeout(() => { st.redeem = false; loadPoints().then(refreshCheckout); }, 450);
    }
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
window.addEventListener('hashchange', route);

/* ---------- البدء ---------- */
async function reloadStore() {
  const data = await api(`/store/${slug}`);
  R = data.restaurant; CATS = data.categories; ITEMS = data.items;
  byId = Object.fromEntries(ITEMS.map(i => [i.id, i]));
  const before = st.cart.length;
  st.cart = st.cart.filter(l => byId[l.itemId] && byId[l.itemId].available);
  if (st.cart.length !== before) { saveCart(); toast('بعض الأصناف بسلتك نفدت وانشالت'); }
  if ($('#summary')) refreshCheckout();
}
(async function boot() {
  try {
    await reloadStore();
  } catch (e) {
    $('#app').innerHTML = `<div class="empty-state full"><div class="t-emo">🍽️</div><h1>${e.status === 404 ? 'المتجر غير موجود' : 'تعذّر التحميل'}</h1><p class="muted">${esc(e.message)}</p><a class="btn primary" href="../">الرئيسية</a></div>`;
    return;
  }
  document.documentElement.style.setProperty('--brand', R.color);
  $('meta[name=theme-color]').content = R.color;
  $('#manifest').href = PWA.demo ? `manifest-${slug}.webmanifest` : `manifest.webmanifest?r=${encodeURIComponent(slug)}`;
  $('meta[name=apple-mobile-web-app-title]').content = R.name;
  document.title = `${R.name} — اطلب مباشرة`;
  route();
})();
document.addEventListener('pwa:installable', () => { const s = $('#install-slot'); if (s) s.innerHTML = installCard(true); });
document.addEventListener('pwa:installed', () => { const s = $('#install-slot'); if (s) s.innerHTML = ''; toast('تم التثبيت ✓ — تلكاه على شاشتك الرئيسية', 'ok'); });
