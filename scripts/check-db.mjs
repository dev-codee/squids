import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";
import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

// Load MONGODB_URI from .env.local
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const uri = env.match(/^MONGODB_URI=(.*)$/m)?.[1]?.trim();
if (!uri) throw new Error("MONGODB_URI not found in .env.local");

const client = new MongoClient(uri);
await client.connect();
const db = client.db("awin_affiliates");

const advCol = db.collection("advertisers");
const dealsCol = db.collection("deals");

console.log("=== Advertisers matching /brainco/i ===");
const advs = await advCol
  .find({ name: { $regex: "brainco", $options: "i" } })
  .project({ _id: 0, id: 1, network: 1, name: 1, relationship: 1 })
  .toArray();
console.log(advs);

for (const a of advs) {
  const count = await dealsCol.countDocuments({ "advertiser.id": { $in: [a.id, String(a.id)] } });
  const byType = await dealsCol
    .aggregate([
      { $match: { "advertiser.id": { $in: [a.id, String(a.id)] } } },
      { $group: { _id: { network: "$network", type: "$type" }, n: { $sum: 1 } } },
    ])
    .toArray();
  console.log(`\nAdvertiser id=${a.id} network=${a.network} name="${a.name}" -> ${count} deals`);
  console.log("  byType:", JSON.stringify(byType));
}

await client.close();
