const router = require("express").Router();
const ctrl = require("../controllers/admin.controller");
const {
  getAll: getContacts,
  updateStatus: updateContactStatus,
} = require("../controllers/contact.controller");
const { verifyJWT, verifyAdmin } = require("../middleware/auth");
const { asyncHandler: ah } = require("../middleware/errorHandler");

const guard = [verifyJWT, verifyAdmin];

router.get("/users", ...guard, ah(ctrl.getAllUsers));
router.delete("/users/:id", ...guard, ah(ctrl.deleteUser));
router.patch("/users/:id", ...guard, ah(ctrl.updateUser));

router.get("/tuitions", ...guard, ah(ctrl.getAllTuitions));
router.patch("/tuitions/:id", ...guard, ah(ctrl.updateTuitionStatus));

router.get("/payments", ...guard, ah(ctrl.getAllPayments));

router.get("/contacts", ...guard, ah(getContacts));
router.patch("/contacts/:id", ...guard, ah(updateContactStatus));

module.exports = router;
