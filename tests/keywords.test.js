const { ObjectId } = require("mongodb");
const {
  getAllKeywords,
  getKeywordById,
  createKeyword,
  updateKeyword,
  deleteKeyword,
  getKeywordArtworks,
} = require("../controllers/keywords");

// Mock the MongoDB database framework module to isolate the controller logic
jest.mock("../data/database", () => {
  // Define chainable methods for collection operations
  const mockCollection = {
    find: jest.fn().mockReturnThis(),
    toArray: jest.fn(),
    findOne: jest.fn(),
    insertOne: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
    deleteMany: jest.fn(),
  };
  // Nest collection underneath the mock database instance
  const mockDb = {
    collection: jest.fn().mockReturnValue(mockCollection),
  };
  // Export getDatabase tracking mockDb
  return {
    getDatabase: jest.fn().mockReturnValue(mockDb),
  };
});

const { getDatabase } = require("../data/database");

describe("Keywords Controller Unit Tests", () => {
  let req, res, next, mockCollection;

  // Reinitialize core objects before running each unit test case
  beforeEach(() => {
    req = { query: {}, params: {}, body: {}, user: { _id: new ObjectId() } };
    res = {
      status: jest.fn().mockReturnThis(), // Return 'res' instance to support method chaining
      json: jest.fn(),
      send: jest.fn(),
    };
    next = jest.fn();

    // Cache the collection instance to accurately verify calls
    mockCollection = getDatabase().collection();
    jest.clearAllMocks();
  });

  describe("getAllKeywords", () => {
    it("should return all keywords with status 200", async () => {
      // Mock data representing database rows
      const mockKeywords = [{ _id: new ObjectId(), keyword: "oil painting" }];
      mockCollection.toArray.mockResolvedValue(mockKeywords);

      await getAllKeywords(req, res, next);

      // Verify that status 200 and json payload are successfully dispatched
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockKeywords);
    });
  });

  describe("getKeywordById", () => {
    it("should return a keyword document by ID with status 200", async () => {
      const id = new ObjectId();
      req.params.id = id.toString();
      const mockKeyword = { _id: id, keyword: "sculpture" };
      mockCollection.findOne.mockResolvedValue(mockKeyword);

      await getKeywordById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockKeyword);
    });

    it("should return 404 if the keyword is not found", async () => {
      req.params.id = new ObjectId().toString();
      mockCollection.findOne.mockResolvedValue(null); // Emulate empty query match

      await getKeywordById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Keyword not found" });
    });
  });

  describe("createKeyword", () => {
    it("should sanitize, convert to lowercase, create a keyword and return 201", async () => {
      req.body = { keyword: "  MoDeRn ArT  " }; // Provide mixed-case formatting with padding
      const insertedId = new ObjectId();
      mockCollection.insertOne.mockResolvedValue({ insertedId });
      mockCollection.findOne.mockResolvedValue({
        _id: insertedId,
        keyword: "modern art",
      });

      await createKeyword(req, res, next);

      // Confirm strings are sanitized via .trim().toLowerCase()
      expect(mockCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({ keyword: "modern art" }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("should return 409 if the keyword already exists (duplicate key error)", async () => {
      req.body = { keyword: "duplicate" };
      // Mimic a standard MongoDB unique index constraint exception
      const mongoError = new Error("Duplicate key");
      mongoError.code = 11000;
      mockCollection.insertOne.mockRejectedValue(mongoError);

      await createKeyword(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        message: "That keyword already exists",
      });
    });
  });

  describe("updateKeyword", () => {
    it("should update a keyword, format to lowercase, and return 200", async () => {
      req.params.id = new ObjectId().toString();
      req.body = { keyword: "  AbStRaCt  " };
      mockCollection.updateOne.mockResolvedValue({ matchedCount: 1 });
      mockCollection.findOne.mockResolvedValue({
        _id: req.params.id,
        keyword: "abstract",
      });

      await updateKeyword(req, res, next);

      // Verify targeted DB updates happen in lowercase
      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        { $set: { keyword: "abstract" } },
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("deleteKeyword", () => {
    it("should delete a keyword and its cascading links returning 204", async () => {
      const id = new ObjectId();
      req.params.id = id.toString();
      mockCollection.deleteOne.mockResolvedValue({ deletedCount: 1 });
      mockCollection.deleteMany.mockResolvedValue({ deletedCount: 5 }); // Simulate removed links

      await deleteKeyword(req, res, next);

      // Assert structural cleanup occurs in both collections (cascade behavior)
      expect(mockCollection.deleteOne).toHaveBeenCalledWith({ _id: id });
      expect(mockCollection.deleteMany).toHaveBeenCalledWith({ keywordId: id });
      expect(res.status).toHaveBeenCalledWith(204);
    });
  });

  describe("getKeywordArtworks", () => {
    it("should resolve links and return the matching artwork documents", async () => {
      const keywordId = new ObjectId();
      const artworkId = new ObjectId();
      req.params.id = keywordId.toString();

      // Chain step-by-step mocked query tracking across consecutive calls
      mockCollection.findOne.mockResolvedValue({
        _id: keywordId,
        keyword: "vintage",
      }); // 1. Keyword check
      mockCollection.toArray
        .mockResolvedValueOnce([{ _id: new ObjectId(), artworkId, keywordId }]) // 2. Many-to-many junction lookup
        .mockResolvedValueOnce([{ _id: artworkId, title: "Old Painting" }]); // 3. Final document expansion

      await getKeywordArtworks(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([
        { _id: artworkId, title: "Old Painting" },
      ]);
    });
  });
});
