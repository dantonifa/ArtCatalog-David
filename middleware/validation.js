// Request validation middleware.
// Provides express-validator rule sets per entity and helpers to check
// MongoDB ObjectId formats.

const { validationResult } = require("express-validator");
const { body } = require("express-validator");
const { ObjectId } = require("mongodb");

/**
 * Route-level middleware that validates the :id param is a proper ObjectId.
 * Returns 400 and aborts the request otherwise.
 */
function isValidObjectId(req, res, next) {
  const { id } = req.params;
  try {
    if (!id) {
      return res.status(400).json({ message: "Missing ID parameter" });
    }
    // Reuse your helper function!
    isValidObjectIdValue(id);
    next();
  } catch (error) {
    return res
      .status(400)
      .json({ message: error.message || "Invalid ObjectId format" });
  }
}

/**
 * Validator callback for express-validator.
 * Throws if the value is not a valid MongoDB ObjectId.
 */
function isValidObjectIdValue(value) {
  if (!ObjectId.isValid(value)) {
    throw new Error("Invalid ObjectId format");
  }
  return true;
}

/**
 * Middleware that runs after the express-validator rules and responds with
 * 400 + the list of error messages if validation failed.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((error) => error.msg);
    return res
      .status(400)
      .json({ message: "Validation failed", errors: messages });
  }
  next();
}

// ---- Per-entity validation rule sets ----

/** Rules for creating/updating an artist. */
// Inside middleware/validation.js

function artistRules() {
  return [
    body("firstName").trim().notEmpty().withMessage("First name is required"),
    body("lastName").trim().notEmpty().withMessage("Last name is required"),
    // Make sure birthDate is validated properly (e.g. notEmpty or a valid date format)
    body("birthDate").notEmpty().withMessage("Birth date is required"),
    body("country").trim().notEmpty().withMessage("Country is required"),

    // Optional or other fields as needed:
    body("deathDate").optional({ values: "falsy" }),
    body("locality").optional({ values: "falsy" }),
    body("middleName").optional({ values: "falsy" }),
  ];
}

/** Rules for creating/updating an artwork. */
function artworkRules() {
  return [
    body("title").trim().notEmpty().withMessage("title is required"),
    body("year")
      .notEmpty()
      .withMessage("year is required")
      .bail()
      .isInt({ min: 1 })
      .withMessage("year must be a positive integer")
      .bail()
      .custom((value) => value <= new Date().getFullYear())
      .withMessage("year cannot be in the future")
      .toInt(),
    body("period").trim().notEmpty().withMessage("period is required"),
    body("type").trim().notEmpty().withMessage("type is required"),
    body("file").trim().notEmpty().withMessage("file is required"),
    body("artistId")
      .trim()
      .notEmpty()
      .withMessage("artistId is required")
      .bail()
      .custom(isValidObjectIdValue)
      .withMessage("artistId must be a valid ObjectId"),
  ];
}

/** Rules for creating/updating a keyword. */
function keywordRules() {
  return [
    body("keyword")
      .trim()
      .notEmpty()
      .withMessage("keyword is required")
      .bail()
      .isLength({ min: 2, max: 40 })
      .withMessage("keyword must be between 2 and 40 characters"),
  ];
}

/** Rules for linking an artwork with a keyword. */
function artworkKeywordRules() {
  return [
    body("artworkId")
      .trim()
      .notEmpty()
      .withMessage("artworkId is required")
      .bail()
      .custom(isValidObjectIdValue)
      .withMessage("artworkId must be a valid ObjectId"),
    body("keywordId")
      .trim()
      .notEmpty()
      .withMessage("keywordId is required")
      .bail()
      .custom(isValidObjectIdValue)
      .withMessage("keywordId must be a valid ObjectId"),
  ];
}

/** Rules for updating a user (role change, admin only). */
function userRules() {
  return [
    body("role")
      .isIn(["user", "admin"])
      .withMessage('role must be "user" or "admin"'),
  ];
}

module.exports = {
  isValidObjectIdValue,
  isValidObjectId,
  validate,
  artistRules,
  artworkRules,
  keywordRules,
  artworkKeywordRules,
  userRules,
};
