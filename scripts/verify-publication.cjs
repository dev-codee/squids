// Read-only regression check. Run npm test first, then node --env-file=.env.local scripts/verify-publication.cjs.
const { MongoClient } = require('mongodb');
const assert = require('node:assert/strict');
const publication = require('../.test-out/model/publication.js');
const { publicMerchantFilter, publicOfferFilter, distinctOfferStages, merchantNameExpression } = publication;
const { REGION_CODES } = require('../.test-out/regions.js');
(async () => {
 const client = new MongoClient(process.env.MONGODB_URI,{serverSelectionTimeoutMS:10000});
 try {
  await client.connect(); const db=client.db('awin_affiliates');
  const now=Date.now();
  const base={network:'test',advertiser:{id:1,name:'Example'},title:'Source offer',code:null,type:'deal',status:'active',startDate:null,endDate:null,trackingUrl:'https://example.test/offer',regionCodes:['AU']};
  const fixtures=[{...base,id:1},{...base,id:2},{...base,id:3,title:'Expired',endDate:new Date(now-86400000).toISOString()},{...base,id:4,title:'Future',startDate:new Date(now+86400000).toISOString()},{...base,id:5,title:'Wrong market',regionCodes:['US']},{...base,id:6,title:'Unknown market',regionCodes:[]},{...base,id:7,title:'Placeholder',isBrandDeal:true},{...base,id:8,title:'Paused',status:'inactive'},{...base,id:9,title:'Invalid expiry',endDate:'garbage'},{...base,id:10,title:'Reviewed local',regionCodes:['US'],reviewedRegionCodes:['AU']}];
  const eligible=await db.aggregate([{$documents:fixtures},{$match:publicOfferFilter('AU')},...distinctOfferStages()]).toArray();
  assert.deepEqual(eligible.map(x=>x.id).sort((a,b)=>a-b),[1,10]);
  const names=await db.aggregate([{$documents:[{name:'Beauty Amora AU'},{name:'Beauty Amora'},{name:'ISSA Many Geos'},{name:'Gorman'}]},{$project:{_id:0,canonical:merchantNameExpression('$name')}}]).toArray();
  assert.deepEqual(names.map(x=>x.canonical),['beauty amora','beauty amora','issa','gorman']);
  const merchants=[
    {id:1,status:'active',relationship:'joined'},
    {id:2,status:'Active',relationship:'joined'},
    {id:3,status:'inactive',relationship:'joined',isFlagship:true},
    {id:4,status:'inactive',relationship:'joined'},
    {id:5,status:'active',relationship:'pending',isFlagship:true},
  ];
  const visible=await db.aggregate([{$documents:merchants},{$match:publicMerchantFilter()}]).toArray();
  assert.deepEqual(visible.map(x=>x.id).sort((a,b)=>a-b),[1,2,3]);
  // A flagship selection changes merchant visibility, never offer eligibility.
  const flagshipOffers=await db.aggregate([{$documents:fixtures.map(x=>({...x,isFlagship:true}))},{$match:publicOfferFilter('AU')},...distinctOfferStages()]).toArray();
  assert.deepEqual(flagshipOffers.map(x=>x.id).sort((a,b)=>a-b),[1,10]);
  console.log(JSON.stringify(await require('./verify-offer-markets.cjs')(db, publication, REGION_CODES),null,2));
  console.log(JSON.stringify({publicationFixtures:'passed',merchantIdentityFixtures:'passed',flagshipVisibilityFixtures:'passed',flagshipOfferEligibilityFixtures:'passed'},null,2));
 }catch(e){console.error('Query verification failed:',e.name,e.code||'',String(e.message).replace(/mongodb[^ ]*/g,'[redacted]').slice(0,250));process.exitCode=1;}
 finally{await client.close();}
})();
