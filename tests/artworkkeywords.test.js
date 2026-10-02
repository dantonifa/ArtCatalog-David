const { ObjectId } = require("mongodb");
const {
  getAllArtworkKeywords,
  getArtworkKeywordById,
  createArtworkKeyword,
  updateArtworkKeyword,
  deleteArtworkKeyword,
} = require("../controllers/artworkKeywords"); // Adjust path if your folder structure differs

// Mock the database module
jest.mock("../data/database", () => {
  const mockCollection = {
    find: jest.fn().mockReturnThis(),
    toArray: jest.fn(),
    findOne: jest.fn(),
    insertOne: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
  };
  const mockDb = {
    collection: jest.fn().mockReturnValue(mockCollection),
  };
  return {
    getDatabase: jest.fn().mockReturnValue(mockDb),
  };
});

const { getDatabase } = require("../data/database");

describe("ArtworkKeywords Controller Unit Tests", () => {
  let req, res, next, mockCollection;

  beforeEach(() => {
    // Reset req, res, and next before each test
    req = { query: {}, params: {}, body: {}, user: { _id: new ObjectId() } };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
    };
    next = jest.fn();

    // Get reference to the mocked collection methods
    mockCollection = getDatabase().collection();
    jest.clearAllMocks();
  });

  describe("getAllArtworkKeywords", () => {
    it("should return all artwork-keyword links with status 200", async () => {
      const mockLinks = [
        {
          _id: new ObjectId(),
          artworkId: new ObjectId(),
          keywordId: new ObjectId(),
        },
      ];
      mockCollection.toArray.mockResolvedValue(mockLinks);

      await getAllArtworkKeywords(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockLinks);
    });

    it("should filter links if artworkId or keywordId query params are provided", async () => {
      const artId = new ObjectId().toString();
      req.query.artworkId = artId;

      mockCollection.toArray.mockResolvedValue([]);
      await getAllArtworkKeywords(req, res, next);

      expect(getDatabase().collection).toHaveBeenCalledWith("artwork_keywords");
    });
  });

  describe("getArtworkKeywordById", () => {
    it("should return a link document by its ID with status 200", async () => {
      const id = new ObjectId();
      req.params.id = id.toString();
      const mockLink = {
        _id: id,
        artworkId: new ObjectId(),
        keywordId: new ObjectId(),
      };
      mockCollection.findOne.mockResolvedValue(mockLink);

      await getArtworkKeywordById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockLink);
    });

    it("should return 404 if the link document does not exist", async () => {
      req.params.id = new ObjectId().toString();
      mockCollection.findOne.mockResolvedValue(null);

      await getArtworkKeywordById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "ArtworkKeyword link not found",
      });
    });
  });

  describe("createArtworkKeyword", () => {
    it("should create a link and return status 201", async () => {
      const artId = new ObjectId();
      const keyId = new ObjectId();
      req.body = { artworkId: artId.toString(), keywordId: keyId.toString() };

      // Mock finding parent artwork, parent keyword, no duplicate link, and successful insertion
      mockCollection.findOne
        .mockResolvedValueOnce({ _id: artId }) // artworks collection check
        .mockResolvedValueOnce({ _id: keyId }) // keywords collection check
        .mockResolvedValueOnce(null) // unique check inside artwork_keywords
        .mockResolvedValueOnce({
          _id: new ObjectId(),
          artworkId: artId,
          keywordId: keyId,
        }); // final payload fetch

      mockCollection.insertOne.mockResolvedValue({
        insertedId: new ObjectId(),
      });

      await createArtworkKeyword(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("should return 400 if the target artworkId does not exist", async () => {
      req.body = {
        artworkId: new ObjectId().toString(),
        keywordId: new ObjectId().toString(),
      };
      mockCollection.findOne.mockResolvedValueOnce(null); // Artwork missing

      await createArtworkKeyword(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "artworkId does not reference an existing artwork",
      });
    });
  });

  describe("updateArtworkKeyword", () => {
    it("should update a link whitelisted field and return 200", async () => {
      req.params.id = new ObjectId().toString();
      req.body = { artworkId: new ObjectId().toString() };

      mockCollection.findOne
        .mockResolvedValueOnce({ _id: new ObjectId() }) // artworks validation check
        .mockResolvedValueOnce({ _id: new ObjectId() }); // final payload fetch after update

      mockCollection.updateOne.mockResolvedValue({ matchedCount: 1 });

      await updateArtworkKeyword(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("deleteArtworkKeyword", () => {
    it("should delete a link document and return status 204", async () => {
      req.params.id = new ObjectId().toString();
      mockCollection.deleteOne.mockResolvedValue({ deletedCount: 1 });

      await deleteArtworkKeyword(req, res, next);

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it("should return 404 if the link to delete does not exist", async () => {
      req.params.id = new ObjectId().toString();
      mockCollection.deleteOne.mockResolvedValue({ deletedCount: 0 });

      await deleteArtworkKeyword(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "ArtworkKeyword link not found",
      });
    });
  });
});
