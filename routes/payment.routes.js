const router = require("express").Router();
const ctrl = require("../controllers/payment.controller");
const { verifyJWT, verifyStudent, verifyTutor } = require("../middleware/auth");
const { asyncHandler: ah } = require("../middleware/errorHandler");

router.post(
  "/create-payment-intent",
  verifyJWT,
  verifyStudent,
  ah(ctrl.createIntent),
);
router.post("/payments", verifyJWT, ah(ctrl.savePayment));
router.get(
  "/student/payments/:email",
  verifyJWT,
  verifyStudent,
  ah(ctrl.getStudentPayments),
);
router.get(
  "/tutor/revenue/:email",
  verifyJWT,
  verifyTutor,
  ah(ctrl.getTutorRevenue),
);

module.exports = router;
