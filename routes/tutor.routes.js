const router = require("express").Router();
const { getDB } = require("../config/db");
const { ObjectId } = require("mongodb");
const { asyncHandler: ah } = require("../middleware/errorHandler");

// GET /tutors — latest 6 for home
router.get(
  "/",
  ah(async (req, res) => {
    const db = getDB();
    const tutors = await db
      .collection("users")
      .find({ role: "tutor" })
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();
    res.json(tutors);
  }),
);

// GET /tutors/all — paginated with filters (MUST be before /:id)
router.get(
  "/all",
  ah(async (req, res) => {
    const db = getDB();
    const { search, subject, minRating, sort, page = 1, limit = 9 } = req.query;

    let query = { role: "tutor" };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { subjects: { $regex: search, $options: "i" } },
      ];
    }
    if (subject && subject !== "All")
      query.subjects = { $regex: subject, $options: "i" };
    if (minRating && parseFloat(minRating) > 0) {
      query.$expr = {
        $gte: [
          { $toDouble: { $ifNull: ["$averageRating", "0"] } },
          parseFloat(minRating),
        ],
      };
    }

    const sortMap = {
      ratingHigh: { averageRating: -1 },
      ratingLow: { averageRating: 1 },
      reviewsHigh: { reviewCount: -1 },
    };
    const sortOptions = sortMap[sort] || { createdAt: -1 };
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [tutors, total] = await Promise.all([
      db
        .collection("users")
        .find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .toArray(),
      db.collection("users").countDocuments(query),
    ]);

    res.json({
      tutors,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
    });
  }),
);

// GET /tutors/:id
router.get(
  "/:id",
  ah(async (req, res) => {
    const db = getDB();
    const tutor = await db
      .collection("users")
      .findOne({ _id: new ObjectId(req.params.id), role: "tutor" });
    if (!tutor) return res.status(404).json({ message: "Tutor not found." });
    res.json(tutor);
  }),
);

module.exports = router;
