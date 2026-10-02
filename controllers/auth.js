// Authentication controller.
// Handles the responses produced by the passport GitHub flow, logout, the
// current user ("who am I"), and a development-only login helper.
// req.user is populated by passport-session.

const { getDatabase } = require("../data/database");

/** Called after a successful GitHub OAuth, returns the logged-in user. */
function authSuccess(req, res) {
  res
    .status(200)
    .json({ message: "Authentication successful", user: req.user });
}

/** Called when GitHub OAuth fails. */
function authFailure(req, res) {
  res.status(401).json({ message: "Authentication failed" });
}

/** Ends the session and clears the login state. */
function logout(req, res, next) {
  // passport removes the user from the session.
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    // Sends a clean JSON response so Swagger does not throw an error
    res.status(200).json({ message: "Successfully logged out" });
  });
}

/**
 * Development-only login helper used until GitHub OAuth is configured.
 * Finds (or creates) a marker user ("dev" provider, role admin) and logs it
 * into the session so every protected route and the /users admin endpoints
 * can be exercised locally. The route is only mounted in development mode
 * (see routes/auth.js) and returns 404 otherwise.
 */
async function devLogin(req, res, next) {
  try {
    const db = getDatabase();
    const marker = { oauthProvider: "dev", oauthId: "dev-admin" };
    let user = await db.collection("users").findOne(marker);
    if (!user) {
      const newUser = {
        ...marker,
        displayName: "Dev Admin",
        email: null,
        role: "admin",
        createdAt: new Date(),
        lastLoginAt: new Date(),
      };
      const result = await db.collection("users").insertOne(newUser);
      user = { _id: result.insertedId, ...newUser };
    }
    req.login(user, (err) => {
      if (err) return next(err);
      res.status(200).json({ message: "Dev login successful", user });
    });
  } catch (err) {
    next(err);
  }
}

/**
 * "Who am I" endpoint used by a frontend to read the login state.
 * Returns the user when logged in (200) and 401 otherwise.
 */
function me(req, res) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.status(200).json({ authenticated: true, user: req.user });
  }
  res.status(401).json({ authenticated: false, user: null });
}

module.exports = { authSuccess, authFailure, logout, devLogin, me };
