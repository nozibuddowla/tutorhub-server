const router = require("express").Router();
const ctrl = require("../controllers/message.controller");
const { verifyJWT } = require("../middleware/auth");
const { asyncHandler: ah } = require("../middleware/errorHandler");

router.get("/conversations/:email", verifyJWT, ah(ctrl.getConversations));
router.post("/conversations", verifyJWT, ah(ctrl.createConversation));
router.get("/messages/unread/:email", verifyJWT, ah(ctrl.getUnreadCount));
router.get("/messages/:conversationId", verifyJWT, ah(ctrl.getMessages));

module.exports = router;
