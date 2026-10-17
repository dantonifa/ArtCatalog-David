require("dotenv").config();
const { MongoClient } = require("mongodb");

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function seedKeywords() {
  try {
    await client.connect();
    const db = client.db("artcatalogteam8");

    const artworks = await db.collection("artworks").find({}).toArray();
    const artists = await db.collection("artists").find({}).toArray();

    const uniqueKeywords = new Set();

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

    const keywordsCollection = db.collection("keywords");
    await keywordsCollection.deleteMany({});

    const keywordDocuments = Array.from(uniqueKeywords).map((word) => ({
      keyword: word,
      createdAt: new Date(),
    }));

    await keywordsCollection.insertMany(keywordDocuments);
    console.log(`Successfully seeded keywords!`);

    const insertedKeywords = await keywordsCollection.find({}).toArray();
    const keywordMap = new Map();
    insertedKeywords.forEach((kw) => {
      keywordMap.set(kw.keyword, kw._id);
    });

    const bridgeDocuments = [];
    artworks.forEach((art) => {
      // Map period
      if (art.period) {
        const key = art.period.trim().toLowerCase();
        if (keywordMap.has(key)) {
          bridgeDocuments.push({
            artworkId: art._id,
            keywordId: keywordMap.get(key),
            createdAt: new Date(),
          });
        }
      }
      // Map type
      if (art.type) {
        const key = art.type.trim().toLowerCase();
        if (keywordMap.has(key)) {
          bridgeDocuments.push({
            artworkId: art._id,
            keywordId: keywordMap.get(key),
            createdAt: new Date(),
          });
        }
      }
      // Map medium
      if (art.medium) {
        const key = art.medium.trim().toLowerCase();
        if (keywordMap.has(key)) {
          bridgeDocuments.push({
            artworkId: art._id,
            keywordId: keywordMap.get(key),
            createdAt: new Date(),
          });
        }
      }
    });

    const bridgeCollection = db.collection("artwork_keywords");
    await bridgeCollection.deleteMany({});

    if (bridgeDocuments.length > 0) {
      // Use ordered: false to prevent duplicate entry crashes if an artwork maps multiple times
      await bridgeCollection.insertMany(bridgeDocuments, { ordered: false });
      console.log(
        `Successfully seeded ${bridgeDocuments.length} relationships into artwork_keywords!`,
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
