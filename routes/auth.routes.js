const router = require("express").Router();
const { generateToken, logout } = require("../controllers/auth.controller");
const { asyncHandler } = require("../middleware/errorHandler");

router.post("/jwt", asyncHandler(generateToken));
router.post("/logout", logout);

module.exports = router;
