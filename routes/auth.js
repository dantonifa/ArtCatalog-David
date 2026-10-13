// Routes handling the GitHub OAuth2 authentication lifecycle processes.
// Note: Ensure your GitHub Developer Settings contain matching Authorization Callback URLs
// for both Local Development (localhost:3000) and your live Production environment (Render).

const express = require("express");
const passport = require("passport");
const authController = require("../controllers/authController");
const router = express.Router();

// 1. Initial Handshake: Captures the user's role choice from the frontend query and routes them to GitHub with the choice preserved in the 'state' parameter.
router.get("/github", (req, res, next) => {
  const chosenRole = req.query.role === "admin" ? "admin" : "user";

  // Forward the selected role inside GitHub's native state validation parameter
  passport.authenticate("github", {
    scope: ["user:email"],
    state: chosenRole,
  })(req, res, next);
});

// 2. The Callback Gateway: Intercepts GitHub's operational verification tokens, reads the state payload parameter, and stamps the dynamic session role.
router.get(
  "/github/callback",
  passport.authenticate("github", {
    failureRedirect: "/api/auth/login/failed",
  }),
  (req, res) => {
    // Extract the explicit role value carried back through the secure GitHub handshake loop
    const finalRole = req.query.state === "admin" ? "admin" : "user";

    // Bind the chosen role directly onto the active request user object matrix
    req.user.role = finalRole;

    // Explicitly overwrite the internal cached session serialization object to match the user's choice
    if (req.session && req.session.passport && req.session.passport.user) {
      req.session.passport.user.role = finalRole;
    }

    // Persist session state parameters to MongoDB Atlas before performing redirection routing
    req.session.save((err) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Session save failed", error: err.message });
      }

      // Route administrators directly into the interactive Swagger testing console workspace panel
      if (finalRole === "admin") {
        return res.redirect("/api-docs");
      }
      // Route standard consumers onto the public home index portal interface layout
      return res.redirect("/");
    });
  },
);

// 3. Logout Endpoint: Handles the termination of the current session and cleanup of session-related data.
/**
 * #swagger.tags = ['Auth']
 * #swagger.summary = "Logout"
 * #swagger.description = "Destroys the current server session and clears session context."
 */
router.get("/logout", authController.logout);

// Security Fallback: Gracefully handles credential validation failures or canceled authorization sequences.
router.get("/login/failed", (req, res) => {
  res.status(401).json({ message: "Authentication failed. Please try again." });
});

module.exports = router;
