// Route definitions for the artworks resource.

const express = require("express");
const router = express.Router();
const artworksController = require("../controllers/artworks");
// SE CORRIGE AQUÍ: Importamos únicamente isAdmin
const { isAuthenticated, isAdmin } = require("../middleware/auth");
const {
  artworkRules,
  validate,
  isValidObjectId,
} = require("../middleware/validation");

// Public: list all artworks.
router.get("/", artworksController.getAllArtworks);
// Public: advanced search (MUST stay before '/:id').
router.get("/search", artworksController.searchArtworks);
// Public: get a single artwork.
router.get("/:id", isValidObjectId, artworksController.getArtworkById);
// Public: keywords tagged on this artwork.
router.get(
  "/:id/keywords",
  isValidObjectId,
  artworksController.getArtworkKeywords,
);

// Restricted: ONLY admins can create an artwork.
router.post(
  "/",
  isAuthenticated,
  isAdmin,
  artworkRules(),
  validate,
  artworksController.createArtwork,
);

// Restricted: ONLY admins can update an artwork.
router.put(
  "/:id",
  /* #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: {
          title: "Sunflowers",
          year: 1888,
          period: "Post-impressionism",
          type: "Painting",
          medium: "Oil",
          dimensions: "92 cm x 73 cm",
          description: "One of a series of sunflower still lifes.",
          file: "sunflowers.jpg",
          artistId: "6ab73b2548f485276c4cea63"
      }
  } */
  isValidObjectId,
  isAuthenticated,
  isAdmin,
  artworkRules(),
  validate,
  artworksController.updateArtwork,
);

// Restricted: ONLY admins can delete an artwork.
router.delete(
  "/:id",
  isValidObjectId,
  isAuthenticated,
  isAdmin,
  artworksController.deleteArtwork,
);

module.exports = router;
