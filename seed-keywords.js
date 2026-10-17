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

    // 2. Extract descriptive property values from artworks
    artworks.forEach((art) => {
      if (art.period) uniqueKeywords.add(art.period.trim().toLowerCase());
      if (art.type) uniqueKeywords.add(art.type.trim().toLowerCase());
      if (art.medium) uniqueKeywords.add(art.medium.trim().toLowerCase());
    });

    // 3. Extract descriptive property values from artists
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

    // 4. Map them into your keyword schema structure
    const keywordDocuments = Array.from(uniqueKeywords).map((word) => ({
      keyword: word,
      createdAt: new Date(),
    }));

    // 5. Insert into the keywords collection
    const collection = db.collection("keywords");
    const result = await collection.insertMany(keywordDocuments, {
      ordered: false,
    });

    console.log(
      `Successfully seeded ${result.insertedCount} keywords into the database!`,
    );
  } catch (err) {
    // MongoDB error code 11000 handles duplicate key violations smoothly
    if (err.code === 11000) {
      console.log(
        "Seeding complete: Duplicate keywords were automatically skipped.",
      );
    } else {
      console.error("Error running keyword seeder:", err.message);
    }
  } finally {
    await client.close();
  }
}

seedKeywords();
