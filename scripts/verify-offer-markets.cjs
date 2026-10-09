// Read-only MongoDB fixtures: $documents supplies offers and merchant records.
const assert = require('node:assert/strict');

module.exports = async function verifyOfferMarkets(db, publication, countries) {
  const merchants = countries.map((country, index) => ({
    id: index + 1, network: 'fixture', name: `Fixture Store ${index}`,
    status: 'active', relationship: 'joined', countryCode: country.toLowerCase(),
  }));
  const base = {
    network: 'fixture', status: 'active', type: 'voucher', code: 'SOURCECODE',
    title: 'Sourced coupon', startDate: null, endDate: null,
    trackingUrl: 'https://example.test/offer', regionCodes: [],
  };
  const offers = merchants.map((merchant) => ({
    ...base, id: merchant.id, advertiser: { id: String(merchant.id), name: merchant.name },
    isExclusive: true,
  }));
  merchants.push(
    { id: 1000, network: 'fixture', name: 'Worldwide Store', status: 'active', relationship: 'joined', countryCode: 'WW' },
    { id: 1001, network: 'fixture', name: 'Unknown Store', status: 'active', relationship: 'joined' },
    { id: 1002, network: 'fixture', name: 'Multiple Markets', status: 'active', relationship: 'joined', countryCodes: ['AU', 'FR', 'WW'] },
    { id: 1003, network: 'fixture', name: 'Locale Store', status: 'active', relationship: 'joined', countryCode: 'en_AU' },
    { id: 1004, network: 'fixture', name: 'Unjoined Store', status: 'active', relationship: 'pending', countryCode: 'AU' },
  );
  for (const id of [1000, 1001, 1002, 1003, 1004]) {
    offers.push({ ...base, id, advertiser: { id, name: merchants.find((m) => m.id === id).name } });
  }
  const au = merchants.find((merchant) => merchant.countryCode === 'au');
  const auOffer = { ...base, advertiser: { id: au.id, name: au.name } };
  offers.push(
    { ...auOffer, id: 2000, regionCodes: ['US'] },
    { ...auOffer, id: 2001, regionCodes: ['US'], reviewedRegionCodes: ['AU'] },
    { ...auOffer, id: 2002, reviewedRegionCodes: [] },
    { ...auOffer, id: 2003, endDate: '2000-01-01' },
    { ...auOffer, id: 2004, startDate: '9999-01-01' },
    { ...auOffer, id: 2005, status: 'inactive' },
    { ...auOffer, id: 2006, quarantined: true },
    { ...auOffer, id: 2007, network: 'different-network' },
    { ...auOffer, id: 2008, advertiser: { id: au.id, name: 'Mismatched Merchant' } },
    { ...auOffer, id: 2009, isBrandDeal: true },
  );
  // Replace the collection lookup with fixture merchant documents. Production
  // still uses the indexed ID join; no records are inserted by this test.
  const stages = publication.publicOfferMerchantStages().map((stage) => {
    if (!stage.$lookup) return stage;
    const { pipeline, let: variables, as } = stage.$lookup;
    return { $lookup: {
      let: { ...variables, fixtureIds: '$_publicMerchantIds' }, as,
      pipeline: [{ $documents: merchants }, { $match: { $expr: { $in: ['$id', '$$fixtureIds'] } } }, ...pipeline],
    } };
  });
  const result = await db.aggregate([{ $documents: offers }, ...stages]).toArray();
  const byId = new Map(result.map((offer) => [offer.id, offer]));
  for (const merchant of merchants.slice(0, countries.length)) {
    assert.deepEqual(byId.get(merchant.id).regionCodes, [merchant.countryCode.toUpperCase()]);
    assert.equal(byId.get(merchant.id).code, 'SOURCECODE');
    assert.equal(byId.get(merchant.id).isExclusive, true);
  }
  assert.deepEqual(byId.get(1000).regionCodes, []);
  assert.deepEqual(byId.get(1001).regionCodes, []);
  assert.deepEqual(byId.get(1002).regionCodes.sort(), ['AU', 'FR']);
  assert.deepEqual(byId.get(1003).regionCodes, ['AU']);
  assert.deepEqual(byId.get(2000).regionCodes, ['US']);
  assert.deepEqual(byId.get(2001).regionCodes, ['AU']);
  assert.deepEqual(byId.get(2002).regionCodes, []);
  for (const id of [1004, 2003, 2004, 2005, 2006, 2007, 2008, 2009]) assert(!byId.has(id), `offer ${id} must remain unpublished`);
  const facets = Object.fromEntries(countries.map((country) => [country, [
    { $match: publication.publicOfferFilter(country) }, { $project: { _id: 0, id: 1 } },
  ]]));
  const [markets] = await db.aggregate([{ $documents: offers }, ...stages, { $facet: facets }]).toArray();
  for (const country of countries) {
    const ownId = merchants.find((merchant) => merchant.countryCode === country.toLowerCase()).id;
    assert(markets[country].some((offer) => offer.id === ownId));
    assert(!markets[country].some((offer) => [1000, 1001, 2002].includes(offer.id)));
    for (const merchant of merchants.slice(0, countries.length)) {
      assert.equal(markets[country].some((offer) => offer.id === merchant.id), merchant.id === ownId);
    }
  }
  return { merchantMarketInheritance: 'passed', marketIsolation: 'passed', reviewedRestrictions: 'passed', ownershipAndLifecycle: 'passed', regionsChecked: countries.length };
};
