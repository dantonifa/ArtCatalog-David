// Generates swagger.json using swagger-autogen.
// Scans the route definitions in ./routes/index.js and writes the resulting
// OpenAPI 2.0 document to ./swagger.json (served at /api-docs), after a small
// cleanup pass (see cleanDoc) because swagger-autogen does not generate
// everything correctly out of the box.

require("dotenv").config();

const fs = require("fs");

// writeOutputFile:false -> we write the file ourselves after generation.
const swaggerAutogen = require("swagger-autogen")({ writeOutputFile: false });

// API-level metadata used in the generated documentation.
const doc = {
  info: {
    title: "ArtCatalog API",
    description: "CSE 341 Final Project - Art Catalog REST API",
    version: "1.0.0",
  },
  // Automatically detects if running on Render or locally.
  host: "artcatalog-david.onrender.com",
  basePath: "/api",
  // Use HTTPS since it is deployed on Render
  schemes: ["https"],
};

// Endpoints that are NOT meant for API consumers: the Swagger UI itself, the
// welcome message, the browser-only GitHub OAuth redirect flow, and the
// development-only dev-login helper.
const REMOVE_PATHS = [
  "/api-docs/",
  "/",
  "/api/auth/github",
  "/api/auth/github/callback",
  "/api/auth/login/failed",
  "/api/auth/dev-login",
];

// Where to write the document and which route modules to scan.
const outputFile = "./swagger.json";
const endpointsFiles = ["./routes/index.js"];

/**
 * Applies small fixes to the auto-generated document:
 * - The scanned routers already mount under /api, so strip that prefix from
 *   the generated paths and keep basePath "/api". Otherwise Swagger UI would
 *   call /api/api/... and every request would 404.
 * - Remove the endpoints listed in REMOVE_PATHS.
 * - The ?year= filter is numeric (swagger-autogen guesses "string").
 * - artwork_keywords PUT can also answer 409 when the link already exists.
 */
function cleanDoc(swaggerDoc) {
  const paths = swaggerDoc.paths;

  for (const key of Object.keys(paths)) {
    if (REMOVE_PATHS.includes(key)) {
      delete paths[key];
      continue;
    }
    // "/api/artists/" -> "/artists/" (basePath already is "/api").
    if (key.startsWith("/api/")) {
      paths[key.slice(4)] = paths[key];
      delete paths[key];
    }
  }

  // year is sent as a number by the API (the controller does Number(req.query.year)).
  const artworksGet = paths["/artworks/"] && paths["/artworks/"].get;
  if (artworksGet) {
    const yearParam = artworksGet.parameters.find((p) => p.name === "year");
    if (yearParam) {
      yearParam.type = "integer";
    }
  }

  // A PUT that moves a link onto an already-linked pair is rejected with 409.
  const linkPut =
    paths["/artworkKeywords/{id}"] && paths["/artworkKeywords/{id}"].put;
  if (linkPut && !linkPut.responses["409"]) {
    linkPut.responses["409"] = { description: "Conflict" };
  }
}

swaggerAutogen(outputFile, endpointsFiles, doc).then((result) => {
  if (!result.success) {
    console.error("swagger.json generation failed");
    process.exit(1);
  }
  cleanDoc(result.data);
  fs.writeFileSync(outputFile, JSON.stringify(result.data, null, 2) + "\n");
  console.log("swagger.json generated");
});
