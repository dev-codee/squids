/**
 * Re-runs auto-categorization against all advertisers using the current
 * CATEGORY_KEYWORDS from the source, then recounts category stats.
 *
 * Run: node scripts/run-recategorize.mjs
 */

import { MongoClient } from "mongodb";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envFile = readFileSync(join(__dirname, "../.env.local"), "utf8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

const uri = process.env.MONGODB_URI;
if (!uri) { console.error("MONGODB_URI not set"); process.exit(1); }

// ---- Keyword rules (keep in sync with src/lib/db/categories.ts) ----
const CATEGORY_KEYWORDS = [
  {
    categoryName: "Electronics & Tech",
    keywords: ["electronic","tech","computer","mobile","phone","software","antivirus","gadget","pc","digital","hardware","vpn","hosting","security","cloud","camera","app","adguard","aomei","printer","laptop","tablet","monitor","keyboard","mouse","router","smart home"],
  },
  {
    categoryName: "Fashion & Apparel",
    keywords: ["fashion","apparel","clothing","cloth","shoe","wear","jewelry","jewel","accessory","accessories","dress","shirt","pant","footwear","watch","bag","style","brand","boohoo","shein","zara","asos","h&m","prettylittlething","missguided","topshop","forever21","urban outfitters","uniqlo","gap","primark","marks & spencer","lingerie","swimwear","denim","jeans","skirt","coat","jacket","trainer","sneaker","boot","handbag","purse"],
  },
  {
    categoryName: "Travel & Hotels",
    keywords: ["travel","hotel","flight","booking","vacation","car rental","airline","resort","tour","ticket","trip","stay","cruise","centara","trivago","expedia","booking.com","airbnb","kayak","skyscanner","agoda","hostel","accommodation","airport","transfer","holiday","passport","visa","lounge","train","rail","bus"],
  },
  {
    categoryName: "Beauty & Health",
    keywords: ["beauty","health","skincare","skin","cosmetics","wellness","pharmacy","makeup","perfume","fragrance","care","hair","body","medical","fitness","vitamin","supplement","spa","nail","shampoo","conditioner","moisturiser","serum","lipstick","mascara","foundation","eyeshadow","blush","toner","sunscreen","spf"],
  },
  {
    categoryName: "Home & Garden",
    keywords: ["home","garden","furniture","kitchen","decor","appliance","bedding","bath","living","patio","tool","house","ikea","wayfair","dunelm","habitat","carpet","curtain","lamp","sofa","mattress","pillow","vacuum","cookware","barbecue","grill","plant","seed","mower"],
  },
  {
    categoryName: "Sports & Outdoor",
    keywords: ["sport","outdoor","fitness","gym","activewear","cycling","camping","hiking","golf","football","ball","cs2","case","nike","adidas","under armour","puma","reebok","new balance","yoga","pilates","running","swimming","tennis","cricket","rugby","basketball","skateboard","surf","ski","snowboard","climbing","trekking","bicycle","bike"],
  },
  {
    categoryName: "Software & Services",
    keywords: ["software","saas","hosting","domain","web","subscription","marketing","education","course","chegg","adguard","aomei","adobe","microsoft","norton","mcafee","kaspersky","bitdefender","cpanel","wordpress","shopify","squarespace","wix","hubspot","mailchimp","canva","figma","slack","zoom","dropbox","cloud storage","backup","password manager","antivirus"],
  },
  {
    categoryName: "Food & Dining",
    keywords: ["food","dining","restaurant","grocery","wine","pizza","delivery","gourmet","drink","coffee","tea","chocolate","snack","uber eats","deliveroo","justeat","just eat","grubhub","doordash","meal kit","hello fresh","hellofresh","gousto","supermarket","beer","spirits","whisky","vodka","gin","bakery","cake","candy","sweet"],
  },
  {
    categoryName: "Toys & Gaming",
    keywords: ["toy","game","gaming","console","playstation","xbox","nintendo","kid","child","puzzle","hobby","cs2","lego","funko","board game","card game","action figure","doll","plush","baby","toddler","steam","epic games","g2a","cdkeys"],
  },
  {
    categoryName: "Automotive",
    keywords: ["auto","car","motor","vehicle","tire","tyre","automotive","part","garage","mechanic","oil change","wash","detail","battery","exhaust","brake","seat cover","dashboard","charging","ev","electric vehicle","motorbike","motorcycle"],
  },
];

function categorizeAdvertiser(adv) {
  const textToMatch = [
    adv.name || "",
    adv.description || "",
    adv.region || "",
    ...(Array.isArray(adv.categories) ? adv.categories : [adv.categories || ""]),
  ].join(" ").toLowerCase();

  const assigned = new Set();
  for (const rule of CATEGORY_KEYWORDS) {
    if (rule.keywords.some(kw => textToMatch.includes(kw))) {
      assigned.add(rule.categoryName);
    }
  }
  // No fallback — uncategorized stores stay uncategorized
  return Array.from(assigned);
}

async function run() {
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 120000,
    maxPoolSize: 5,
  });
  await client.connect();
  const db = client.db("awin_affiliates");

  const advCol = db.collection("advertisers");
  const catCol = db.collection("categories");
  const dealsCol = db.collection("deals");

  const total = await advCol.estimatedDocumentCount();
  console.log(`  ${total} advertisers to process.`);

  let categorized = 0;
  let uncategorized = 0;
  let processed = 0;
  const categoryCounts = {};

  // Process in batches of 500 to avoid memory/timeout issues
  const BATCH = 500;
  let skip = 0;

  while (skip < total) {
    const batch = await advCol
      .find({})
      .project({ _id: 1, name: 1, description: 1, region: 1, categories: 1 })
      .skip(skip)
      .limit(BATCH)
      .toArray();

    if (batch.length === 0) break;

    const ops = batch.map(adv => {
      const cats = categorizeAdvertiser(adv);
      if (cats.length > 0) {
        categorized++;
        for (const c of cats) categoryCounts[c] = (categoryCounts[c] || 0) + 1;
      } else {
        uncategorized++;
      }
      return {
        updateOne: {
          filter: { _id: adv._id },
          update: { $set: { categories: cats } },
        },
      };
    });

    await advCol.bulkWrite(ops, { ordered: false });
    processed += batch.length;
    skip += BATCH;
    process.stdout.write(`  ${processed}/${total} processed\r`);
  }

  console.log(`\nCategorized: ${categorized}  |  Uncategorized: ${uncategorized}`);
  console.log("\nStore counts per category:");
  for (const [name, count] of Object.entries(categoryCounts).sort((a,b) => b[1]-a[1])) {
    console.log(`  ${name}: ${count}`);
  }

  // Recount category stats in the categories collection
  console.log("\nRecounting category stats...");
  const categories = await catCol.find({}).toArray();
  for (const cat of categories) {
    const nameRegex = new RegExp(cat.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const storeCount = await advCol.countDocuments({
      categories: { $elemMatch: { $regex: nameRegex } },
    });
    const dealCount = await dealsCol.countDocuments({
      $or: [
        { "advertiser.categories": { $elemMatch: { $regex: nameRegex } } },
        { title: { $regex: nameRegex } },
      ],
    });
    await catCol.updateOne(
      { _id: cat._id },
      { $set: { storeCount, dealCount, updatedAt: new Date() } }
    );
    console.log(`  ${cat.name}: ${storeCount} stores, ${dealCount} deals`);
  }

  console.log("\nDone.");
  await client.close();
}

run().catch(err => { console.error(err); process.exit(1); });
