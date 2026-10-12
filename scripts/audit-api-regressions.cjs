// Isolated route tests: no database, outbound email, cron, or external requests.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const response = {
  json: (body, options = {}) => ({ status: options.status ?? 200, body }),
  redirect: location => ({ status: 307, location: String(location) }),
};
function load(file, mocks = {}) {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const requireMock = name => {
    if (name === 'next/server') return { NextResponse: response };
    if (name in mocks) return mocks[name];
    if (name.startsWith('@/lib/model/')) return load(path.join('src', name.slice(2) + '.ts'), mocks);
    if (name === '@/lib/regions') return { getSiteUrl: () => 'https://foxzil.com', isValidRegionCode: code => ['us', 'US', 'au', 'AU'].includes(code), getRegionConfig: code => ({ country: ['AU', 'au'].includes(code) ? 'AU' : 'US' }) };
    throw new Error(`Unexpected dependency: ${name}`);
  };
  vm.runInNewContext(js, { exports, require: requireMock, console: { error() {}, warn() {} }, URL, URLSearchParams, Response, Date, process });
  return exports;
}
function request(body, url = 'https://foxzil.com/api/test') { return { json: async () => body, url, nextUrl: new URL(url) }; }
(async () => {
  let writes = 0;
  const alertMocks = {
    '@/lib/db/product-alerts': { createOrUpdateProductAlert: async () => { writes++; return { alert: { email: 'audit@example.com', token: 'test' }, needsConfirmation: true }; } },
    '@/lib/db/products': { getProductById: async () => ({ title: 'Test item', currency: 'USD', regionCodes: ['US'] }) },
    '@/lib/email': { sendMail: async () => false, confirmProductAlertEmail: () => ({ subject: 'test', html: 'test' }) },
  };
  const alerts = load('src/app/api/product-alerts/route.ts', alertMocks);
  const valid = { email: 'audit@example.com', productId: 1, targetPrice: 20, consent: true, country: 'us' };
  assert.equal((await alerts.POST(request(valid))).status, 500, 'failed confirmation email must not report success');
  for (const productId of [true, 1.5, '1', null]) assert.equal((await alerts.POST(request({ ...valid, productId }))).status, 400);
  assert.equal(writes, 1, 'invalid submissions never reach persistence');
  const failedDb = load('src/app/api/product-alerts/route.ts', { ...alertMocks, '@/lib/db/products': { getProductById: async () => { throw new Error('offline'); } } });
  assert.equal((await failedDb.POST(request(valid))).status, 500, 'DB outage returns a handled form error');
  const unsubscribe = load('src/app/api/product-alerts/unsubscribe/route.ts', { '@/lib/db/product-alerts': { unsubscribeProductAlert: async () => false } });
  assert.match((await unsubscribe.GET(request(null, 'https://foxzil.com/api/product-alerts/unsubscribe?token=missing&country=ZZ'))).location, /\/us\?alert=invalid$/);
  assert.equal((await unsubscribe.POST(request({ token: 'missing' }))).status, 404);
  const confirmed = load('src/app/api/product-alerts/confirm/route.ts', { '@/lib/db/product-alerts': { confirmProductAlert: async () => ({ market: 'AU', productId: 42 }) } });
  assert.equal((await confirmed.GET(request(null, 'https://foxzil.com/api/product-alerts/confirm?token=test&country=us'))).location, 'https://foxzil.com/au/product/42?alert=confirmed');
  let rootDestination;
  const root = load('src/app/page.tsx', {
    'next/headers': { headers: () => new Headers(), cookies: () => ({ get: () => undefined }) },
    'next/navigation': { redirect: url => { rootDestination = url; } },
    '@/lib/geo': { getUserCountry: async () => ({ country: 'ZZ' }) },
  });
  // Supply Headers only through the mock's closure; no ambient network operations.
  await root.default({ searchParams: { gclid: 'test', search: 'boots', tag: ['a', 'b'] } });
  assert.equal(rootDestination, '/us?gclid=test&search=boots&tag=a&tag=b');
  console.log('PASS: alert email failure, numeric validation, DB failure, invalid unsubscribe, confirmation region and root redirect execution');
})().catch(error => { console.error(error); process.exitCode = 1; });
