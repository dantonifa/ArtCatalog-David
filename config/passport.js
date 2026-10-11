// Passport configuration for GitHub OAuth2.

const passport = require("passport");
const GitHubStrategy = require("passport-github2").Strategy;
const { ObjectId } = require("mongodb");
const { getDatabase } = require("../data/database");

// 1. Serialization Gateway: Stash both the database identifier string and active role within the browser cookie store matrix.
passport.serializeUser((user, done) => {
  done(null, { id: user._id.toString(), role: user.role });
});

// 2. Deserialization Gateway: Resolves the profile data document while forcing the active role parameter to match the session state choice.
passport.deserializeUser(async (sessionUser, done) => {
  try {
    const user = await getDatabase()
      .collection("users")
      .findOne({ _id: new ObjectId(sessionUser.id) });

    if (user) {
      // Force the active user instance object to prioritize the runtime chosen role instead of the collection record value
      user.role = sessionUser.role;
    }
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

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
        passReqToCallback: true, // 👈 MANDATORY: Exposes req down into the strategy verify function below
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          const db = getDatabase();
          const oauthId = String(profile.id);
          let user = await db
            .collection("users")
            .findOne({ oauthProvider: "github", oauthId });

          if (!user) {
            // Default baseline configuration for new database user schemas
            const newUser = {
              oauthProvider: "github",
              oauthId,
              displayName: profile.displayName || profile.username || "User",
              email: profile.emails?.[0]?.value || null,
              role: "user", // Baseline fallback initialization
              createdAt: new Date(),
              lastLoginAt: new Date(),
            };
            const result = await db.collection("users").insertOne(newUser);
            user = { _id: result.insertedId, ...newUser };
          } else {
            // Track the timestamp connection update natively without hardcoding administrative overrides
            await db.collection("users").updateOne(
              { _id: user._id },
              {
                $set: {
                  lastLoginAt: new Date(),
                },
              },
            );

            user.lastLoginAt = new Date();
          }

          // 👈 DYNAMIC CAPTURE: Safely extract state context before Passport cleans the query string
          const finalRole = req.query.state === "admin" ? "admin" : "user";
          user.role = finalRole;

          // Pass the complete user entity context object smoothly to the callback route pipeline
          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      },
    ),
  );
}

module.exports = passport;
