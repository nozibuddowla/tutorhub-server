const { getDB } = require("../config/db");
const { ObjectId } = require("mongodb");

// GET /admin/users
const getAllUsers = async (req, res) => {
  const db = getDB();
  const users = await db.collection("users").find().toArray();
  res.json(users);
};

// DELETE /admin/users/:id
const deleteUser = async (req, res) => {
  const db = getDB();
  const result = await db
    .collection("users")
    .deleteOne({ _id: new ObjectId(req.params.id) });
  if (!result.deletedCount)
    return res.status(404).json({ message: "User not found." });
  res.json({ success: true, message: "User deleted." });
};

// PATCH /admin/users/:id
const updateUser = async (req, res) => {
  const db = getDB();
  const result = await db
    .collection("users")
    .updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { ...req.body, updatedAt: new Date() } },
    );
  if (!result.matchedCount)
    return res.status(404).json({ message: "User not found." });
  res.json({ success: true, message: "User updated." });
};

// GET /admin/tuitions
const getAllTuitions = async (req, res) => {
  const db = getDB();
  const tuitions = await db
    .collection("tuitions")
    .find()
    .sort({ createdAt: -1 })
    .toArray();
  res.json(tuitions);
};

// PATCH /admin/tuitions/:id
const updateTuitionStatus = async (req, res) => {
  const db = getDB();
  const { status } = req.body;
  if (!["pending", "approved", "rejected"].includes(status)) {
    return res.status(400).json({ message: "Invalid status." });
  }
  const result = await db
    .collection("tuitions")
    .updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { status, approvedAt: new Date() } },
    );
  if (!result.matchedCount)
    return res.status(404).json({ message: "Tuition not found." });
  res.json({ success: true, message: `Tuition ${status}.` });
};

// GET /admin/payments
const getAllPayments = async (req, res) => {
  const db = getDB();
  const payments = await db
    .collection("payments")
    .find()
    .sort({ createdAt: -1 })
    .toArray();
  res.json(payments);
};

// GET /stats — public stats for home page
const getStats = async (req, res) => {
  const db = getDB();
  const [tutors, students, tuitions] = await Promise.all([
    db.collection("users").countDocuments({ role: "tutor" }),
    db.collection("users").countDocuments({ role: "student" }),
    db.collection("tuitions").countDocuments(),
  ]);
  res.json({ tutors, students, tuitions, satisfaction: 98 });
};

module.exports = {
  getAllUsers,
  deleteUser,
  updateUser,
  getAllTuitions,
  updateTuitionStatus,
  getAllPayments,
  getStats,
};
