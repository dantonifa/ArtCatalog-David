//Routes/artists.js - Route definitions for the artists resource.
const express = require("express");
const router = express.Router();
const { isAuthenticated, isAdmin } = require("../middleware/auth");
const {
  validate,
  isValidObjectId,
} = require("../middleware/validation");

const artistsController = require("../controllers/artists");

// Public: list all artists.
router.get("/", artistsController.getAllArtists);
// Public: get a single artist.
router.get("/:id", isValidObjectId, artistsController.getArtistById);
// Restricted: ONLY admins can create an artist.
router.post(
  "/",
  isAuthenticated,
  isAdmin,
  validate,
  artistsController.createArtist,
);
// Restricted: ONLY admins can update an artist.
router.put(
  "/:id",
  isValidObjectId,
  isAuthenticated,
  isAdmin,
  validate,
  artistsController.updateArtist,
);
// Restricted: ONLY admins can delete an artist.
router.delete(
  "/:id",
  isValidObjectId,
  isAuthenticated,
  isAdmin,
  artistsController.deleteArtist,
);


module.exports = router;
