const { getDB } = require("../config/db");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// POST /create-payment-intent
const createIntent = async (req, res) => {
  const { amount } = req.body;
  if (!amount || isNaN(amount) || amount <= 0) {
    return res
      .status(400)
      .json({ success: false, message: "Valid amount required." });
  }
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency: "usd",
    payment_method_types: ["card"],
  });
  res.json({ clientSecret: paymentIntent.client_secret });
};

// POST /payments — save record
const savePayment = async (req, res) => {
  const db = getDB();
  const result = await db.collection("payments").insertOne({
    ...req.body,
    createdAt: new Date(),
  });
  res.status(201).json({ success: true, insertedId: result.insertedId });
};

// GET /student/payments/:email
const getStudentPayments = async (req, res) => {
  const db = getDB();
  if (req.user.email !== req.params.email)
    return res.status(403).json({ message: "Forbidden." });
  const payments = await db
    .collection("payments")
    .find({ studentEmail: req.params.email })
    .sort({ createdAt: -1 })
    .toArray();
  res.json(payments);
};

// GET /tutor/revenue/:email
const getTutorRevenue = async (req, res) => {
  const db = getDB();
  const payments = await db
    .collection("payments")
    .find({ tutorEmail: req.params.email, status: "success" })
    .toArray();
  res.json(payments);
};

module.exports = {
  createIntent,
  savePayment,
  getStudentPayments,
  getTutorRevenue,
};
