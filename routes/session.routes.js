const router = require("express").Router();
const ctrl = require("../controllers/session.controller");
const { verifyJWT } = require("../middleware/auth");
const { asyncHandler: ah } = require("../middleware/errorHandler");

router.get("/upcoming/:email", verifyJWT, ah(ctrl.getUpcoming));
router.get("/:email", verifyJWT, ah(ctrl.getSessions));
router.post("/", verifyJWT, ah(ctrl.create));
router.patch("/:id", verifyJWT, ah(ctrl.updateStatus));
router.delete("/:id", verifyJWT, ah(ctrl.remove));

module.exports = router;
