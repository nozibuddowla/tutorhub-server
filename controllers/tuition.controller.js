const { getDB } = require("../config/db");
const { ObjectId } = require("mongodb");

// GET /tuitions — latest 6 for home page
const getLatest = async (req, res) => {
  const db = getDB();
  const result = await db
    .collection("tuitions")
    .find()
    .sort({ createdAt: -1 })
    .limit(6)
    .toArray();
  res.json(result);
};

// GET /tuitions/all — paginated listing with filters
const getAll = async (req, res) => {
  const db = getDB();
  const {
    search,
    subject,
    location,
    status,
    salaryMin,
    salaryMax,
    sort,
    page = 1,
    limit = 8,
  } = req.query;

  let query = {};
  if (status) query.status = status;
  if (search) {
    query.$or = [
      { subject: { $regex: search, $options: "i" } },
      { location: { $regex: search, $options: "i" } },
    ];
  }
  if (subject && subject !== "All")
    query.subject = { $regex: subject, $options: "i" };
  if (location) query.location = { $regex: location, $options: "i" };
  if (salaryMin || salaryMax) {
    query.salary = {};
    if (salaryMin) query.salary.$gte = Number(salaryMin);
    if (salaryMax) query.salary.$lte = Number(salaryMax);
  }

  const sortMap = { salaryLow: { salary: 1 }, salaryHigh: { salary: -1 } };
  const sortOptions = sortMap[sort] || { createdAt: -1 };
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [tuitions, total] = await Promise.all([
    db
      .collection("tuitions")
      .find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .toArray(),
    db.collection("tuitions").countDocuments(query),
  ]);

  res.json({
    tuitions,
    total,
    totalPages: Math.ceil(total / parseInt(limit)),
    currentPage: parseInt(page),
  });
};

// GET /tuitions/:id
const getById = async (req, res) => {
  const db = getDB();
  const tuition = await db
    .collection("tuitions")
    .findOne({ _id: new ObjectId(req.params.id) });
  if (!tuition) return res.status(404).json({ message: "Tuition not found." });
  res.json(tuition);
};

// POST /tuitions — student creates
const create = async (req, res) => {
  const db = getDB();
  const result = await db.collection("tuitions").insertOne({
    ...req.body,
    status: "pending",
    createdAt: new Date(),
  });
  res
    .status(201)
    .json({
      success: true,
      insertedId: result.insertedId,
      message: "Tuition posted.",
    });
};

// PATCH /tuitions/:id — student updates own tuition
const update = async (req, res) => {
  const db = getDB();
  const tuition = await db
    .collection("tuitions")
    .findOne({ _id: new ObjectId(req.params.id) });
  if (!tuition) return res.status(404).json({ message: "Not found." });
  if (tuition.studentEmail !== req.user.email)
    return res.status(403).json({ message: "Forbidden." });

  const { subject, location, salary, description } = req.body;
  await db
    .collection("tuitions")
    .updateOne(
      { _id: new ObjectId(req.params.id) },
      {
        $set: { subject, location, salary, description, updatedAt: new Date() },
      },
    );
  res.json({ success: true, message: "Tuition updated." });
};

// DELETE /tuitions/:id — student deletes own tuition
const remove = async (req, res) => {
  const db = getDB();
  const tuition = await db
    .collection("tuitions")
    .findOne({ _id: new ObjectId(req.params.id) });
  if (!tuition) return res.status(404).json({ message: "Not found." });
  if (tuition.studentEmail !== req.user.email)
    return res.status(403).json({ message: "Forbidden." });

  await db
    .collection("tuitions")
    .deleteOne({ _id: new ObjectId(req.params.id) });
  res.json({ success: true, message: "Tuition deleted." });
};

// GET /student/tuitions/:email
const getStudentTuitions = async (req, res) => {
  const db = getDB();
  if (req.user.email !== req.params.email)
    return res.status(403).json({ message: "Forbidden." });
  const tuitions = await db
    .collection("tuitions")
    .find({ studentEmail: req.params.email })
    .sort({ createdAt: -1 })
    .toArray();
  res.json(tuitions);
};

module.exports = {
  getLatest,
  getAll,
  getById,
  create,
  update,
  remove,
  getStudentTuitions,
};
