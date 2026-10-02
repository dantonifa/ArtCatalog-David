const { ObjectId } = require("mongodb");
const {
  getAllArtworks,
  getArtworkById,
  createArtwork,
  updateArtwork,
  deleteArtwork,
  searchArtworks,
  getArtworkKeywords,
} = require("../controllers/artworks");

// Mock the MongoDB database framework module to isolate controller layer logic
jest.mock("../data/database", () => {
  const mockCollection = {
    find: jest.fn().mockReturnThis(),
    toArray: jest.fn(),
    findOne: jest.fn(),
    insertOne: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
    deleteMany: jest.fn(),
  };
  const mockDb = {
    collection: jest.fn().mockReturnValue(mockCollection),
  };
  return {
    getDatabase: jest.fn().mockReturnValue(mockDb),
  };
});

const { getDatabase } = require("../data/database");

describe("Artworks Controller Unit Tests", () => {
  let req, res, next, mockCollection;

  // Reinitialize core objects before running each unit test case
  beforeEach(() => {
    req = { query: {}, params: {}, body: {}, user: { _id: new ObjectId() } };
    res = {
      status: jest.fn().mockReturnThis(), // Support response method chaining
      json: jest.fn(),
      send: jest.fn(),
    };
    next = jest.fn();

    mockCollection = getDatabase().collection();
    jest.clearAllMocks();
  });

  describe("getAllArtworks", () => {
    it("should return all artwork documents and filter them by query criteria with status 200", async () => {
      const artistId = new ObjectId();
      req.query = {
        period: "Baroque",
        type: "Painting",
        year: "1642",
        artistId: artistId.toString(),
      };

      const mockArtworks = [
        {
          _id: new ObjectId(),
          title: "The Night Watch",
          period: "Baroque",
          type: "Painting",
          year: 1642,
          artistId,
        },
      ];
      mockCollection.toArray.mockResolvedValue(mockArtworks);

      await getAllArtworks(req, res, next);

      // Verify filters are formatted correctly before being queried into the collection instance
      expect(mockCollection.find).toHaveBeenCalledWith({
        period: "Baroque",
        type: "Painting",
        year: 1642,
        artistId: expect.any(ObjectId),
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockArtworks);
    });
  });

  describe("getArtworkById", () => {
    it("should return a single artwork document matching the ID constraint with status 200", async () => {
      const id = new ObjectId();
      req.params.id = id.toString();
      const mockArtwork = { _id: id, title: "The Scream" };
      mockCollection.findOne.mockResolvedValue(mockArtwork);

      await getArtworkById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockArtwork);
    });

    it("should return status 404 when the target artwork document is not found", async () => {
      req.params.id = new ObjectId().toString();
      mockCollection.findOne.mockResolvedValue(null);

      await getArtworkById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Artwork not found" });
    });
  });

  describe("createArtwork", () => {
    it("should create a new artwork record and return status 201 if parent artist exists", async () => {
      const artistId = new ObjectId();
      req.body = {
        title: "Guernica",
        artistId: artistId.toString(),
        year: 1937,
        file: "guernica.jpg",
      };

      // Sequence mock calls: 1. Confirm parent artist document exists, 2. Retrieve newly inserted entry
      mockCollection.findOne
        .mockResolvedValueOnce({ _id: artistId, name: "Pablo Picasso" })
        .mockResolvedValueOnce({
          _id: new ObjectId(),
          title: "Guernica",
          artistId,
        });

      mockCollection.insertOne.mockResolvedValue({
        insertedId: new ObjectId(),
      });

      await createArtwork(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("should return status 400 if the supplied artistId does not reference an existing artist", async () => {
      req.body = { title: "Guernica", artistId: new ObjectId().toString() };
      mockCollection.findOne.mockResolvedValueOnce(null); // Simulate missing artist document

      await createArtwork(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "artistId does not reference an existing artist",
      });
    });
  });

  describe("updateArtwork", () => {
    it("should partially update whitelisted attributes and return status 200", async () => {
      const id = new ObjectId();
      const artistId = new ObjectId();
      req.params.id = id.toString();
      req.body = {
        title: "Mona Lisa (Restored)",
        artistId: artistId.toString(),
      };

      mockCollection.findOne
        .mockResolvedValueOnce({ _id: artistId }) // Verify updated artistId exists
        .mockResolvedValueOnce({
          _id: id,
          title: "Mona Lisa (Restored)",
          artistId,
        }); // Fetch modified record

      mockCollection.updateOne.mockResolvedValue({ matchedCount: 1 });

      await updateArtwork(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should return status 404 if the target update document is missing from the database", async () => {
      req.params.id = new ObjectId().toString();
      req.body = { title: "Missing Piece" };
      mockCollection.updateOne.mockResolvedValue({ matchedCount: 0 });

      await updateArtwork(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Artwork not found" });
    });
  });

  describe("deleteArtwork", () => {
    it("should delete an artwork and perform a cascading link removal on artwork_keywords with status 204", async () => {
      const id = new ObjectId();
      req.params.id = id.toString();
      mockCollection.deleteOne.mockResolvedValue({ deletedCount: 1 });
      mockCollection.deleteMany.mockResolvedValue({ deletedCount: 3 }); // Emulate link cascading deletion

      await deleteArtwork(req, res, next);

      expect(mockCollection.deleteOne).toHaveBeenCalledWith({ _id: id });
      expect(mockCollection.deleteMany).toHaveBeenCalledWith({ artworkId: id });
      expect(res.status).toHaveBeenCalledWith(204);
    });
  });

  describe("searchArtworks", () => {
    it("should support regex queries on title text constraints and return status 200", async () => {
      req.query = { q: "starry", year: "1889" };
      mockCollection.toArray.mockResolvedValue([
        { title: "The Starry Night", year: 1889 },
      ]);

      await searchArtworks(req, res, next);

      expect(mockCollection.find).toHaveBeenCalledWith({
        title: { $regex: "starry", $options: "i" },
        year: 1889,
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should return status 400 for negative, decimal, or zero year integer arguments", async () => {
      req.query = { year: "-500" };

      await searchArtworks(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "year must be a positive integer",
      });
    });

    it("should return status 400 if the provided search artistId parameter is structurally invalid", async () => {
      req.query = { artistId: "invalid-id-string-length" };

      await searchArtworks(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "artistId must be a valid ObjectId",
      });
    });
  });

  describe("getArtworkKeywords", () => {
    it("should parse the junction table collection and resolve nested keyword sheets with status 200", async () => {
      const artworkId = new ObjectId();
      const keywordId = new ObjectId();
      req.params.id = artworkId.toString();

      mockCollection.findOne.mockResolvedValue({
        _id: artworkId,
        title: "Impression, Sunrise",
      });
      mockCollection.toArray
        .mockResolvedValueOnce([{ artworkId, keywordId }]) // 1. Resolve relation links entries
        .mockResolvedValueOnce([{ _id: keywordId, keyword: "impressionism" }]); // 2. Expand keyword targets

      await getArtworkKeywords(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([
        { _id: keywordId, keyword: "impressionism" },
      ]);
    });
  });
});
