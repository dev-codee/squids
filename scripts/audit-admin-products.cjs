// Isolated admin route regression tests. No database or email connections.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript'), assert = require('node:assert/strict');
function loader(mocks) {
 const cache = new Map();
 function load(file) {
  file = path.resolve(file); if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const requireMock = name => {
   if (name === 'next/server') return { NextResponse: { json: (body, opts = {}) => ({ body, status: opts.status || 200 }) } };
   if (name in mocks) return mocks[name];
   if (name.startsWith('node:')) return require(name);
   if (name.startsWith('@/')) return load(path.resolve('src', name.slice(2) + '.ts'));
   if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name + '.ts'));
   throw Error(`Unexpected dependency ${name}`);
  };
  vm.runInNewContext(code, { exports, require: requireMock, console, URL, Date, process }); return exports;
 }
 return load;
}
const req = (body, url = 'http://localhost/api/admin/products') => ({ json: async () => body, url, nextUrl: new URL(url) });
(async () => {
 const original = { id: 1, advertiserId: 42, network: 'awin', regionCodes: ['AU'], currency: 'AUD', title: 'Serum', brand: 'Example', mpn: 'SERUM', size: '30 ml', colour: 'Clear', packCount: 1, salePrice: 20, inStock: true, specifications: [{ label: 'Bottle', value: 'Glass' }] };
 const fixture = { ...original, id: 2, advertiserId: 999, network: 'demo', title: '[DEMO] Serum', demo: { fixtureSet: 'beauty-amora-review-v1', retailerName: 'Demo shop', deliveryRule: null } };
 const records = new Map([[1, original], [2, fixture]]), observations = [], history = new Map();
 const mocks = {
  '@/lib/db/products': { getProductById: async id => records.get(id) || null, getNextProductId: async () => 50, createProduct: async p => { if (records.has(p.id)) throw { code: 11000 }; records.set(p.id, p); return p; }, updateProduct: async (id, patch) => { if (!records.has(id)) return false; records.set(id, { ...records.get(id), ...patch }); return true; }, deleteProduct: async id => records.delete(id) },
  '@/lib/db/price-observations': { recordPriceObservation: async o => observations.push(o) },
  '@/lib/cache': { CACHE_TAGS: {}, revalidatePublic() {} },
  '@/lib/mongodb': { getDb: async () => ({ collection: name => name === 'advertisers' ? { find: () => ({ limit: () => ({ toArray: async () => [{ id: 42, network: 'awin', countryCode: 'AU', currencyCode: 'AUD' }] }) }) } : { findOne: async f => { const o = history.get(f.id); return o && o.productId === f.productId && o.market === f.market ? o : null; }, insertOne: async o => history.set(o.id, o), updateOne: async () => ({ matchedCount: 1 }) } }) },
  '@/lib/db/merchant-markets': { getMerchantMarketForMerchant: async () => null, upsertMerchantMarket: async () => { throw Error('Should not create real merchant in demo test'); } },
  '@/lib/db/delivery': { getDeliveryRules: async () => [], upsertDeliveryRule: async () => { throw Error('Should not write real delivery in demo test'); }, deleteDeliveryRule: async () => { throw Error('Should not delete real delivery in demo test'); } },
 };
 const load = loader(mocks), api = load('src/app/api/admin/products/route.ts');
 let r = await api.PUT(req({ id: 1, description: 'Updated description', specifications: [{ label: 'Bottle', value: 'Recycled glass' }] }));
 assert.equal(r.status, 200); assert.equal(records.get(1).brand, 'Example'); assert.equal(records.get(1).specifications[0].value, 'Recycled glass'); assert.equal(observations.length, 0);
 r = await api.PUT(req({ id: 1, salePrice: '19.50' })); assert.equal(r.status, 200); assert.equal(observations.length, 1);
 r = await api.POST(req({ ...original, title: 'Must not overwrite' })); assert.equal(r.status, 409); assert.equal(records.get(1).title, 'Serum');
 r = await api.POST(req({ ...original, id: 60, copyFrom: 1, copyKind: 'offer' })); assert.equal(r.status, 400);
 r = await api.POST(req({ ...records.get(1), id: 60, copyFrom: 1, copyKind: 'variant' })); assert.equal(r.status, 400);
 r = await api.POST(req({ ...records.get(1), id: 60, copyFrom: 1, copyKind: 'variant', size: '60 ml', title: 'Serum 60 ml' })); assert.equal(r.status, 201);
 r = await api.PUT(req({ id: 2, description: 'Demo edit' })); assert.equal(r.status, 200); assert.equal(records.get(2).demo.fixtureSet, 'beauty-amora-review-v1');
 r = await api.PUT(req({ id: 2, title: 'Unlabelled demo' })); assert.equal(r.status, 400);
 r = await api.DELETE(req(null, 'http://localhost/api/admin/products?id=1junk')); assert.equal(r.status, 400); assert.ok(records.has(1));
 const prices = load('src/app/api/admin/product-history/route.ts');
 const point = { productId: 2, market: 'AU', itemPrice: '18', reviewedBy: 'Test reviewer', observedAt: '2026-01-01T12:00:00Z' };
 r = await prices.POST(req(point)); assert.equal(r.status, 200); assert.equal(history.size, 1);
 r = await prices.POST(req({ ...point, productId: 1 })); assert.equal(r.status, 400, 'real observations need a source URL');
 r = await prices.POST(req({ ...point, observedAt: '2999-01-01' })); assert.equal(r.status, 400);
 r = await prices.PATCH(req({ ...point, id: [...history.keys()][0], productId: 1, sourceUrl: 'https://example.com', reason: 'Correct price' })); assert.equal(r.status, 404, 'cannot correct another product history');
 const delivery = load('src/app/api/admin/product-delivery/route.ts');
 r = await delivery.PUT(req({ productId: 2, market: 'AU', charge: '0', mandatoryFees: '0', freeThreshold: '', taxIncluded: true, checkedBy: 'Reviewer' })); assert.equal(r.status, 200); assert.equal(records.get(2).demo.deliveryRule.charge.value, 0);
 r = await delivery.PUT(req({ productId: 2, market: 'US', remove: true })); assert.equal(r.status, 400);
 console.log('PASS: product content, partial edits, price observations, duplicate-ID protection, variant/offer validation, demo preservation, scoped history corrections and delivery isolation');
})().catch(e => { console.error(e); process.exitCode = 1; });
