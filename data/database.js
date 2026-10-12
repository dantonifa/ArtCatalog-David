// MongoDB connection manager.
// Provides initDb to establish the connection and getDatabase to return the
// active database handle to controllers.

const { MongoClient } = require("mongodb");

let _db; // active database handle
let _client; // underlying MongoClient (kept to allow a clean shutdown)

// Collections used by the API and their unique indexes. MongoDB creates a
// collection automatically on first insert, but we create them here plus the
// unique indexes so the schema is ready before any request arrives.
const COLLECTIONS = [
  "artists",
  "artworks",
  "keywords",
  "artwork_keywords",
  "users",
];
const UNIQUE_INDEXES = [
  { collection: "keywords", keys: { keyword: 1 } },
  { collection: "artwork_keywords", keys: { artworkId: 1, keywordId: 1 } },
];

/**
 * Connects to MongoDB using the provided connection string.
 * Stores the resolved database so it can be reused app-wide.
 * Ignores subsequent calls if already initialized.
 */
async function initDb(connectionString) {
  if (_db) {
    console.warn("Trying to init DB again!");
    return _db;
  }
  _client = new MongoClient(connectionString);
  await _client.connect();
  _db = _client.db("artcatalogteam8");
  console.log("Connected to MongoDB");
  await ensureSchema(_db);
  return _db;
}

/**
 * Creates the collections and unique indexes that the API expects.
 * Safe to run on an existing database: createCollection is ignored if the
 * collection already exists and createIndex is idempotent.
 */
async function ensureSchema(db) {
  for (const name of COLLECTIONS) {
    try {
      await db.createCollection(name);
    } catch (err) {
      if (err.codeName !== "NamespaceExists") throw err;
    }
  }
  for (const { collection, keys } of UNIQUE_INDEXES) {
    await db.collection(collection).createIndex(keys, { unique: true });
  }
  console.log("Database schema ready (collections and unique indexes)");
}

/**
 * Returns the active database handle.
 * Throws if initDb has not been called yet.
 */
function getDatabase() {
  if (!_db) {
    throw new Error("Database not initialized!");
  }
  return _db;
}

/** Closes the MongoDB connection (used in tests / shutdown). */
async function closeDb() {
  if (_client) {
    await _client.close();
    _db = null;
    _client = null;
  }
}

module.exports = { initDb, getDatabase, closeDb };
