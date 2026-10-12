// Authentication / authorization middleware.

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
 * Strict role wall enforcing absolute administrative rank requirements.
 * Blocks all non-admins from creating, updating, or deleting data.
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

module.exports = { isAuthenticated, isAdmin };
