'use strict';
/* سُفرة — دعم تطبيق الموبايل (PWA): التثبيت على الشاشة الرئيسية والعمل بدون إنترنت */
(function () {
  const ROOT = new URL('../', location.href).href; // صفحات المتجر واللوحة داخل مجلد فرعي
  let deferred = null;
  const PWA = {
    ROOT,
    demo: !!window.SUFRA_DEMO,
    isStandalone: matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
    isIOS: /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
    canInstall() { return !this.isStandalone && (!!deferred || this.isIOS); },
    async install() {
      if (deferred) {
        deferred.prompt();
        const choice = await deferred.userChoice.catch(() => ({ outcome: 'dismissed' }));
        deferred = null;
        return choice.outcome;
      }
      return this.isIOS ? 'ios' : 'unavailable';
    },
    storeUrl(slug, table) {
      const t = table ? `${this.demo ? '&' : '?'}t=${encodeURIComponent(table)}` : '';
      return this.demo ? `${ROOT}store/?r=${slug}${t}` : `${ROOT}r/${slug}${t}`;
    },
    iosSteps: `<ol class="ios-steps">
      <li>اضغط زر <b>المشاركة</b> <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m16 6-4-4-4 4M12 2v13"/></svg> بأسفل سفاري</li>
      <li>اختر <b>"إضافة إلى الشاشة الرئيسية"</b></li>
      <li>اضغط <b>"إضافة"</b> — وراح تظهر الأيقونة مثل أي تطبيق</li></ol>`,
  };
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; document.dispatchEvent(new Event('pwa:installable')); });
  addEventListener('appinstalled', () => { deferred = null; PWA.isStandalone = true; document.dispatchEvent(new Event('pwa:installed')); });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    addEventListener('load', () => navigator.serviceWorker.register(ROOT + 'sw.js', { scope: new URL(ROOT).pathname }).catch(() => { /* غير مدعوم */ }));
  }
  window.PWA = PWA;
})();
