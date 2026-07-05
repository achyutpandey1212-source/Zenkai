const { MongoClient } = require("mongodb");
require("dotenv").config();

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error("MONGODB_URI not set"); process.exit(1); }
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const result = await db.collection("pending_actions").deleteMany({});
  console.log(`Deleted ${result.deletedCount} stale pending_action document(s).`);
  await client.close();
}
main().catch(console.error);
