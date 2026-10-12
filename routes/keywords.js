// Route definitions for the keywords resource.

const express = require("express");
const router = express.Router();
const keywordsController = require("../controllers/keywords");
// SE CORRIGE AQUÍ: Importamos únicamente isAdmin
const { isAuthenticated, isAdmin } = require("../middleware/auth");
const {
  keywordRules,
  validate,
  isValidObjectId,
} = require("../middleware/validation");

router.get("/", keywordsController.getAllKeywords);
router.get("/:id", isValidObjectId, keywordsController.getKeywordById);
router.get(
  "/:id/artworks",
  isValidObjectId,
  keywordsController.getKeywordArtworks,
);

// Restricted: ONLY admins can create a keyword.
router.post(
  "/",
  isAuthenticated,
  isAdmin,
  keywordRules(),
  validate,
  keywordsController.createKeyword,
);

// Restricted: ONLY admins can update a keyword.
router.put(
  "/:id",
  /* #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: {
          keyword: "still-life"
      }
  } */
  isValidObjectId,
  isAuthenticated,
  isAdmin,
  keywordRules(),
  validate,
  keywordsController.updateKeyword,
);

// Restricted: ONLY admins can delete a keyword.
router.delete(
  "/:id",
  isValidObjectId,
  isAuthenticated,
  isAdmin,
  keywordsController.deleteKeyword,
);

module.exports = router;
