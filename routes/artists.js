// Route definitions for the artists resource.

const express = require("express");
const router = express.Router();
const artistsController = require("../controllers/artists");
const { isAuthenticated, isOwnerOrAdmin } = require("../middleware/auth");
const {
  artistRules,
  validate,
  isValidObjectId,
} = require("../middleware/validation");

// Public: list all artists (optional ?country= filter).
router.get("/", artistsController.getAllArtists);

// Public: get a single artist.
router.get("/:id", isValidObjectId, artistsController.getArtistById);

// Public: all artworks by this artist.
router.get(
  "/:id/artworks",
  isValidObjectId,
  artistsController.getArtistArtworks,
);

// Protected: create an artist.
router.post(
  "/",
  isAuthenticated,
  artistRules(),
  validate,
  artistsController.createArtist,
);

// Owner or admin: update an artist.
router.put(
  "/:id",
  isValidObjectId,
  isAuthenticated,
  isOwnerOrAdmin("artists"),
  artistRules(),
  validate,
  artistsController.updateArtist,
);

// Owner or admin: delete an artist (409 if it still has artworks).
router.delete(
  "/:id",
  isValidObjectId,
  isAuthenticated,
  isOwnerOrAdmin("artists"),
  artistsController.deleteArtist,
);

module.exports = router;
