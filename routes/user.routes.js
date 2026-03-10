const router = require("express").Router();
const {
  createUser,
  getUserRole,
  updateUserRole,
  updateProfile,
} = require("../controllers/user.controller");
const { verifyJWT } = require("../middleware/auth");
const { asyncHandler: ah } = require("../middleware/errorHandler");

router.post("/", ah(createUser));
router.get("/role/:email", ah(getUserRole));
router.put("/role/:email", verifyJWT, ah(updateUserRole));
router.patch("/:email", verifyJWT, ah(updateProfile));

module.exports = router;
