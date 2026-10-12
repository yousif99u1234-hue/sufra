'use strict';
/* يبني نسخة العرض الثابتة في مجلد docs/ لنشرها على GitHub Pages
   - ينسخ public/
   - يولّد بيانات تجريبية جديدة من seed.js ويصدّرها إلى demo/data.json
   - يحقن الخادم الوهمي (demo/mock.js) في صفحة المتجر ولوحة المطعم */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs');
fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'public'), OUT, { recursive: true });

const dataFile = path.join(OUT, 'demo', 'data.json');
const r = spawnSync(process.execPath, ['--no-warnings', 'server.js'], {
  cwd: ROOT, stdio: 'inherit',
  env: { ...process.env, SUFRA_DB: ':memory:', SUFRA_EXPORT: dataFile, DATA_DIR: path.join(os.tmpdir(), 'sufra-build') },
});
if (r.status !== 0) process.exit(r.status || 1);

const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
for (const [slug, m] of Object.entries(data.manifests)) {
  fs.writeFileSync(path.join(OUT, 'store', `manifest-${slug}.webmanifest`), JSON.stringify(m, null, 2));
}

for (const page of ['store/index.html', 'admin/index.html']) {
  const f = path.join(OUT, page);
  const html = fs.readFileSync(f, 'utf8').replace('<script src="../pwa.js"></script>', '<script src="../demo/mock.js"></script>\n  <script src="../pwa.js"></script>');
  fs.writeFileSync(f, html);
}
const sw = path.join(OUT, 'sw.js');
fs.writeFileSync(sw, fs.readFileSync(sw, 'utf8').replace("'sufra-v1'", `'sufra-${Date.now().toString(36)}'`));
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
console.log('✓ نسخة GitHub Pages جاهزة في docs/');
