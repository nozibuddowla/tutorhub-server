const router = require("express").Router();
const { create, getByTutor } = require("../controllers/review.controller");
const { verifyJWT, verifyStudent } = require("../middleware/auth");
const { asyncHandler: ah } = require("../middleware/errorHandler");

router.post("/", verifyJWT, verifyStudent, ah(create));
router.get("/:email", ah(getByTutor));

module.exports = router;
