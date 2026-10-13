// Route definitions for the users resource.
// ALL routes are admin-only (401 if not logged in, 403 if not an admin).
// Admins manage roles: list users, view one, promote/demote, or delete.

const express = require("express");
const router = express.Router();
const usersController = require("../controllers/users");
const { isAdmin } = require("../middleware/auth");
const {
  userRules,
  validate,
  isValidObjectId,
} = require("../middleware/validation");

// Admin only: list all users.
router.get("/", isAdmin, usersController.getAllUsers);
// Admin only: get a single user.
router.get("/:id", isAdmin, isValidObjectId, usersController.getUserById);
// Admin only: change a user's role.
router.put(
  "/:id",
  isAdmin,
  isValidObjectId,
  userRules(),
  validate,
  usersController.updateUser,
);
// Admin only: delete a user.
router.delete("/:id", isAdmin, isValidObjectId, usersController.deleteUser);

module.exports = router;
