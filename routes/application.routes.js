const router = require("express").Router();
const ctrl = require("../controllers/application.controller");
const { verifyJWT, verifyTutor, verifyStudent } = require("../middleware/auth");
const { asyncHandler: ah } = require("../middleware/errorHandler");

router.post("/", verifyJWT, ah(ctrl.create));
router.get(
  "/tutor/:email",
  verifyJWT,
  verifyTutor,
  ah(ctrl.getTutorApplications),
);
router.get(
  "/student/:email",
  verifyJWT,
  verifyStudent,
  ah(ctrl.getStudentApplications),
);
router.patch("/:id", verifyJWT, ah(ctrl.update));
router.patch("/:id/approve", verifyJWT, ah(ctrl.approve));
router.patch("/:id/reject", verifyJWT, ah(ctrl.reject));
router.delete("/:id", verifyJWT, ah(ctrl.remove));

module.exports = router;

// Student tuitions (placed here to avoid route conflicts in tuition router)
const tuitionCtrl = require("../controllers/tuition.controller");
router.get(
  "/student-tuitions/:email",
  verifyJWT,
  verifyStudent,
  ah(tuitionCtrl.getStudentTuitions),
);
