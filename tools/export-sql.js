'use strict';
/* يولّد worker/seed.sql: المتجرين التجريبيين ببيانات تاريخية لقاعدة D1
   (بدون طلبات معلّقة حتى ما يرن التنبيه على طلبات قديمة) */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const tmp = path.join(os.tmpdir(), 'sufra-export.json');
const r = spawnSync(process.execPath, ['--no-warnings', 'server.js'], {
  cwd: ROOT, stdio: 'inherit',
  env: { ...process.env, SUFRA_DB: ':memory:', SUFRA_EXPORT: tmp, DATA_DIR: path.join(os.tmpdir(), 'sufra-build') },
});
if (r.status !== 0) process.exit(r.status || 1);
const d = JSON.parse(fs.readFileSync(tmp, 'utf8'));

const ITER = 20000;
const pbkdf2 = pw => { const salt = crypto.randomBytes(16).toString('hex'); return `pbkdf2$${ITER}$${salt}$${crypto.pbkdf2Sync(pw, Buffer.from(salt, 'hex'), ITER, 32, 'sha256').toString('hex')}`; };
const v = x => (x === null || x === undefined ? 'NULL' : typeof x === 'number' ? String(x) : `'${String(typeof x === 'object' ? JSON.stringify(x) : x).replace(/'/g, "''")}'`);
const out = ['-- بيانات تجريبية: مطعم بيت بغداد + قهوة الرصيف (كلمة المرور demo1234)'];
function insert(table, cols, rows) {
  for (let i = 0; i < rows.length; i += 40) {
    out.push(`INSERT INTO ${table} (${cols.join(', ')}) VALUES\n${rows.slice(i, i + 40).map(row => `(${cols.map(c => v(row[c])).join(', ')})`).join(',\n')};`);
  }
}
insert('restaurants', ['id', 'slug', 'name', 'phone', 'owner_name', 'pass', 'settings', 'created_at'],
  d.restaurants.map(x => ({ ...x, pass: pbkdf2('demo1234'), settings: { ...x.settings, hours: { open: '00:00', close: '00:00' } } })));
insert('categories', ['id', 'restaurant_id', 'name', 'sort'], d.categories);
insert('items', ['id', 'restaurant_id', 'category_id', 'name', 'description', 'price', 'emoji', 'image', 'available', 'popular', 'options', 'sort'], d.items);
insert('customers', ['id', 'restaurant_id', 'phone', 'name', 'area', 'points', 'created_at'], d.customers);
insert('orders', ['id', 'restaurant_id', 'customer_id', 'number', 'token', 'type', 'table_no', 'address', 'lines', 'subtotal', 'delivery_fee', 'discount',
  'points_used', 'points_earned', 'total', 'coupon', 'note', 'status', 'eta', 'reject_reason', 'created_at', 'accepted_at', 'ready_at', 'done_at'],
d.orders.filter(o => ['completed', 'rejected'].includes(o.status)));
insert('coupons', ['id', 'restaurant_id', 'code', 'kind', 'value', 'min_order', 'max_uses', 'used', 'expires_at', 'active'], d.coupons);

fs.writeFileSync(path.join(ROOT, 'worker', 'seed.sql'), out.join('\n') + '\n');
console.log(`✓ worker/seed.sql (${d.orders.length} طلب)`);
