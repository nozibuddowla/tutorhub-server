const router = require("express").Router();
const { sendMessage } = require("../controllers/contact.controller");
const { validateContact } = require("../middleware/validate");
const { asyncHandler: ah } = require("../middleware/errorHandler");

router.post("/", validateContact, ah(sendMessage));

module.exports = router;
