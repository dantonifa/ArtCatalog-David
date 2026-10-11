// Controller for the "artworks" collection.
// All handlers access the database through getDatabase() (see data/database.js)
// and delegate any thrown error to the central error handler via next(err).
// Documents store "createdBy" (id of the user that created them) so routes
// can check ownership.

const { ObjectId } = require("mongodb");
const { getDatabase } = require("../data/database");

const COLLECTION = "artworks";
// Fields a client may update (whitelist to avoid mass assignment).
const ALLOWED_FIELDS = [
  "title",
  "year",
  "period",
  "type",
  "medium",
  "dimensions",
  "description",
  "file",
  "artistId",
];

/** Returns every artwork; supports ?period=, ?type=, ?year=, ?artistId= filters. */
async function getAllArtworks(req, res, next) {
  try {
    const db = getDatabase();
    const query = {};

    if (req.query.period) query.period = req.query.period;
    if (req.query.type) query.type = req.query.type;
    if (req.query.year) query.year = Number(req.query.year);
    if (req.query.artistId) query.artistId = new ObjectId(req.query.artistId);

    const artworks = await db.collection(COLLECTION).find(query).toArray();

    // Force a 500 error for testing in Swagger
    if (req.query.error === "500") {
      const err = new Error("Internal Server Error test");
      err.status = 500;
      throw err;
    }

    res.status(200).json(artworks);
  } catch (err) {
    next(err);
  }
}

/** Returns a single artwork by id, or 404 when there is no match. */
async function getArtworkById(req, res, next) {
  try {
    const db = getDatabase();
    const artwork = await db.collection(COLLECTION).findOne({
      _id: new ObjectId(req.params.id),
    });
    if (!artwork) {
      return res.status(404).json({ message: 'Artwork not found' });
    }
    res.status(200).json(artwork);
  } catch (err) {
    next(err);
  }
}

/**
 * Creates a new artwork. artistId must reference an existing artist
 * (checked before saving). Returns the created artwork with status 201.
 */
async function createArtwork(req, res, next) {
  try {
    const db = getDatabase();
    const artistId = new ObjectId(req.body.artistId);
    const artist = await db.collection("artists").findOne({ _id: artistId });
    if (!artist) {
      return res
        .status(400)
        .json({ message: "artistId does not reference an existing artist" });
    }
    const artwork = {
      title: req.body.title,
      year: req.body.year,
      period: req.body.period,
      type: req.body.type,
      medium: req.body.medium || null,
      dimensions: req.body.dimensions || null,
      description: req.body.description || null,
      file: req.body.file,
      artistId,
      createdBy: req.user._id,
      createdAt: new Date(),
    };
    const result = await db.collection(COLLECTION).insertOne(artwork);
    const created = await db
      .collection(COLLECTION)
      .findOne({ _id: result.insertedId });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

/** Partially updates an artwork (only whitelisted fields) and returns it. */
async function updateArtwork(req, res, next) {
  try {
    const db = getDatabase();
    const updatedFields = {};
    ALLOWED_FIELDS.forEach((field) => {
      if (req.body[field] !== undefined) {
        // artistId must be converted back into an ObjectId for the DB.
        updatedFields[field] =
          field === "artistId"
            ? new ObjectId(req.body[field])
            : req.body[field];
      }
    });
    // Keep the same invariant as createArtwork: artistId must reference an
    // existing artist.
    if (updatedFields.artistId !== undefined) {
      const artist = await db
        .collection("artists")
        .findOne({ _id: updatedFields.artistId });
      if (!artist) {
        return res
          .status(400)
          .json({ message: "artistId does not reference an existing artist" });
      }
    }
    const result = await db
      .collection(COLLECTION)
      .updateOne({ _id: new ObjectId(req.params.id) }, { $set: updatedFields });
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Artwork not found" });
    }
    const updated = await db.collection(COLLECTION).findOne({
      _id: new ObjectId(req.params.id),
    });
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

/**
 * Deletes an artwork and its keyword links (cascade).
 * 204 on success and 404 when there is no match.
 */
async function deleteArtwork(req, res, next) {
  try {
    const db = getDatabase();
    const id = new ObjectId(req.params.id);
    const result = await db.collection(COLLECTION).deleteOne({ _id: id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Artwork not found" });
    }
    // Remove the links so no database record points to a deleted artwork.
    await db.collection("artwork_keywords").deleteMany({ artworkId: id });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/**
 * Advanced search (stretch endpoint). Combines a free-text ?q= search on the
 * title with the regular ?period=, ?type=, ?year= and ?artistId= filters.
 * Returns 400 for an invalid year or artistId.
 */
async function searchArtworks(req, res, next) {
  try {
    const db = getDatabase();
    const query = {};
    if (req.query.q) {
      query.title = { $regex: req.query.q, $options: "i" };
    }
    if (req.query.period) query.period = req.query.period;
    if (req.query.type) query.type = req.query.type;
    if (req.query.year) {
      const year = Number(req.query.year);
      if (!Number.isInteger(year) || year < 1) {
        return res
          .status(400)
          .json({ message: "year must be a positive integer" });
      }
      query.year = year;
    }
    if (req.query.artistId) {
      if (!ObjectId.isValid(req.query.artistId)) {
        return res
          .status(400)
          .json({ message: "artistId must be a valid ObjectId" });
      }
      query.artistId = new ObjectId(req.query.artistId);
    }
    const artworks = await db.collection(COLLECTION).find(query).toArray();
    res.status(200).json(artworks);
  } catch (err) {
    next(err);
  }
}

/**
 * Returns the keywords linked to one artwork (stretch endpoint).
 * Resolves the artwork_keywords links and returns the keyword documents.
 * 404 if the artwork does not exist.
 */
async function getArtworkKeywords(req, res, next) {
  try {
    const db = getDatabase();
    const id = new ObjectId(req.params.id);
    const artwork = await db.collection("artworks").findOne({ _id: id });
    if (!artwork) {
      return res.status(404).json({ message: "Artwork not found" });
    }
    const links = await db
      .collection("artwork_keywords")
      .find({ artworkId: id })
      .toArray();
    const keywordIds = links.map((link) => link.keywordId);
    if (keywordIds.length === 0) {
      return res.status(200).json([]);
    }
    const keywords = await db
      .collection("keywords")
      .find({ _id: { $in: keywordIds } })
      .toArray();
    res.status(200).json(keywords);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllArtworks,
  getArtworkById,
  createArtwork,
  updateArtwork,
  deleteArtwork,
  searchArtworks,
  getArtworkKeywords,
};
