const { getDB } = require("../config/db");

// POST /reviews
const create = async (req, res) => {
  const db = getDB();
  const review = { ...req.body, rating: parseFloat(req.body.rating), createdAt: new Date() };
  await db.collection("reviews").insertOne(review);

  // Update tutor's average rating
  const stats = await db.collection("reviews").aggregate([
    { $match: { tutorEmail: review.tutorEmail } },
    { $group: { _id: "$tutorEmail", avgRating: { $avg: "$rating" }, totalReviews: { $sum: 1 } } },
  ]).toArray();

  if (stats.length > 0) {
    await db.collection("users").updateOne(
      { email: review.tutorEmail },
      { $set: { averageRating: stats[0].avgRating.toFixed(2), reviewCount: stats[0].totalReviews } }
    );
  }
  res.status(201).json({ success: true, message: "Review submitted." });
};

// GET /reviews/:email
const getByTutor = async (req, res) => {
  const db = getDB();
  const reviews = await db.collection("reviews")
    .find({ tutorEmail: req.params.email })
    .sort({ createdAt: -1 })
    .toArray();
  res.json(reviews);
};

module.exports = { create, getByTutor };