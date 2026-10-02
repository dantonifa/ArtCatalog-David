// Passport configuration for GitHub OAuth2.
// Defines serialize/deserialize so the logged-in user can be stored in and
// restored from the session, and registers the GitHub strategy that creates
// (or finds) the user document in the "users" collection.

const passport = require("passport");
const GitHubStrategy = require("passport-github2").Strategy;
const { ObjectId } = require("mongodb");
const { getDatabase } = require("../data/database");

// GitHub ids listed in ADMIN_GITHUB_IDS (comma-separated) get role "admin"
// on their first login; every other user keeps role "user" by default.
const adminGithubIds = (process.env.ADMIN_GITHUB_IDS || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

// Store only the user id in the session.
passport.serializeUser((user, done) => {
  done(null, user._id.toString());
});

// On each request, load the full user document from the DB using the id
// saved in the session.
passport.deserializeUser(async (id, done) => {
  try {
    const user = await getDatabase()
      .collection("users")
      .findOne({ _id: new ObjectId(id) });
    done(null, user);
  } catch (err) {
    console.error("Passport error in deserializeUser:", err);
    return done(err, null);
  }
});

// Register the GitHub strategy only when all required env vars are present.
if (
  process.env.GITHUB_CLIENT_ID &&
  process.env.GITHUB_CLIENT_SECRET &&
  process.env.GITHUB_CALLBACK_URL
) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_CALLBACK_URL,
      },
      // Verified callback: find the user by OAuth ids or create a new one.
      async (accessToken, refreshToken, profile, done) => {
        try {
          const db = getDatabase();
          const oauthId = String(profile.id);
          let user = await db
            .collection("users")
            .findOne({ oauthProvider: "github", oauthId });

          if (!user) {
            // First-time sign in: build the user document from the GitHub profile.
            const newUser = {
              oauthProvider: "github",
              oauthId,
              displayName: profile.displayName || profile.username,
              email:
                profile.emails && profile.emails[0]
                  ? profile.emails[0].value
                  : null,
              role: adminGithubIds.includes(oauthId) ? "admin" : "user",
              createdAt: new Date(),
              lastLoginAt: new Date(),
            };
            const result = await db.collection("users").insertOne(newUser);
            user = { _id: result.insertedId, ...newUser };
          } else {
            // Existing user: just refresh the last login timestamp.
            await db
              .collection("users")
              .updateOne(
                { _id: user._id },
                { $set: { lastLoginAt: new Date() } },
              );
            user.lastLoginAt = new Date();
          }

          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      },
    ),
  );
}

module.exports = passport;
