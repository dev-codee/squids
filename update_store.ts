import { getDb } from './src/lib/mongodb';
async function run() {
  const db = await getDb();
  await db.collection('advertisers').updateOne(
    { id: 40315, network: 'admitad' },
    { $set: { name: 'hidemy.name' } }
  );
  console.log('Updated');
  process.exit(0);
}
run();
