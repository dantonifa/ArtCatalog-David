// server.js - Main entry point for the ArtCatalog application
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const sanitize = require("express-mongo-sanitize");
const rateLimit = require("express-rate-limit");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const passport = require("passport");
const bodyParser = require("body-parser");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./swagger.json"); // Loads your compiled OpenAPI 3.0 specification file
const { initDb } = require("./data/database");
const { notFound, errorHandler } = require("./middleware/errorHandler");

// Register the GitHub OAuth strategy and user (de)serialization.
// Do not define the strategy here; only import it.
require("./config/passport");

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Proxy Configuration ----
// Instructs Express and Passport to trust header states routed via proxies (Required for hosting on Render)
app.set("trust proxy", 1);

app.use(bodyParser.json());

// ---- Security and request parsing middleware ----
app.use(helmet());
app.use(cors()); // Kept the unified CORS middleware configuration
app.use(express.json());
app.use(sanitize());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 1000,
    message: { message: "Too many requests, please try again later." },
  }),
);

// ---- Sessions and passport ----
if (process.env.NODE_ENV !== "test" && process.env.SESSION_SECRET) {
  const isProduction = process.env.NODE_ENV === "production";
  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
      cookie: {
        httpOnly: true,
        secure: isProduction, // Set to true ONLY in production (requires HTTPS)
        sameSite: isProduction ? "none" : "lax", // "none" allows cross-site cookies on Render, "lax" works for localhost
        maxAge: 60 * 60 * 1000, // 1 hour expiration
      },
    }),
  );
  app.use(passport.initialize());
  app.use(passport.session());
}

/*
// ---- Development Security Bypass ----
// COMMENTED OUT FOR DYNAMIC ROLE SELECTION DISCOVERY TESTING:
// Un-comment this block ONLY if you need to force-bypass the login buttons entirely during debugging.
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    req.user = {
      githubId: "117913289",
      displayName: "David (Dev Admin)",
      role: "admin",
    };
    req.isAuthenticated = () => true;
    next();
  });
}
*/

// ---- Swagger UI Native OpenAPI 3.0 Authorization UI Setup ----
const swaggerUiOptions = {
  swaggerOptions: {
    usePkceWithAuthorizationCodeGrant: true,
  },
  customCss: `
    .auth-container input[id*="client_secret"],
    .auth-container label[for*="client_secret"],
    .auth-container input[id*="client_secret"] ~ *,
    .auth-container label[for*="client_secret"] ~ *,
    .auth-container .wrapper:has([id*="client_secret"]),
    .auth-container .wrapper:has([for*="client_secret"]),
    .auth-container div:has(> label[for="client_secret"]) {
      display: none !important;
      visibility: hidden !important;
      height: 0 !important;
      padding: 0 !important;
      margin: 0 !important;
    }
  `,
};

// ---- Dynamic Public User Pipeline Initialization ----
// Intercepts direct entries to ensure unauthenticated consumers receive a standard read-only footprint.
const initPublicSessionContext = (req, res, next) => {
  if (!req.user) {
    req.user = {
      githubId: null,
      displayName: "Anonymous Guest",
      role: "user",
    };
  }
  next();
};

// Mount the documentation engine interface with the custom behavioral parameters handler
app.use(
  "/api-docs",
  initPublicSessionContext,
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, swaggerUiOptions),
);

// --- 1. MOUNT ROOT PORTAL VIEW FIRST (Evaluated before general collection API paths) ---
app.get("/", (req, res) => {
  // Check if user is logged in via real OAuth session AND is an actual admin
  if (req.user && req.user.githubId) {
    // User is logged in: Display current profile matrix details, documentation link, and logout button
    const name = req.user.displayName || req.user.username || "User";
    res.send(`
      <div style="font-family: sans-serif; padding: 25px; max-width: 500px; margin: 50px auto; text-align: center; border: 1px solid #ddd; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <h2 style="color: #333;">🎨 ArtCatalog API Profile Hub</h2>
        <p style="font-size: 16px;">Welcome back, <strong>${name}</strong>!</p>
        <p style="font-size: 15px;">Your Current Active Role: 
          <span style="padding: 3px 8px; border-radius: 4px; color: white; background: ${req.user.role === "admin" ? "#d9534f" : "#5cb85c"}; font-weight: bold;">
            ${req.user.role.toUpperCase()}
          </span>
        </p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 25px 0;"/>
        <a href="/api-docs" style="display: inline-block; width: 80%; padding: 12px; background: #007bff; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin-bottom: 15px; box-shadow: 0 2px 4px rgba(0,123,255,0.2);">
          Open Swagger API Workspace
        </a>
        <br/>
        <a href="/api/auth/logout" style="display: inline-block; padding: 8px 16px; background: #f0ad4e; color: white; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;">
          Log Out / Clear Session Context
        </a>
      </div>
    `);
  } else {
    // User is logged out: Display role selection dashboard to pass the choice to the state parameter
    res.send(`
      <div style="font-family: sans-serif; text-align: center; padding: 50px 20px; max-width: 800px; margin: 0 auto;">
        <h1 style="color: #222; font-size: 2.5em; margin-bottom: 10px;">🎨 Public ArtCatalog Engine Workspace</h1>
        <p style="color: #666; font-size: 1.1em;">Select your intended authorization profile path:</p>
        <br/><br/>
        <div style="display: inline-block; width: 300px; margin: 15px; padding: 25px; border: 2px solid #eaeaea; border-radius: 12px; text-align: center; vertical-align: top; background: #fff; transition: transform 0.2s;">
          <h3 style="color: #d9534f; margin-top: 0;">Administrative Profile</h3>
          <p style="color: #777; font-size: 14px; min-height: 40px;">Grants full read/write operational access. Required to execute POST, PUT, and DELETE CRUD tasks.</p>
          <a href="/api/auth/github?role=admin" style="display: block; padding: 12px; background: #d9534f; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 15px;">
            Login as Admin
          </a>
        </div>
        <div style="display: inline-block; width: 300px; margin: 15px; padding: 25px; border: 2px solid #eaeaea; border-radius: 12px; text-align: center; vertical-align: top; background: #fff; transition: transform 0.2s;">
          <h3 style="color: #5cb85c; margin-top: 0;">Standard Consumer Profile</h3>
          <p style="color: #777; font-size: 14px; min-height: 40px;">Grants public lookup access only. Restricts database modifications (POST, PUT, DELETE will return 403 Forbidden).</p>
          <a href="https://artcatalog-david-1.onrender.com/api-docs/" style="display: block; padding: 12px; background: #5cb85c; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 15px;">
            Enter as Common User
          </a>
        </div>
      </div>
    `);
  }
});

// --- 2. MOUNT PRIMARY API ROUTERS SUB-SYSTEM ---
app.use("/", require("./routes"));

// ---- Error handling ----
process.on("uncaughtException", (err, origin) => {
  console.log(
    process.stderr.fd,
    `Caught exception: ${err}\n` + `Exception origin: ${origin}`,
  );
});

app.use(notFound);
app.use(errorHandler);

async function startServer() {
  try {
    await initDb(process.env.MONGODB_URI);
    app.listen(PORT, () => {
      console.log(`ArtCatalog API running on http://localhost:${PORT}`);
      console.log(`Swagger docs at http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    console.error("Database initialization failed:", error);
  }
}

startServer();
