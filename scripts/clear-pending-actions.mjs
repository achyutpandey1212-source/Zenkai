import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const uri = process.env.MONGODB_URI;
if (!uri) { console.error("MONGODB_URI not set"); process.exit(1); }

const client = new MongoClient(uri);
await client.connect();
const db = client.db();
const result = await db.collection("pending_actions").deleteMany({});
console.log(`Deleted ${result.deletedCount} stale pending_action document(s).`);
await client.close();
