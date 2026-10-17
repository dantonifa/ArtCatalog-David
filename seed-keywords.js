require("dotenv").config();
const { MongoClient } = require("mongodb");

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function seedKeywords() {
  try {
    await client.connect();
    const db = client.db("artcatalogteam8"); // Make sure this matches your database name

    // 1. Fetch live documents from your collections
    const artworks = await db.collection("artworks").find({}).toArray();
    const artists = await db.collection("artists").find({}).toArray();

    const uniqueKeywords = new Set();

    // 2. Extract descriptive property values from artworks and artists
    artworks.forEach((art) => {
      if (art.period) uniqueKeywords.add(art.period.trim().toLowerCase());
      if (art.type) uniqueKeywords.add(art.type.trim().toLowerCase());
      if (art.medium) uniqueKeywords.add(art.medium.trim().toLowerCase());
    });

    artists.forEach((artist) => {
      if (artist.country)
        uniqueKeywords.add(artist.country.trim().toLowerCase());
      if (artist.locality)
        uniqueKeywords.add(artist.locality.trim().toLowerCase());
    });

    if (uniqueKeywords.size === 0) {
      console.log("No property values found to seed into keywords.");
      return;
    }

    // 3. Insert unique keywords into the keywords collection
    const keywordDocuments = Array.from(uniqueKeywords).map((word) => ({
      keyword: word,
      createdAt: new Date(),
    }));

    const keywordsCollection = db.collection("keywords");

    // Optional: clear out old data to ensure fresh mappings
    await keywordsCollection.deleteMany({});
    const keywordResult = await keywordsCollection.insertMany(keywordDocuments);
    console.log(`Successfully seeded ${keywordResult.insertedCount} keywords!`);

    // 4. Fetch the newly inserted keywords (with their generated _ids)
    const insertedKeywords = await keywordsCollection.find({}).toArray();

    // Create a lookup map for quick access: { "post-impressionism": ObjectId(...) }
    const keywordMap = new Map();
    insertedKeywords.forEach((kw) => {
      keywordMap.set(kw.keyword, kw._id);
    });

    // 5. Build and populate the artwork_keywords bridge collection
    const bridgeDocuments = [];
    artworks.forEach((art) => {
      // Check for period mapping
      if (art.period) {
        const periodKey = art.period.trim().toLowerCase();
        if (keywordMap.has(periodKey)) {
          bridgeDocuments.push({
            artworkId: art._id,
            keywordId: keywordMap.get(periodKey),
            createdAt: new Date(),
          });
        }
      }
      // You can add similar checks for type/medium if your bridge table covers them too!
    });

    const bridgeCollection = db.collection("artwork_keywords");
    await bridgeCollection.deleteMany({}); // Clear old bridge mappings

    if (bridgeDocuments.length > 0) {
      const bridgeResult = await bridgeCollection.insertMany(bridgeDocuments);
      console.log(
        `Successfully seeded ${bridgeResult.insertedCount} relationships into artwork_keywords!`,
      );
    } else {
      console.log(
        "No matching relationships found to seed into artwork_keywords.",
      );
    }
  } catch (err) {
    console.error("Error running keyword seeder:", err.message);
  } finally {
    await client.close();
  }
}

seedKeywords();
