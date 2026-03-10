const router = require("express").Router();
const ctrl = require("../controllers/tuition.controller");
const { verifyJWT, verifyStudent } = require("../middleware/authMiddleware");
const { asyncHandler: ah } = require("../middleware/errorHandler");
const { validateTuition } = require("../middleware/validate");

// specific routes BEFORE param routes
router.get("/all", ah(ctrl.getAll));
router.get("/", ah(ctrl.getLatest));
router.post("/", verifyJWT, validateTuition, ah(ctrl.create));
router.patch("/:id", verifyJWT, ah(ctrl.update));
router.delete("/:id", verifyJWT, ah(ctrl.remove));
router.get("/:id", ah(ctrl.getById));

module.exports = router;
