const mongodb = require("../data/database");
const { ObjectId } = require("mongodb");

const getAllArtists = async (req, res, next) => {
  try {
    const artists = await mongodb
      .getDatabase()
      .db()
      .collection("artists")
      .find()
      .toArray();

    // Force a 500 error for testing in Swagger
    if (req.query.error === "500") {
      const err = new Error("Internal Server Error test");
      err.status = 500;
      throw err;
    }

    res.status(200).json(artists);
  } catch (err) {
    next(err);
  }
};

const getArtistById = async (req, res, next) => {
  try {
    const artistId = ObjectId.createFromHexString(req.params.id);

    const result = await mongodb
      .getDatabase()
      .db()
      .collection("artists")
      .findOne({ _id: artistId });

    if (!result) {
      return res.status(404).json({
        message: "Artist not found",
      });
    }

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const createArtist = async (req, res, next) => {
  try {
    // Temporary 500 test for Swagger
    if (req.body.test500 === true) {
      const err = new Error("Intentional 500 error for testing");
      err.status = 500;
      throw err;
    }

    const artist = {
      name: req.body.name,
      birthYear: req.body.birthYear,
      country: req.body.country,
      style: req.body.style,
    };

    const response = await mongodb
      .getDatabase()
      .db()
      .collection("artists")
      .insertOne(artist);

    if (response.acknowledged) {
      res.status(201).json({
        message: "Artist created successfully",
      });
    } else {
      throw new Error("Failed to create artist");
    }
  } catch (err) {
    next(err);
  }
};

const updateArtist = async (req, res, next) => {
  try {
    const artistId = ObjectId.createFromHexString(req.params.id);

    const artist = {
      name: req.body.name,
      birthYear: req.body.birthYear,
      country: req.body.country,
      style: req.body.style,
    };

    const response = await mongodb
      .getDatabase()
      .db()
      .collection("artists")
      .replaceOne({ _id: artistId }, artist);

    if (response.modifiedCount > 0) {
      res.status(204).send();
    } else {
      throw new Error("Failed to update artist");
    }
  } catch (err) {
    next(err);
  }
};

const deleteArtist = async (req, res, next) => {
  try {
    const artistId = ObjectId.createFromHexString(req.params.id);

    const response = await mongodb
      .getDatabase()
      .db()
      .collection("artists")
      .deleteOne({ _id: artistId });

    if (response.deletedCount > 0) {
      res.status(204).send();
    } else {
      throw new Error("Failed to delete artist");
    }
  } catch (err) {
    next(err);
  }
};

const getArtistArtworks = async (req, res, next) => {
  try {
    const artistId = ObjectId.createFromHexString(req.params.id);

    const artworks = await mongodb
      .getDatabase()
      .db()
      .collection("artworks")
      .find({ artistId })
      .toArray();

    res.status(200).json(artworks);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllArtists,
  getArtistArtworks,
  getArtistById,
  createArtist,
  updateArtist,
  deleteArtist,
};
