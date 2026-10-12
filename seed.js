'use strict';
/* بيانات تجريبية: مطعم + كافيه مع زبائن وطلبات لآخر 60 يوم */

function rng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const NAMES = ['أحمد', 'علي', 'حسين', 'مصطفى', 'زينب', 'فاطمة', 'مريم', 'حيدر', 'عباس', 'نور', 'سارة', 'محمد', 'يوسف', 'رقية',
  'كرار', 'منتظر', 'هدى', 'دعاء', 'أمير', 'ياسر', 'زهراء', 'مرتضى', 'آية', 'سجاد', 'تبارك', 'حسن', 'رسل', 'عمر', 'ضحى', 'باقر',
  'أنور', 'شهد', 'ليث', 'ملاك', 'سيف', 'بنين', 'جعفر', 'إسراء', 'وسام', 'غدير'];
const FAMILY = ['العبيدي', 'الجبوري', 'الربيعي', 'الساعدي', 'التميمي', 'الخفاجي', 'الدليمي', 'الموسوي', 'الحسيني', 'الكعبي', 'الزبيدي', 'العامري'];

const opt = (id, name, required, multi, choices) => ({ id, name, required, multi, choices: choices.map(([cid, n, p]) => ({ id: cid, name: n, price: p })) });
const SIDES = opt('side', 'أضف جانبي', false, true, [['rice', 'تمن', 1500], ['salad', 'سلطة', 1000], ['fries', 'بطاطا', 1500]]);

const RESTAURANTS = [
  {
    slug: 'beit-baghdad', name: 'مطعم بيت بغداد', phone: '07700000001', owner: 'أبو علي',
    settings: {
      tagline: 'أكلات بغدادية أصيلة على الفحم', color: '#c2410c', whatsapp: '07700000001', address: 'المنصور، شارع 14 رمضان',
      hours: { open: '10:00', close: '04:00' },
      delivery: { enabled: true, minOrder: 10000, eta: 40, areas: [
        { name: 'المنصور', fee: 1500 }, { name: 'اليرموك', fee: 2000 }, { name: 'الحارثية', fee: 2000 }, { name: 'حي الجامعة', fee: 2500 },
        { name: 'الكرادة', fee: 3000 }, { name: 'زيونة', fee: 3500 }, { name: 'الأعظمية', fee: 3500 }] },
      pickup: { enabled: true, eta: 20 }, dineIn: { enabled: true },
      loyalty: { enabled: true, per: 1000, rewardPoints: 150, rewardValue: 7500 }, commissionPct: 20,
    },
    hours: [[11, 3], [12, 6], [13, 9], [14, 9], [15, 5], [16, 4], [17, 4], [18, 6], [19, 9], [20, 12], [21, 11], [22, 8], [23, 4], [0, 2]],
    types: [['delivery', 0.55], ['pickup', 0.3], ['dine', 0.15]],
    customers: 340,
    menu: [
      ['مشويات', [
        ['تكة لحم', 'سيخين تكة غنم طازجة مع صمون حجري وطماطة مشوية', 12000, '🍢', 1, [SIDES]],
        ['كباب', 'كباب بغدادي على الفحم مع بصل وسماق وصمون', 10000, '🍢', 1, [SIDES]],
        ['تكة دجاج', 'صدر دجاج متبّل بالثوم والليمون', 8000, '🍗', 0, [SIDES]],
        ['مسگوف', 'سمك شبوط على الحطب مع عمبة وطماطة', 25000, '🐟', 0, [opt('size', 'الحجم', true, false, [['kg', 'كيلو', 0], ['kg15', 'كيلو ونص', 12000]])]],
      ]],
      ['أطباق رئيسية', [
        ['قوزي على تمن', 'لحم غنم مطبوخ ببطء على تمن بالكرزات والزبيب', 18000, '🍖', 1, []],
        ['تمن ومرق', 'تمن عنبر مع مرق حسب اختيارك', 6000, '🍛', 0, [opt('marag', 'نوع المرق', true, false, [['fas', 'فاصوليا', 0], ['bam', 'بامية', 1000], ['qem', 'قيمة', 500]])]],
        ['دولمة', 'دولمة عراقية مشكلة بورق العنب والخضار', 9000, '🫑', 0, []],
      ]],
      ['سندويچات', [
        ['لفة شاورما دجاج', 'شاورما دجاج بصمون حار مع ثومية وطرشي', 3000, '🌯', 1, [
          opt('size', 'الحجم', true, false, [['n', 'عادي', 0], ['d', 'دبل', 1500]]),
          opt('extra', 'إضافات', false, true, [['cheese', 'جبن', 500], ['hot', 'حار', 0], ['fr', 'بطاطا داخل اللفة', 250]])]],
        ['صحن شاورما', 'شاورما دجاج مع بطاطا وثومية وصمون', 8000, '🥙', 0, []],
        ['برگر لحم', 'لحم بقري مشوي مع جبن شيدر وخس', 7000, '🍔', 0, [opt('combo', 'الوجبة', true, false, [['s', 'سندويچ فقط', 0], ['m', 'وجبة مع بطاطا ومشروب', 2500]])]],
      ]],
      ['مقبلات', [
        ['بطاطا مقلية', 'مقرمشة مع كاتشب', 2500, '🍟', 0, []],
        ['حمص بطحينة', 'مع زيت زيتون وصمون حار', 3000, '🫘', 0, []],
        ['سلطة خضراء', 'خيار وطماطة وخس بالليمون', 3000, '🥗', 0, []],
      ]],
      ['مشروبات', [
        ['شاي عراقي', 'استكان شاي مهيّل', 500, '🍵', 0, []],
        ['عصير برتقال', 'طازج يومياً', 3000, '🍊', 0, [opt('size', 'الحجم', true, false, [['m', 'وسط', 0], ['l', 'كبير', 1000]])]],
        ['لبن', 'لبن عربيل بارد', 1000, '🥛', 0, []],
        ['مشروب غازي', 'بيبسي، سفن أب، ميرندا', 1000, '🥤', 0, [opt('kind', 'النوع', true, false, [['p', 'بيبسي', 0], ['7', 'سفن أب', 0], ['m', 'ميرندا', 0]])]],
      ]],
    ],
  },
  {
    slug: 'rasif', name: 'قهوة الرصيف', phone: '07700000002', owner: 'سارة',
    settings: {
      tagline: 'قهوة مختصة ومحمّصة يومياً', color: '#8a5a3c', whatsapp: '07700000002', address: 'الكرادة داخل، قرب ساحة كهرمانة',
      hours: { open: '07:00', close: '02:00' },
      delivery: { enabled: true, minOrder: 8000, eta: 30, areas: [{ name: 'الكرادة', fee: 1500 }, { name: 'الجادرية', fee: 2000 }, { name: 'العرصات', fee: 2000 }, { name: 'زيونة', fee: 3000 }] },
      pickup: { enabled: true, eta: 10 }, dineIn: { enabled: true },
      loyalty: { enabled: true, per: 1000, rewardPoints: 60, rewardValue: 5000 }, commissionPct: 20,
    },
    hours: [[8, 6], [9, 9], [10, 7], [11, 5], [12, 4], [13, 4], [14, 4], [15, 5], [16, 8], [17, 9], [18, 9], [19, 8], [20, 7], [21, 6], [22, 4], [23, 2]],
    types: [['delivery', 0.25], ['pickup', 0.35], ['dine', 0.4]],
    customers: 260,
    menu: [
      ['قهوة ساخنة', [
        ['سبانش لاتيه', 'إسبريسو مع حليب مكثف محلّى', 6000, '☕', 1, [
          opt('size', 'الحجم', true, false, [['m', 'وسط', 0], ['l', 'كبير', 1000]]),
          opt('milk', 'الحليب', true, false, [['reg', 'عادي', 0], ['oat', 'شوفان', 1000], ['lf', 'خالي اللاكتوز', 750]]),
          opt('extra', 'إضافات', false, true, [['shot', 'شوت إضافي', 1000], ['van', 'فانيلا', 750], ['car', 'كراميل', 750]])]],
        ['لاتيه', 'إسبريسو مع حليب مبخّر', 5000, '☕', 0, [
          opt('size', 'الحجم', true, false, [['m', 'وسط', 0], ['l', 'كبير', 1000]]),
          opt('milk', 'الحليب', true, false, [['reg', 'عادي', 0], ['oat', 'شوفان', 1000], ['lf', 'خالي اللاكتوز', 750]])]],
        ['كابتشينو', 'رغوة كثيفة ورشة كاكاو', 5000, '☕', 0, [opt('size', 'الحجم', true, false, [['m', 'وسط', 0], ['l', 'كبير', 1000]])]],
        ['إسبريسو', 'محصول إثيوبي بنكهة الفواكه', 3000, '☕', 0, [opt('size', 'الحجم', true, false, [['s', 'سنگل', 0], ['d', 'دبل', 1000]])]],
        ['قهوة تركية', 'مع هيل', 3000, '☕', 0, [opt('sugar', 'السكر', true, false, [['0', 'سادة', 0], ['1', 'وسط', 0], ['2', 'حلوة', 0]])]],
      ]],
      ['قهوة باردة', [
        ['آيس لاتيه', 'إسبريسو مع حليب بارد وثلج', 6000, '🧋', 1, [opt('milk', 'الحليب', true, false, [['reg', 'عادي', 0], ['oat', 'شوفان', 1000]]), opt('extra', 'إضافات', false, true, [['shot', 'شوت إضافي', 1000], ['car', 'كراميل', 750]])]],
        ['آيس أمريكانو', 'منعش ومركّز', 4500, '🧊', 0, []],
        ['فرابتشينو كراميل', 'مخفوق قهوة بالكراميل والكريمة', 7000, '🥤', 1, []],
      ]],
      ['مشروبات أخرى', [
        ['ماتشا لاتيه', 'ماتشا ياباني مع حليب', 7000, '🍵', 0, [opt('temp', 'الحرارة', true, false, [['h', 'ساخن', 0], ['i', 'بارد', 0]])]],
        ['شاي كرك', 'بالهيل والزعفران', 2500, '🫖', 0, []],
        ['هوت شوكليت', 'شوكولاتة بلجيكية', 5000, '🍫', 0, []],
        ['ليموناضة نعناع', 'ليمون طازج ونعناع', 4000, '🍋', 0, []],
      ]],
      ['حلويات', [
        ['تشيز كيك', 'نيويورك تشيز كيك بصوص التوت', 6000, '🍰', 1, []],
        ['براوني', 'دافئ مع صوص شوكولاتة', 4000, '🍫', 0, []],
        ['كرواسون زبدة', 'مخبوز صباحياً', 3000, '🥐', 0, [opt('fill', 'الحشوة', false, false, [['ch', 'جبن', 1000], ['za', 'زعتر', 500], ['nu', 'نوتيلا', 1500]])]],
        ['كوكيز', 'بقطع الشوكولاتة', 2000, '🍪', 0, []],
      ]],
    ],
  },
];

exports.seed = ({ run, all, tx, hashPass, dayStart, DAY, TZ, token }) => {
  const R = rng(20261012);
  const wpick = ws => { let r = R() * ws.reduce((a, b) => a + b, 0); for (let i = 0; i < ws.length; i++) { r -= ws[i]; if (r <= 0) return i; } return ws.length - 1; };
  const now = Date.now();

  tx(() => RESTAURANTS.forEach(def => {
    const s = def.settings;
    const rid = run('INSERT INTO restaurants (slug, name, phone, owner_name, pass, settings, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      def.slug, def.name, def.phone, def.owner, hashPass('demo1234'), JSON.stringify(s), now - 70 * DAY).lastInsertRowid;
    def.menu.forEach(([cat, items], ci) => {
      const cid = run('INSERT INTO categories (restaurant_id, name, sort) VALUES (?, ?, ?)', rid, cat, ci).lastInsertRowid;
      items.forEach(([name, desc, price, emoji, popular, options], ii) => run(
        'INSERT INTO items (restaurant_id, category_id, name, description, price, emoji, popular, options, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        rid, cid, name, desc, price, emoji, popular, JSON.stringify(options), ci * 100 + ii));
    });
    run("INSERT INTO coupons (restaurant_id, code, kind, value, min_order) VALUES (?, 'WELCOME', 'pct', 10, 8000)", rid);
    run("INSERT INTO coupons (restaurant_id, code, kind, value, min_order, max_uses) VALUES (?, 'BACK5', 'fixed', 5000, 20000, 300)", rid);

    const items = all('SELECT * FROM items WHERE restaurant_id = ?', rid).map(i => ({ ...i, options: JSON.parse(i.options) }));
    const weights = items.map(i => (i.popular ? 4 : 1 + R() * 1.3));
    const hourW = def.hours.map(h => h[1]);
    const atHour = t => {
      const h = def.hours[wpick(hourW)][0];
      return dayStart(t) + (h < 5 ? h + 24 : h) * 36e5 + Math.floor(R() * 36e5) - (h < 5 ? DAY : 0);
    };

    // الزبائن وأنماط طلبهم
    const events = [], phones = new Set();
    for (let i = 0; i < def.customers; i++) {
      let phone;
      do phone = '07' + '785'[Math.floor(R() * 3)] + String(Math.floor(R() * 1e9)).padStart(9, '0').slice(0, 8); while (phones.has(phone));
      phones.add(phone);
      const name = NAMES[Math.floor(R() * NAMES.length)] + (R() < 0.5 ? ' ' + FAMILY[Math.floor(R() * FAMILY.length)] : '');
      const area = s.delivery.areas[Math.floor(R() * s.delivery.areas.length)].name;
      const k = R();
      const every = k < 0.22 ? 3 + R() * 5 : k < 0.62 ? 9 + R() * 16 : 0;
      const stop = every && R() < 0.3 ? now - (31 + R() * 15) * DAY : now - 45 * 60e3;
      let t = now - 60 * DAY + R() * 57 * DAY;
      if (t > stop) t = stop - R() * 6 * DAY;
      const first = atHour(t);
      const cid = run('INSERT INTO customers (restaurant_id, phone, name, area, created_at) VALUES (?, ?, ?, ?, ?)', rid, phone, name, area, Math.min(first, dayStart(t))).lastInsertRowid;
      do {
        const at = atHour(t);
        if (at < now - 45 * 60e3) events.push({ cid, at, area });
        if (!every) break;
        t += every * DAY * (0.6 + R() * 0.8);
      } while (t < stop);
    }
    events.sort((a, b) => a.at - b.at);

    const balance = {}, counted = {}, perDay = {};
    let welcomeUsed = 0, backUsed = 0;
    const mkLines = () => {
      const n = [1, 2, 3][wpick([45, 38, 17])], used = new Set(), lines = [];
      for (let i = 0; i < n; i++) {
        const it = items[wpick(weights)];
        if (used.has(it.id)) continue;
        used.add(it.id);
        let unit = it.price; const names = [];
        for (const g of it.options) {
          if (g.required || R() < 0.3) { const c = g.choices[Math.floor(R() * g.choices.length)]; unit += c.price; names.push(c.name); }
        }
        lines.push({ itemId: it.id, name: it.name, qty: R() < 0.15 ? 2 : 1, unit, choices: names, note: '' });
      }
      return lines;
    };
    const insertOrder = (e, status, extra = {}) => {
      const day = dayStart(e.at);
      perDay[day] = (perDay[day] || 0) + 1;
      const r = R();
      let acc = 0, type = 'delivery';
      for (const [tp, p] of def.types) { acc += p; if (r < acc) { type = tp; break; } }
      if (extra.type) type = extra.type;
      const lines = mkLines();
      const subtotal = lines.reduce((a, l) => a + l.unit * l.qty, 0);
      const fee = type === 'delivery' ? s.delivery.areas.find(a => a.name === e.area).fee : 0;
      let discount = 0, coupon = '', pointsUsed = 0;
      const isFirst = !counted[e.cid];
      if (isFirst && R() < 0.18 && subtotal >= 8000) { coupon = 'WELCOME'; discount = Math.round(subtotal * 0.1 / 250) * 250; welcomeUsed++; }
      else if (!isFirst && R() < 0.05 && subtotal >= 20000) { coupon = 'BACK5'; discount = 5000; backUsed++; }
      if ((balance[e.cid] || 0) >= s.loyalty.rewardPoints && R() < 0.6) {
        pointsUsed = s.loyalty.rewardPoints; discount += s.loyalty.rewardValue; balance[e.cid] -= pointsUsed;
      }
      discount = Math.min(discount, subtotal);
      const total = subtotal + fee - discount;
      const earned = status === 'completed' ? Math.floor((total - fee) / s.loyalty.per) : 0;
      if (status === 'completed') { balance[e.cid] = (balance[e.cid] || 0) + earned; counted[e.cid] = true; }
      if (status === 'rejected' && pointsUsed) balance[e.cid] += pointsUsed;
      const acceptedAt = status === 'pending' ? null : e.at + Math.round((0.5 + R() * 2.5) * 60e3);
      const eta = type === 'delivery' ? s.delivery.eta : s.pickup.eta;
      const readyAt = ['ready', 'on_way', 'completed'].includes(status) ? acceptedAt + Math.round(eta * (0.5 + R() * 0.5) * 60e3) : null;
      const doneAt = status === 'completed' ? readyAt + Math.round((type === 'delivery' ? 10 + R() * 15 : 2 + R() * 6) * 60e3) : status === 'rejected' ? e.at + 120e3 : null;
      const address = type === 'delivery' ? { area: e.area, details: ['قرب الجامع', 'زقاق 12 دار 7', 'عمارة 3 شقة 5', 'مقابل الصيدلية', 'قرب مدرسة النخيل'][Math.floor(R() * 5)] } : {};
      run(`INSERT INTO orders (restaurant_id, customer_id, number, token, type, table_no, address, lines, subtotal, delivery_fee, discount,
        points_used, points_earned, total, coupon, note, status, eta, reject_reason, created_at, accepted_at, ready_at, done_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      rid, e.cid, perDay[day], token(16), type, type === 'dine' ? String(1 + Math.floor(R() * 12)) : '', JSON.stringify(address), JSON.stringify(lines),
      subtotal, fee, discount, pointsUsed, earned, total, coupon, extra.note || '', status, acceptedAt ? extra.eta || eta : 0,
      status === 'rejected' ? ['نفدت بعض المواد', 'ضغط طلبات عالي', 'خارج منطقة التوصيل'][Math.floor(R() * 3)] : '',
      e.at, acceptedAt, readyAt, doneAt);
    };
    for (const e of events) insertOrder(e, R() < 0.04 ? 'rejected' : 'completed');

    // طلبات حيّة الآن
    const regulars = Object.keys(counted).map(Number).slice(-12);
    [['on_way', 26, 'delivery'], ['preparing', 9, 'pickup'], ['pending', 1.5, 'delivery']].forEach(([st, min, type], i) => {
      const cid = regulars[i * 3 % regulars.length];
      const area = all('SELECT area FROM customers WHERE id = ?', cid)[0].area;
      insertOrder({ cid, at: now - min * 60e3, area }, st, { type, note: i === 2 ? 'بدون بصل لطفاً' : '' });
    });

    for (const [cid, pts] of Object.entries(balance)) run('UPDATE customers SET points = ? WHERE id = ?', Math.max(0, pts), Number(cid));
    run("UPDATE coupons SET used = ? WHERE restaurant_id = ? AND code = 'WELCOME'", welcomeUsed, rid);
    run("UPDATE coupons SET used = ? WHERE restaurant_id = ? AND code = 'BACK5'", backUsed, rid);
  }));
  console.log('تم إنشاء البيانات التجريبية (مطعم بيت بغداد + قهوة الرصيف)');
};
