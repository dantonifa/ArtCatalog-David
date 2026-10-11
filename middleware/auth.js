// Authentication / authorization middleware.

const { ObjectId } = require("mongodb");
const { getDatabase } = require("../data/database");

/**
 * Ensures a valid session signature context exists.
 */
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res
    .status(401)
    .json({ message: "Unauthorized: you must be logged in via GitHub" });
}

/**
 * Permits unrestricted public reading (GET) for common user footprints,
 * but requires administrative rank or record ownership for data updates and deletions.
 */
function isOwnerOrAdmin(collection) {
  return async (req, res, next) => {
    // 1. SAFE READING UNLEASHED: Let common users read docs smoothly without needing a login
    if (req.method === "GET") {
      return next();
    }

    // 2. CRUCIAL CHECK: Non-GET actions require an authentic GitHub login session context
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({
        message:
          "Unauthorized: Data modifications require active login validation",
      });
    }

    // 3. ELEVATED PRIVILEGE BYPASS: Admins get a green light automatically
    if (req.user && req.user.role === "admin") {
      return next();
    }

    // 4. PROPERTY OWNERSHIP DISCOVERY MATRIX
    try {
      const db = getDatabase();
      const doc = await db
        .collection(collection)
        .findOne({ _id: new ObjectId(req.params.id) });

      if (!doc) {
        return res.status(404).json({ message: "Document not found" });
      }

      const ownerId = doc.createdBy || doc.addedBy;

      // Safe string comparison preventing explicit execution crashes
      if (
        ownerId &&
        req.user._id &&
        ownerId.toString() === req.user._id.toString()
      ) {
        return next();
      }

      return res.status(403).json({
        message:
          "Forbidden: You do not possess structural ownership permissions",
      });
    } catch (err) {
      return next(err);
    }
  };
}

/**
 * Strict role wall enforcing absolute administrative rank requirements.
 */
function isAdmin(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({
      message: "Unauthorized: Administrative verification session required",
    });
  }
  if (req.user && req.user.role === "admin") {
    return next();
  }
  return res.status(403).json({
    message:
      "Forbidden: Operation restricted to administrative workspace profiles only",
  });
}

module.exports = { isAuthenticated, isOwnerOrAdmin, isAdmin };
