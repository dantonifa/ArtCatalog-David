require("dotenv").config();
const fs = require("fs");
const swaggerAutogen = require("swagger-autogen")({
  openapi: "3.0.0",
  writeOutputFile: false,
});

const TAG_ORDER = [
  "auth",
  "artists",
  "artworks",
  "keywords",
  "artworkKeywords",
  "users",
];

const TAG_NAMES = {
  artists: "Artists",
  artworks: "Artworks",
  keywords: "Keywords",
  artworkKeywords: "Artwork-Keywords",
  users: "Users",
  auth: "Auth",
};

const METHOD_ORDER = ["get", "post", "put", "patch", "delete"];

const doc = {
  openapi: "3.0.0",
  info: {
    title: "🎨 ArtCatalog REST API Workspace",
    description:
      "CSE 341 Final Project - Art Catalog REST API under OpenAPI 3.0 specification guidelines.",
    version: "1.0.0",
  },
  tags: TAG_ORDER.map((resource) => ({ name: TAG_NAMES[resource] })),
  servers: [
    {
      url: "http://localhost:3000/api",
      description: "Local Development Server",
    },
    {
      url: "https://artcatalog-david-1.onrender.com/api/",
      description: "Production Web Server (Render)",
    },
  ],
  security: [
    {
      cookieAuth: [],
    },
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "connect.sid",
      },
    },
  },
};

const REMOVE_PATHS = [
  "/api-docs/",
  "/",
  "/api/auth/github",
  "/api/auth/github/callback",
  "/api/auth/login/failed",
  "/api/auth/dev-login",
];

const outputFile = "./swagger.json";
const endpointsFiles = ["./routes/index.js"];

function tagFor(path) {
  const segment = path.split("/").filter(Boolean)[0] || "default";
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

function cleanDoc(swaggerDoc) {
  const paths = swaggerDoc.paths;
  for (const key of Object.keys(paths)) {
    if (REMOVE_PATHS.includes(key)) {
      delete paths[key];
      continue;
    }
    if (key.startsWith("/api/")) {
      paths[key.slice(4)] = paths[key];
      delete paths[key];
    }
  }

  for (const [path, methods] of Object.entries(paths)) {
    const tag = tagFor(path);
    for (const operation of Object.values(methods)) {
      operation.tags = [tag];
    }
  }

  // Ensure logout is documented nicely if scanned or you can add it explicitly:
  paths["/auth/logout"] = {
    get: {
      tags: ["Auth"],
      summary: "Logout",
      description:
        "Destroys the current server session and clears the session context.",
      responses: {
        200: { description: "Successfully logged out" },
      },
    },
  };

  sortDoc(swaggerDoc);
}

function sortDoc(swaggerDoc) {
  const sorted = {};
  const paths = Object.keys(swaggerDoc.paths)
    .filter((path) => TAG_NAMES[resourceOf(path)])
    .sort(
      (a, b) =>
        TAG_ORDER.indexOf(resourceOf(a)) - TAG_ORDER.indexOf(resourceOf(b)) ||
        compareSegments(a, b),
    );

  for (const path of paths) {
    const operations = swaggerDoc.paths[path];
    const ordered = {};

    for (const method of METHOD_ORDER) {
      if (!operations[method]) continue;
      operations[method].tags = [TAG_NAMES[resourceOf(path)]];
      ordered[method] = operations[method];
    }
    for (const key of Object.keys(operations)) {
      if (!(key in ordered)) ordered[key] = operations[key];
    }

    sorted[path] = ordered;
  }

  swaggerDoc.paths = sorted;
}

function resourceOf(path) {
  return path.split("/")[1];
}

function compareSegments(a, b) {
  const left = a.split("/");
  const right = b.split("/");
  const length = Math.min(left.length, right.length);

  for (let i = 0; i < length; i++) {
    if (left[i] === right[i]) continue;
    const leftIsTemplate = left[i].startsWith("{");
    const rightIsTemplate = right[i].startsWith("{");
    if (leftIsTemplate !== rightIsTemplate) return leftIsTemplate ? 1 : -1;
    return left[i].localeCompare(right[i]);
  }

  return left.length - right.length;
}

swaggerAutogen(outputFile, endpointsFiles, doc).then((result) => {
  if (!result.success) {
    console.error("swagger.json generation failed");
    process.exit(1);
  }
  cleanDoc(result.data);
  fs.writeFileSync(outputFile, JSON.stringify(result.data, null, 2) + "\n");
  console.log(
    "swagger.json successfully generated under OpenAPI 3.0 specification!",
  );
});
