// Route definitions for the artwork_keywords resource.

const express = require("express");
const router = express.Router();
const artworkKeywordsController = require("../controllers/artworkKeywords");
// SE CORRIGE AQUÍ: Importamos únicamente isAdmin
const { isAuthenticated, isAdmin } = require("../middleware/auth");
const {
  artworkKeywordRules,
  validate,
  isValidObjectId,
} = require("../middleware/validation");

router.get("/", artworkKeywordsController.getAllArtworkKeywords);
router.get(
  "/:id",
  isValidObjectId,
  artworkKeywordsController.getArtworkKeywordById,
);

// Restricted: ONLY admins can build associations.
router.post(
  "/",
  isAuthenticated,
  isAdmin,
  artworkKeywordRules(),
  validate,
  artworkKeywordsController.createArtworkKeyword,
);

// Restricted: ONLY admins can update associations.
router.put(
  "/:id",
  /* #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: {
          artworkId: "6ab7527a48f485276c4cea89",
          keywordId: "6ab754b548f485276c4cea9a"
      }
  } */
  isValidObjectId,
  isAuthenticated,
  isAdmin,
  artworkKeywordRules(),
  validate,
  artworkKeywordsController.updateArtworkKeyword,
);

// Restricted: ONLY admins can delete associations.
router.delete(
  "/:id",
  isValidObjectId,
  isAuthenticated,
  isAdmin,
  artworkKeywordsController.deleteArtworkKeyword,
);

module.exports = router;
