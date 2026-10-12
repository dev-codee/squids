/** Explicit user-requested review fixtures. Dry run by default; --apply writes only owned fixture IDs. */
const { MongoClient } = require('mongodb');
const FIXTURE = 'beauty-amora-review-v1';
const BASE = 88001000;
const specs = [
 ['Dewdrop Hydrating Serum','30 ml','Clear',1,29.90,'serum','Dewdrop Studio','DD-SERUM','Skincare',true],
 ['Dewdrop Hydrating Serum','60 ml','Clear',1,48.90,'serum','Dewdrop Studio','DD-SERUM','Skincare',true],
 ['Dewdrop Hydrating Serum','30 ml','Clear',2,54.90,'serum','Dewdrop Studio','DD-SERUM','Skincare',true],
 ['Cloud Milk Cleanser','150 ml','White',1,22.50,'cleanser','Dewdrop Studio','CM-CLEANSE','Skincare',true],
 ['Petal Water Toner','200 ml','Rose',1,26.00,'toner','Petal Atelier','PW-TONER','Skincare',true],
 ['Velvet Barrier Cream','50 ml','Ivory',1,36.00,'cream','Dewdrop Studio','VB-CREAM','Skincare',true],
 ['Daily Veil Lotion','50 ml','Ivory',1,24.90,'lotion','Petal Atelier','DV-LOTION','Skincare',false],
 ['Soft Tint Lip Balm','4 g','Rose',1,14.90,'lip-rose','Petal Atelier','ST-LIP','Makeup',true],
 ['Soft Tint Lip Balm','4 g','Peach',1,14.90,'lip-peach','Petal Atelier','ST-LIP','Makeup',true],
 ['Soft Tint Lip Balm','4 g','Berry',1,16.50,'lip-berry','Petal Atelier','ST-LIP','Makeup',true],
 ['Silk Wash Shampoo','300 ml','Sage',1,31.00,'shampoo','Mori Ritual','SW-SHAMPOO','Haircare',true],
 ['Botanical Body Oil','100 ml','Amber',1,39.50,'oil','Mori Ritual','BB-OIL','Bodycare',true],
 ['Evening Recovery Mask','75 ml','Lavender',1,34.00,'mask','Petal Atelier','ER-MASK','Skincare',true],
 ['Travel Ritual Set','4 × 30 ml','Sage',4,null,'travel','Mori Ritual','TR-SET','Skincare',false],
];
const now = new Date();
const known = value => ({known:true,value});
function rule(id, charge=7.95, threshold=65) {
 return {id:`${FIXTURE}:${id}`,merchantMarketId:`demo:${id}:AU`,zone:{market:'AU'},serviceLevel:'standard',charge:known(charge),currency:'AUD',freeThreshold:known(threshold),thresholdBasis:'after-discount',mandatoryFees:known(0),taxIncluded:true,sourceUrl:'https://example.invalid/foxzil-demo-delivery',checkedAt:now.toISOString(),checkedBy:'Explicitly synthetic review fixture',restrictions:['Fictional delivery terms for UI review only']};
}
async function main(){
 if(!process.env.MONGODB_URI)throw Error('MONGODB_URI is required');
 const client=new MongoClient(process.env.MONGODB_URI);
 try{
  await client.connect();const db=client.db('awin_affiliates');
  const store=await db.collection('advertisers').findOne({id:83335,network:'commission-factory',name:'Beauty Amora'});
  if(!store)throw Error('Expected Beauty Amora store was not found; nothing written.');
  const products=specs.map((s,i)=>({id:BASE+i+1,advertiserId:store.id,network:store.network,regionCodes:['AU'],market:'AU',title:`[DEMO] ${s[0]} ${s[1]}${s[3]>1?' · '+s[3]+' pack':''}${s[8]==='Makeup'?' · '+s[2]:''}`,category:s[8],brand:s[6],mpn:s[7],size:s[1],colour:s[2],packCount:s[3],condition:'new',regionalSpec:'Australia · demo packaging',imageUrl:`/demo/beauty-amora/${s[5]}.svg`,salePrice:s[4],currency:'AUD',originalPrice:null,discountPercentage:null,rating:null,reviewsCount:null,inStock:s[9],trackingUrl:null,description:`A fictional ${s[0].toLowerCase()} from ${s[6]}, created to review the Foxzil shopping experience. This sample includes packaging, variant details and comparison data. It is not a real Beauty Amora listing or a product recommendation.`,specifications:[{label:'Product type',value:s[0]},{label:'Collection',value:s[6]+' · Demo collection'},{label:'Packaging',value:s[5].includes('lip')?'Twist-up tube':s[5]==='cream'||s[5]==='mask'?'Reusable jar (sample)':'Bottle (sample)'},{label:'Formula / materials',value:'Fictional sample specification; not for actual use'},{label:'Review scenario',value:s[4]===null?'Price unavailable':!s[9]?'Not in stock':i<3?'Size and pack variants':s[8]==='Makeup'?'Colour variants':'Available product'}],demo:{fixtureSet:FIXTURE,retailerName:'Beauty Amora · Demo offer',deliveryRule:rule(store.id)}}));
  const retailers=[{id:990001,name:'Glow Market · Demo',delta:-2.4,charge:4.95,threshold:50},{id:990002,name:'Skin Room · Demo',delta:1.1,charge:0,threshold:0},{id:990003,name:'Botanical Shop · Demo',delta:-4.0,unknown:true},{id:990004,name:'Beauty Shelf · Demo',delta:-5.0,out:true}];
  for(const source of products.slice(0,3)){
   retailers.forEach((r,j)=>products.push({...source,id:BASE+100+(source.id-BASE)*10+j,advertiserId:r.id,network:'demo',salePrice:Math.round((source.salePrice+r.delta)*100)/100,inStock:!r.out,demo:{fixtureSet:FIXTURE,comparisonOnly:true,retailerName:r.name,deliveryRule:r.unknown?null:rule(r.id,r.charge,r.threshold)}}));
  }
  const observations=[];
  for(const p of products.filter(p=>p.salePrice!==null)){
   for(let day=180;day>=0;day-=6){const price=Math.round((p.salePrice + day/180*8 + Math.sin(day/15)*1.4)*100)/100;
    observations.push({id:`${FIXTURE}:${p.id}:${day}`,productId:p.id,market:'AU',retailerId:p.advertiserId,retailerName:p.demo.retailerName,itemPrice:price,currency:'AUD',observedAt:new Date(now.getTime()-day*86400000).toISOString(),sourceBatchId:FIXTURE,demoFixtureSet:FIXTURE});}
  }
  // Refuse any ID collision with records not owned by this fixture set before writing anything.
  const collisions=await db.collection('products').countDocuments({id:{$in:products.map(p=>p.id)},'demo.fixtureSet':{$ne:FIXTURE}});
  const historyCollisions=await db.collection('price_observations').countDocuments({id:{$in:observations.map(o=>o.id)},demoFixtureSet:{$ne:FIXTURE}});
  if(collisions||historyCollisions)throw Error('Fixture ID collision; no writes performed.');
  console.log(JSON.stringify({mode:process.argv.includes('--apply')?'apply':'dry-run',store:store.name,market:'AU',storeProducts:specs.length,comparisonOffers:products.length-specs.length,historyPoints:observations.length,productPage:`/au/product/${BASE+1}`,storePage:'/au/beauty-amora'}));
  if(process.argv.includes('--apply')){
   await db.collection('products').bulkWrite(products.map(p=>({updateOne:{filter:{id:p.id,'demo.fixtureSet':FIXTURE},update:{$set:p},upsert:true}})));
   await db.collection('price_observations').bulkWrite(observations.map(o=>({updateOne:{filter:{id:o.id,demoFixtureSet:FIXTURE},update:{$set:o},upsert:true}})));
   console.log('Demo catalog saved. Existing products, advertisers, real delivery rules, deals and subscriptions were not modified.');
  }
 }finally{await client.close()}
}
main().catch(e=>{console.error(e.message);process.exit(1)});
