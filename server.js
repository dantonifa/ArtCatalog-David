// Main application entry point.
// Loads environment variables, configures Express middleware (security,
// sessions, passport), wires up the route modules, and starts the HTTP
// server after connecting to MongoDB.

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const sanitize = require("express-mongo-sanitize");
const rateLimit = require("express-rate-limit");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const passport = require("passport");

// ---- Swagger UI Dependencies ----
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./swagger.json");

const { initDb } = require("./data/database");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const routes = require("./routes");

// Registers the GitHub OAuth strategy and user (de)serialization.
require("./config/passport");

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Security and request parsing middleware ----
// helmet: sets secure HTTP headers.
app.use(helmet());

// cors: allows secure cross-origin requests matching production domains with active credentials.
app.use(
  cors({
    origin: ["https://onrender.com", "http://localhost:3000"],
    credentials: true,
  }),
);

// JSON body parser.
app.use(express.json());

// Strips Mongo operator characters (\$ and .) from input to prevent injection.
app.use(sanitize());

// Rate limiting: max 100 requests per 15 minutes per IP.
/*app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    message: { message: "Too many requests, please try again later." },
  }),
);*/

// ---- Sessions and passport (disabled while running tests) ----
if (process.env.NODE_ENV !== "test" && process.env.SESSION_SECRET) {
  // Persist sessions in MongoDB via connect-mongo.
  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
      cookie: {
        httpOnly: true,
        // Production requires "none" and secure tracking for Cross-Origin cookies to work inside Swagger UI.
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 1000,
      },
    }),
  );
  // Restore the logged-in user into req.user on each request.
  app.use(passport.initialize());
  app.use(passport.session());
}

// ---- Swagger API Documentation ----
const swaggerOptions = {
  swaggerOptions: {
    withCredentials: true,
  },
};

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, swaggerOptions),
);

// ---- Routes ----
app.use("/", routes);

// ---- Central error handling (must be mounted last) ----
app.use(notFound);
app.use(errorHandler);

/**
 * Connects to MongoDB and starts the HTTP server.
 * Exits the process if the database connection fails.
 */
async function startServer() {
  try {
    await initDb(process.env.MONGODB_URI);
    app.listen(PORT, () => {
      console.log(`ArtCatalog API running on http://localhost:${PORT}`);
      console.log(`Swagger docs at http://localhost:${PORT}/api-docs`);
    });
  } catch (err) {
    console.error("Failed to initialize the database:", err);
    process.exit(1);
  }
}

// Only listen when this file is run directly (not when imported by tests).
if (require.main === module) {
  startServer();
}

// Export the app so Jest/Supertest can test it without opening a port.
module.exports = app;
