const { ObjectId } = require("mongodb");
const {
  getAllArtists,
  getArtistById,
  getArtistArtworks,
  createArtist,
  updateArtist,
  deleteArtist,
} = require("../controllers/artists");

// Mock the MongoDB database framework module
jest.mock("../data/database", () => {
  const mockCollection = {
    find: jest.fn().mockReturnThis(),
    toArray: jest.fn(),
    findOne: jest.fn(),
    insertOne: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
    countDocuments: jest.fn(), // add this for deleteArtist tests
  };
  const mockDb = {
    collection: jest.fn().mockReturnValue(mockCollection),
  };
  return {
    getDatabase: jest.fn().mockReturnValue(mockDb),
  };
});

const { getDatabase } = require("../data/database");

describe("Artists Controller Unit Tests", () => {
  let req, res, next, mockCollection;

  beforeEach(() => {
    req = { query: {}, params: {}, body: {}, user: { _id: new ObjectId() } };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
    };
    next = jest.fn();

    mockCollection = getDatabase().collection();
    jest.clearAllMocks();
  });

  describe("deleteArtist", () => {
    it("should delete an artist and return status 204 if they have no artworks", async () => {
      const id = new ObjectId();
      req.params.id = id.toString();

      mockCollection.countDocuments.mockResolvedValue(0);
      mockCollection.deleteOne.mockResolvedValue({ deletedCount: 1 });

      await deleteArtist(req, res, next);

      expect(mockCollection.deleteOne).toHaveBeenCalledWith({ _id: id });
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it("should return 409 if artist still has artworks", async () => {
      const id = new ObjectId();
      req.params.id = id.toString();

      mockCollection.countDocuments.mockResolvedValue(2);

      await deleteArtist(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
    });

    it("should return 404 if artist does not exist", async () => {
      const id = new ObjectId();
      req.params.id = id.toString();

      mockCollection.countDocuments.mockResolvedValue(0);
      mockCollection.deleteOne.mockResolvedValue({ deletedCount: 0 });

      await deleteArtist(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  // ... getArtistArtworks tests follow

  describe("getAllArtists", () => {
    it("should return all artist documents with status 200", async () => {
      const mockArtists = [{ _id: new ObjectId(), name: "Salvador Moncada" }];
      mockCollection.toArray.mockResolvedValue(mockArtists);

      await getAllArtists(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockArtists);
    });

    it("should call next(err) if database query fails", async () => {
      mockCollection.toArray.mockRejectedValue(new Error("DB error"));

      await getAllArtists(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("getArtistById", () => {
    it("should locate and return a single artist document matching the parameter ID with status 200", async () => {
      const id = new ObjectId();
      req.params.id = id.toString();
      const mockArtist = { _id: id, name: "Pablo Ruiz Picasso" };
      mockCollection.findOne.mockResolvedValue(mockArtist);

      await getArtistById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockArtist);
    });

    it("should return status 404 when the queried artist record does not exist in the collection", async () => {
      req.params.id = new ObjectId().toString();
      mockCollection.findOne.mockResolvedValue(null);

      await getArtistById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Artist not found" });
    });
    it("should call next(err) if database query fails", async () => {
      mockCollection.findOne.mockRejectedValue(new Error("DB error"));

      await getArtistById(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("createArtist", () => {
    it("should insert a whitelisted body structure into the database and return status 201", async () => {
      // Added all required profile parameters expected by your schema structure
      req.body = {
        firstName: "Vincent",
        lastName: "van Gogh",
        middleName: null,
        birthDate: null,
        deathDate: null,
        locality: null,
        country: "Netherlands",
      };

      const insertedId = new ObjectId();
      mockCollection.insertOne.mockResolvedValue({ insertedId });

      // Build a complete payload to mock what findOne returns after creation
      const mockCreatedArtist = {
        _id: insertedId,
        firstName: "Vincent",
        lastName: "van Gogh",
        middleName: null,
        birthDate: null,
        deathDate: null,
        locality: null,
        country: "Netherlands",
        createdBy: req.user._id,
        createdAt: new Date(),
      };
      mockCollection.findOne.mockResolvedValue(mockCreatedArtist);

      await createArtist(req, res, next);

      // Verify that insertOne was invoked with your complete schema fields structure
      expect(mockCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: "Vincent",
          lastName: "van Gogh",
          createdBy: req.user._id,
        }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockCreatedArtist);
    });
    it("should call next(err) if insert fails", async () => {
      req.body = { firstName: "Test", lastName: "Artist", country: "Testland" };
      mockCollection.insertOne.mockRejectedValue(new Error("DB error"));

      await createArtist(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("updateArtist", () => {
    it("should perform a partial patch assignment and return the modified record with status 200", async () => {
      const id = new ObjectId();
      req.params.id = id.toString();
      req.body = { country: "Italy" }; // use a whitelisted field

      mockCollection.updateOne.mockResolvedValue({ matchedCount: 1 });
      mockCollection.findOne.mockResolvedValue({
        _id: id,
        name: "Leonardo da Vinci",
        country: req.body.country,
      });

      await updateArtist(req, res, next);

      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { _id: id },
        { $set: { country: "Italy" } },
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        _id: id,
        name: "Leonardo da Vinci",
        country: "Italy",
      });
    });

    it("should intercept update requests pointing to empty records and return status 404", async () => {
      req.params.id = new ObjectId().toString();
      req.body = { country: "Unknown" };

      mockCollection.updateOne.mockResolvedValue({ matchedCount: 0 });

      await updateArtist(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Artist not found" });
    });
    it("should call next(err) if update fails", async () => {
      const id = new ObjectId();
      req.params.id = id.toString();
      req.body = { country: "Italy" };

      mockCollection.updateOne.mockRejectedValue(new Error("DB error"));

      await updateArtist(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("deleteArtist", () => {
    it("should delete an artist and return status 204 if they have no artworks", async () => {
      const id = new ObjectId();
      req.params.id = id.toString();

      // Mock DB behavior
      mockCollection.countDocuments.mockResolvedValue(0); // no artworks
      mockCollection.deleteOne.mockResolvedValue({ deletedCount: 1 });

      await deleteArtist(req, res, next);

      // Expect deleteOne called with ObjectId
      expect(mockCollection.deleteOne).toHaveBeenCalledWith({ _id: id });
      expect(res.status).toHaveBeenCalledWith(204);
    });
    it("should return 409 if artist still has artworks", async () => {
      const id = new ObjectId();
      req.params.id = id.toString();

      mockCollection.countDocuments.mockResolvedValue(2); // simulate existing artworks

      await deleteArtist(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
    });

    it("should return 404 if artist does not exist", async () => {
      const id = new ObjectId();
      req.params.id = id.toString();

      mockCollection.countDocuments.mockResolvedValue(0); // no artworks
      mockCollection.deleteOne.mockResolvedValue({ deletedCount: 0 }); // nothing deleted

      await deleteArtist(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
    it("should call next(err) if delete fails", async () => {
      const id = new ObjectId();
      req.params.id = id.toString();

      mockCollection.countDocuments.mockResolvedValue(0);
      mockCollection.deleteOne.mockRejectedValue(new Error("DB error"));

      await deleteArtist(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("getArtistArtworks (Stretch Endpoint)", () => {
    it("should query the target collection utilizing the artistId link and return status 200", async () => {
      const artistId = new ObjectId();
      req.params.id = artistId.toString();
      const mockArtworks = [
        { _id: new ObjectId(), title: "Sunflowers", artistId },
      ];
      mockCollection.toArray.mockResolvedValue(mockArtworks);

      await getArtistArtworks(req, res, next);

      expect(mockCollection.find).toHaveBeenCalledWith({ artistId });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockArtworks);
    });
    it("should call next(err) if query fails", async () => {
      const artistId = new ObjectId();
      req.params.id = artistId.toString();

      mockCollection.toArray.mockRejectedValue(new Error("DB error"));

      await getArtistArtworks(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
