/**
 * MongoDB connection singleton.
 *
 * Maintains a cached client across hot-reloads in development and across
 * serverless invocations (when the execution context is reused).
 *
 * Usage:
 *   import { getDb } from "@/lib/mongodb";
 *   const db = await getDb();
 *   const collection = db.collection("advertisers");
 */

import { MongoClient, type Db } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = "awin_affiliates";

if (!MONGODB_URI) {
  console.warn(
    "[mongodb] MONGODB_URI is not set. MongoDB features will be unavailable.",
  );
}

/**
 * In development the module is re-evaluated on every HMR cycle, which would
 * create a new MongoClient each time. We stash the promise on `globalThis` to
 * avoid that.
 */
interface MongoGlobal {
  _mongoClientPromise?: Promise<MongoClient>;
}

const g = globalThis as unknown as MongoGlobal;

function getClientPromise(): Promise<MongoClient> {
  if (!MONGODB_URI) {
    return Promise.reject(
      new Error("MONGODB_URI is not configured."),
    );
  }

  if (g._mongoClientPromise) {
    return g._mongoClientPromise;
  }

  const client = new MongoClient(MONGODB_URI, {
    // Sensible defaults for a serverless environment
    maxPoolSize: 10,
    minPoolSize: 0,
    maxIdleTimeMS: 10_000,
    connectTimeoutMS: 10_000,
    serverSelectionTimeoutMS: 10_000,
  });

  g._mongoClientPromise = client.connect();

  return g._mongoClientPromise;
}

/**
 * Returns the default `Db` instance. Reuses the cached connection.
 *
 * Throws if `MONGODB_URI` is not set — callers should handle this gracefully
 * and fall back to the Awin API when MongoDB is unavailable.
 */
export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(DB_NAME);
}

/**
 * Quick health check — resolves `true` if MongoDB is reachable.
 */
export async function isMongoAvailable(): Promise<boolean> {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}
